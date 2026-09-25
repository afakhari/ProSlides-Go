package live

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

type rejoinParticipant struct {
	participant  Participant
	requestID    string
	displayName  string
	disconnected bool
}

type rejoinStore struct {
	mu        sync.Mutex
	joinable  bool
	byRequest map[string]*rejoinParticipant
	byName    map[string]*rejoinParticipant
	presence  []presenceCall
}

type presenceCall struct {
	session      string
	participant  Participant
	disconnected bool
}

func newRejoinStore(joinable bool, participant rejoinParticipant) *rejoinStore {
	s := &rejoinStore{joinable: joinable, byRequest: map[string]*rejoinParticipant{}, byName: map[string]*rejoinParticipant{}}
	if participant.participant.ID != "" {
		participant.displayName = participant.participant.DisplayName
		s.byRequest[participant.requestID] = &participant
		s.byName[participant.displayName] = &participant
	}
	return s
}

func (s *rejoinStore) CreateSession(context.Context, string, string, string, string) (Session, bool, error) {
	return Session{}, false, errors.New("unexpected CreateSession")
}
func (s *rejoinStore) ResolveSession(context.Context, string) (SessionLocator, error) {
	return SessionLocator{}, errors.New("unexpected ResolveSession")
}
func (s *rejoinStore) ApplyAction(context.Context, string, string, string, int64, string, string) (Session, bool, error) {
	return Session{}, false, errors.New("unexpected ApplyAction")
}
func (s *rejoinStore) SubmitAnswer(context.Context, string, []byte, string, string, ActivityResponsePayload, ScoringPolicy) (AnswerResult, error) {
	return AnswerResult{}, errors.New("unexpected SubmitAnswer")
}
func (s *rejoinStore) ParticipantSnapshot(context.Context, string, []byte) (ParticipantSnapshot, error) {
	return ParticipantSnapshot{}, errors.New("unexpected ParticipantSnapshot")
}
func (s *rejoinStore) ManagerSnapshot(context.Context, string, string) (ManagerSnapshot, error) {
	return ManagerSnapshot{}, errors.New("unexpected ManagerSnapshot")
}
func (s *rejoinStore) StageSnapshot(context.Context, string, string) (StageSnapshot, error) {
	return StageSnapshot{}, errors.New("unexpected StageSnapshot")
}
func (s *rejoinStore) Roster(context.Context, string, string, RosterQuery) (RosterPage, error) {
	return RosterPage{}, errors.New("unexpected Roster")
}
func (s *rejoinStore) Events(context.Context, string, int64, int) ([]Event, error) { return nil, nil }
func (s *rejoinStore) LatestEventID(context.Context, string) (int64, error)        { return 0, nil }
func (s *rejoinStore) ReconcileDeadline(context.Context, string) (bool, error)     { return false, nil }
func (s *rejoinStore) AuthorizeViewer(context.Context, string, string, []byte) error {
	return nil
}

// Join mirrors the PostgresStore contract: idempotent replay always wins, an
// away participant is restored by display name (same record, new credential,
// count unchanged), an active display name survives as a fresh INSERT conflict,
// and non-joinable sessions reject everyone but the original retry.
func (s *rejoinStore) Join(_ context.Context, session, request, name, avatar string, _ []byte) (Participant, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if existing := s.byRequest[request]; existing != nil {
		return existing.participant, true, nil
	}
	if !s.joinable {
		return Participant{}, false, ErrConflict
	}
	if existing := s.byName[name]; existing != nil {
		if !existing.disconnected {
			return Participant{}, false, ErrNameTaken
		}
		existing.requestID = request
		existing.participant.Avatar = avatar
		existing.disconnected = false
		s.byRequest[request] = existing
		return existing.participant, true, nil
	}
	participant := Participant{ID: name + "-participant-id", DisplayName: name, Avatar: avatar}
	s.byRequest[request] = &rejoinParticipant{participant: participant, requestID: request, displayName: name}
	s.byName[name] = &rejoinParticipant{participant: participant, requestID: request, displayName: name}
	return participant, false, nil
}

func (s *rejoinStore) SetParticipantPresence(_ context.Context, session string, hash []byte, disconnected bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, rp := range s.byRequest {
		if string(tokenHash(rp.requestID)) == string(hash) {
			rp.disconnected = disconnected
			s.presence = append(s.presence, presenceCall{session: session, participant: rp.participant, disconnected: disconnected})
			return nil
		}
	}
	return nil
}

func rejoinHandler(store *rejoinStore) http.Handler {
	mux := http.NewServeMux()
	service := NewService(store, DeductionPolicy{})
	NewHTTP(service, NewEventBroker(store, time.Hour, 1), snapshotAuth{}, false).Register(mux)
	return mux
}

func joinRequest(path, request, name string) *http.Request {
	body := strings.NewReader(fmt.Sprintf(`{"request_id":%q,"display_name":%q}`, request, name))
	req := httptest.NewRequest(http.MethodPost, path, body)
	req.Header.Set("Content-Type", "application/json")
	return req
}

