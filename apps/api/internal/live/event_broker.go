package live

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strconv"
	"sync"
	"sync/atomic"
	"time"
)

const eventPageSize = 200

var eventLagBuckets = [...]float64{0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10}

// EventBroker collapses database polling from one query per SSE connection to
// one query per active session per API process. PostgreSQL remains the replay
// ledger; a slow subscriber is disconnected and recovers through Last-Event-ID.
type EventBroker struct {
	store    EventStore
	interval time.Duration
	buffer   int

	mu               sync.Mutex
	sessions         map[string]*eventStream
	initializing     map[string]*streamInitialization
	closed           bool
	nextID           uint64
	subscriptions    atomic.Uint64
	droppedSlow      atomic.Uint64
	databaseFailures atomic.Uint64
	eventsPublished  atomic.Uint64
	eventLagNanos    atomic.Uint64
	eventLagCount    atomic.Uint64
	eventLagBuckets  [len(eventLagBuckets) + 1]atomic.Uint64
}

type eventStream struct {
	cancel      context.CancelFunc
	cursor      int64
	subscribers map[uint64]chan Event
}

type streamInitialization struct {
	done chan struct{}
	err  error
}

type deadlineReconciler interface {
	ReconcileDeadline(context.Context, string) (bool, error)
}

func NewEventBroker(store EventStore, interval time.Duration, subscriberBuffer int) *EventBroker {
	if interval <= 0 {
		interval = 250 * time.Millisecond
	}
	if subscriberBuffer < 1 {
		subscriberBuffer = 256
	}
	return &EventBroker{store: store, interval: interval, buffer: subscriberBuffer, sessions: map[string]*eventStream{}, initializing: map[string]*streamInitialization{}}
}

func (b *EventBroker) Subscribe(c context.Context, session string) (<-chan Event, func(), error) {
	for {
		b.mu.Lock()
		if b.closed {
			b.mu.Unlock()
			return nil, nil, context.Canceled
		}
		if stream := b.sessions[session]; stream != nil {
			return b.addSubscriberLocked(session, stream)
		}
		if pending := b.initializing[session]; pending != nil {
			done := pending.done
			b.mu.Unlock()
			select {
			case <-done:
				if pending.err != nil {
					return nil, nil, pending.err
				}
				continue
			case <-c.Done():
				return nil, nil, c.Err()
			}
		}

		pending := &streamInitialization{done: make(chan struct{})}
		b.initializing[session] = pending
		b.mu.Unlock()

		cursor, err := b.store.LatestEventID(c, session)
		b.mu.Lock()
		delete(b.initializing, session)
		if err == nil && b.closed {
			err = context.Canceled
		}
		pending.err = err
		if err != nil {
			close(pending.done)
			b.mu.Unlock()
			return nil, nil, err
		}
		streamCtx, cancel := context.WithCancel(context.Background())
		stream := &eventStream{cancel: cancel, cursor: cursor, subscribers: map[uint64]chan Event{}}
		b.sessions[session] = stream
		close(pending.done)
		go b.run(streamCtx, session, stream)
		return b.addSubscriberLocked(session, stream)
	}
}

func (b *EventBroker) addSubscriberLocked(session string, stream *eventStream) (<-chan Event, func(), error) {
	b.nextID++
	b.subscriptions.Add(1)
	id := b.nextID
	ch := make(chan Event, b.buffer)
	stream.subscribers[id] = ch
	b.mu.Unlock()
	var once sync.Once
	unsubscribe := func() {
		once.Do(func() { b.unsubscribe(session, stream, id) })
	}
	return ch, unsubscribe, nil
}

func (b *EventBroker) run(c context.Context, session string, stream *eventStream) {
	ticker := time.NewTicker(b.interval)
	defer ticker.Stop()
	for {
		select {
		case <-c.Done():
			return
		case <-ticker.C:
			if reconciler, ok := b.store.(deadlineReconciler); ok {
				if _, err := reconciler.ReconcileDeadline(c, session); err != nil {
					b.fail(session, stream)
					return
				}
			}
			for {
				events, e := b.store.Events(c, session, stream.cursor, eventPageSize)
				if e != nil {
					b.fail(session, stream)
					return
				}
				if len(events) == 0 {
					break
				}
				stream.cursor = events[len(events)-1].EventID
				for _, event := range compactEvents(events) {
					b.eventsPublished.Add(1)
					lag := time.Since(event.OccurredAt)
					if lag < 0 {
						lag = 0
					}
					b.eventLagNanos.Add(uint64(lag))
					for index, upper := range eventLagBuckets {
						if lag.Seconds() <= upper {
							b.eventLagBuckets[index].Add(1)
						}
					}
					b.eventLagBuckets[len(eventLagBuckets)].Add(1)
					b.eventLagCount.Add(1)
					b.publish(session, stream, event)
				}
				if len(events) < eventPageSize {
					break
				}
			}
		}
	}
}

func (b *EventBroker) fail(session string, stream *eventStream) {
	b.databaseFailures.Add(1)
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.sessions[session] != stream {
		return
	}
	for id, subscriber := range stream.subscribers {
		close(subscriber)
		delete(stream.subscribers, id)
	}
	delete(b.sessions, session)
	stream.cancel()
}

// Close disconnects all subscribers so http.Server.Shutdown does not wait for
// heartbeat-only SSE requests until its deadline expires.
func (b *EventBroker) Close() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.closed = true
	for session, stream := range b.sessions {
		for id, subscriber := range stream.subscribers {
			close(subscriber)
			delete(stream.subscribers, id)
		}
		stream.cancel()
		delete(b.sessions, session)
	}
}

func compactEvents(events []Event) []Event {
	out := make([]Event, 0, len(events))
	var pendingPresence *Event
	presenceDelta := 0
	flushPresence := func() {
		if pendingPresence != nil {
			pendingPresence.Payload, _ = json.Marshal(map[string]int{"participant_delta": presenceDelta})
			out = append(out, *pendingPresence)
			pendingPresence = nil
			presenceDelta = 0
		}
	}
	for index := range events {
		if events[index].Name == "presence.updated" {
			pendingPresence = &events[index]
			presenceDelta++
			continue
		}
		flushPresence()
		out = append(out, events[index])
	}
	flushPresence()
	return out
}

func (b *EventBroker) publish(session string, stream *eventStream, event Event) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.sessions[session] != stream {
		return
	}
	for id, subscriber := range stream.subscribers {
		select {
		case subscriber <- event:
		default:
			b.droppedSlow.Add(1)
			close(subscriber)
			delete(stream.subscribers, id)
		}
	}
	if len(stream.subscribers) == 0 {
		delete(b.sessions, session)
		stream.cancel()
	}
}

func (b *EventBroker) WritePrometheus(w io.Writer) {
	b.mu.Lock()
	sessions := len(b.sessions)
	subscribers := 0
	for _, stream := range b.sessions {
		subscribers += len(stream.subscribers)
	}
	b.mu.Unlock()
	fmt.Fprintln(w, "# TYPE proslides_live_broker_sessions gauge")
	fmt.Fprintf(w, "proslides_live_broker_sessions %d\n", sessions)
	fmt.Fprintln(w, "# TYPE proslides_live_sse_connections gauge")
	fmt.Fprintf(w, "proslides_live_sse_connections %d\n", subscribers)
	fmt.Fprintln(w, "# TYPE proslides_live_sse_subscriptions_total counter")
	fmt.Fprintf(w, "proslides_live_sse_subscriptions_total %d\n", b.subscriptions.Load())
	fmt.Fprintln(w, "# TYPE proslides_live_sse_slow_client_drops_total counter")
	fmt.Fprintf(w, "proslides_live_sse_slow_client_drops_total %d\n", b.droppedSlow.Load())
	fmt.Fprintln(w, "# TYPE proslides_live_broker_database_failures_total counter")
	fmt.Fprintf(w, "proslides_live_broker_database_failures_total %d\n", b.databaseFailures.Load())
	fmt.Fprintln(w, "# TYPE proslides_live_events_published_total counter")
	fmt.Fprintf(w, "proslides_live_events_published_total %d\n", b.eventsPublished.Load())
	fmt.Fprintln(w, "# HELP proslides_live_event_lag_seconds Delay between durable event creation and broker publication.")
	fmt.Fprintln(w, "# TYPE proslides_live_event_lag_seconds histogram")
	for index, upper := range eventLagBuckets {
		fmt.Fprintf(w, "proslides_live_event_lag_seconds_bucket{le=%q} %d\n", strconv.FormatFloat(upper, 'g', -1, 64), b.eventLagBuckets[index].Load())
	}
	fmt.Fprintf(w, "proslides_live_event_lag_seconds_bucket{le=\"+Inf\"} %d\n", b.eventLagBuckets[len(eventLagBuckets)].Load())
	fmt.Fprintf(w, "proslides_live_event_lag_seconds_sum %.9f\n", float64(b.eventLagNanos.Load())/float64(time.Second))
	fmt.Fprintf(w, "proslides_live_event_lag_seconds_count %d\n", b.eventLagCount.Load())
}

func (b *EventBroker) unsubscribe(session string, stream *eventStream, id uint64) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.sessions[session] != stream {
		return
	}
	if subscriber, ok := stream.subscribers[id]; ok {
		close(subscriber)
		delete(stream.subscribers, id)
	}
	if len(stream.subscribers) == 0 {
		delete(b.sessions, session)
		stream.cancel()
	}
}