func TestJoinRestoresDisconnectedParticipantWithSameName(t *testing.T) {
	store := newRejoinStore(true, rejoinParticipant{participant: Participant{ID: "existing-id", DisplayName: "Player", Avatar: "A"}, requestID: "11111111-1111-4111-8111-111111111111", disconnected: true})
	handler := rejoinHandler(store)

	response := httptest.NewRecorder()
	handler.ServeHTTP(response, joinRequest("/api/v1/live/sessions/"+testSessionID+"/join", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "Player"))
	if response.Code != http.StatusOK {
		t.Fatalf("restore status = %d, body = %s", response.Code, response.Body.String())
	}
	var payload map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload["id"] != "existing-id" {
		t.Fatalf("restore returned a participant other than the original: %s", response.Body.String())
	}
	updated := false
	for _, cookie := range response.Result().Cookies() {
		if cookie.Name == "proslides_participant" && cookie.Value == "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" {
			updated = true
		}
	}
	if !updated {
		t.Fatal("participant cookie was not rotated to the rejoining credential")
	}
}

func TestJoinRejectsActiveNameTakeover(t *testing.T) {
	store := newRejoinStore(true, rejoinParticipant{participant: Participant{ID: "active-id", DisplayName: "Player"}, requestID: "11111111-1111-4111-8111-111111111111"})
	handler := rejoinHandler(store)

	response := httptest.NewRecorder()
	handler.ServeHTTP(response, joinRequest("/api/v1/live/sessions/"+testSessionID+"/join", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "Player"))
	if response.Code != http.StatusConflict {
		t.Fatalf("status = %d, body = %s", response.Code, response.Body.String())
	}
	if !strings.Contains(response.Body.String(), `"display_name_taken"`) {
		t.Fatalf("expected display_name_taken, body = %s", response.Body.String())
	}
}

func TestJoinIdempotentRetryReturnsOriginal(t *testing.T) {
	store := newRejoinStore(true, rejoinParticipant{participant: Participant{ID: "player-id", DisplayName: "Player", Avatar: "A"}, requestID: "11111111-1111-4111-8111-111111111111", disconnected: true})
	handler := rejoinHandler(store)

	response := httptest.NewRecorder()
	handler.ServeHTTP(response, joinRequest("/api/v1/live/sessions/"+testSessionID+"/join", "11111111-1111-4111-8111-111111111111", "Player"))
	if response.Code != http.StatusOK {
		t.Fatalf("retry status = %d, body = %s", response.Code, response.Body.String())
	}
}

func TestJoinRejectsNonJoinableSession(t *testing.T) {
	store := newRejoinStore(false, rejoinParticipant{})
	handler := rejoinHandler(store)

	response := httptest.NewRecorder()
	handler.ServeHTTP(response, joinRequest("/api/v1/live/sessions/"+testSessionID+"/join", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "Player"))
	if response.Code != http.StatusConflict {
		t.Fatalf("status = %d, body = %s", response.Code, response.Body.String())
	}
}

func TestServiceSetParticipantPresence(t *testing.T) {
	store := newRejoinStore(true, rejoinParticipant{participant: Participant{ID: "p", DisplayName: "P"}, requestID: testParticipantToken})
	service := NewService(store, DeductionPolicy{})

	if err := service.SetParticipantPresence(context.Background(), testSessionID, testParticipantToken, true); err != nil {
		t.Fatalf("presence error: %v", err)
	}
	store.mu.Lock()
	if len(store.presence) != 1 || !store.presence[0].disconnected || store.presence[0].session != testSessionID {
		t.Fatalf("presence = %+v", store.presence)
	}
	store.mu.Unlock()

	if err := service.SetParticipantPresence(context.Background(), "not-a-uuid", testParticipantToken, true); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("invalid session error = %v", err)
	}
	before := len(store.presence)
	if err := service.SetParticipantPresence(context.Background(), testSessionID, "not-a-uuid", true); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("invalid token error = %v", err)
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	if len(store.presence) != before {
		t.Fatal("invalid presence call reached the store")
	}
}

func TestJoinMetricsCountRestoredAndJoined(t *testing.T) {
	store := newRejoinStore(true, rejoinParticipant{participant: Participant{ID: "existing-id", DisplayName: "Player", Avatar: "A"}, requestID: "11111111-1111-4111-8111-111111111111", disconnected: true})
	service := NewService(store, DeductionPolicy{})

	if _, restored, err := service.Join(context.Background(), testSessionID, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "Player", "A"); err != nil || !restored {
		t.Fatalf("restore = %v, %v", restored, err)
	}
	if _, restored, err := service.Join(context.Background(), testSessionID, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "Second", "B"); err != nil || restored {
		t.Fatalf("new join = %v, %v", restored, err)
	}
	var metrics strings.Builder
	service.WritePrometheus(&metrics)
	for _, want := range []string{`proslides_live_joins_total{outcome="restored"} 1`, `proslides_live_joins_total{outcome="joined"} 1`} {
		if !strings.Contains(metrics.String(), want) {
			t.Fatalf("metrics missing %q:\n%s", want, metrics.String())
		}
	}
}
