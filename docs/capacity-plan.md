# Capacity proof plan

## Purpose

This plan turns “supports 10,000 participants” into a reproducible engineering
claim. Do not mark a capacity level complete from unit tests, a local demo, or
an average latency number. Save the test configuration, commit SHA, environment,
raw results, and bottleneck analysis for every accepted run.

## Reference workload for one live session

| Phase | Workload |
|---|---|
| connect | target users establish authenticated SSE over 120 seconds |
| steady | all streams remain open for 10 minutes with 15-second heartbeats |
| join burst | target users join over 60 seconds; presence is compacted |
| question open | one manager action; all clients receive state within the event SLO |
| answer burst | 80% of users answer within 5 seconds; 100% within 15 seconds |
| reconnect | 20% of SSE clients disconnect and recover through snapshot/cursor |
| closure | manager closes question; aggregate stats and leaderboard are published |
| host loss | manager disconnects/reconnects without changing authoritative state |

Test levels are 1,000, then 5,000, then 10,000 concurrent participants. A level
is attempted only after the previous level passes twice without manual repair.

## Initial service-level objectives

These are acceptance thresholds to validate or revise with product evidence:

| Signal | Gate |
|---|---|
| answer HTTP latency | p95 <= 500 ms, p99 <= 1 s during burst |
| manager command latency | p95 <= 250 ms, p99 <= 750 ms |
| SSE event propagation | p95 <= 1 s, p99 <= 2 s |
| reconnect recovery | p95 <= 3 s including snapshot |
| mutation error rate | < 0.1%, excluding intentional 409 validation conflicts |
| correctness | zero lost accepted answers, zero double scores, zero invalid transitions |
| API saturation | CPU < 80% sustained; no unbounded goroutine/memory growth |
| PostgreSQL saturation | no pool starvation; lock waits and storage limits documented |

## Required telemetry

- HTTP request count, duration, response status, and in-flight requests by route.
- PostgreSQL pool acquired/idle/max, acquire duration, query latency, errors,
  transaction duration, lock waits, deadlocks, and database CPU/IO.
- Active SSE connections, connection lifetime, reconnect count, bytes/events
  sent, broker sessions/subscribers, buffer drops, and ledger-to-client lag.
- Accepted/duplicate/rejected answers and score-update duration.
- Process CPU, RSS, goroutines, GC pauses, file descriptors, and network throughput.

Metrics must use bounded labels. Never label by participant, request, session,
email, or raw error text in a way that creates unbounded cardinality.

## Test topology

Use dedicated load generators separate from the API/database hosts. Record CPU,
RAM, network, PostgreSQL storage class, API replica count, pool configuration,
TLS/proxy settings, Go version, and dataset size. Local Docker Compose is only a
functional gate; it is not capacity evidence.

## Current evidence

Role-scoped snapshots, manager keyset pagination, aggregate-only leaderboard
events, bounded subscriber buffers, presence compaction, one ledger poller per
active session/API process, Redis live limits, configurable pools, raised
Nginx/FD ceilings, and bounded HTTP/runtime Prometheus metrics are implemented
and functionally verified. Bounded PostgreSQL pool/query, SSE/broker, live-
answer, and event-lag metrics are also present. The real protocol scenario and
hard SQL reconciliation passed locally at 100 users and twice at 1k with 500
joins/second, both directly and in two consecutive follow-up runs through the
same-origin Nginx ingress. These Docker Desktop runs are recorded in
`docs/load-test-results.md`; they do not include TLS or remote hosts and are not
the production-like 1k gate. Continuous lock sampling and sampled
cross-component traces remain.

## Ordered execution

As of 2026-08-28, the owner has prioritized frontend phases F1-F5 before the
next load run. This changes scheduling only: the topology, evidence, and pass/
fail requirements below remain mandatory, and the production-like 1k result is
still unproven.

1. **Completed 2026-08-19:** add role-scoped/paginated snapshots so players
   never download the 10k roster; full leaderboard rows are also removed from
   audience SSE.
2. **Completed locally 2026-08-24:** bounded HTTP/runtime/pool/query/SSE/broker/
   answer/event-lag metrics, the 100-user protocol run, raw summaries, and hard
   SQL reconciliation passed, followed by two consecutive 1k passes through
   Nginx and a forced API-address recovery check.
3. **Queued after frontend F5:** repeat the two-run 1k result on a named production-like
   single API through TLS ingress, including cold readiness and CPU/heap/locks.
4. Fix measured bottlenecks; rerun twice.
5. Repeat at 5k with multiple API instances and no sticky sessions.
6. Add Redis outbox wake-up only if event polling/latency measurements require it.
7. Repeat at 10k, including reconnect and answer bursts.
8. Document capacity per infrastructure shape and set alerts from observed headroom.

## Correctness audit after every run

Query PostgreSQL and reconcile:

- accepted HTTP answer IDs equal durable answer rows;
- each participant/question has at most one answer;
- participant aggregate score equals the sum of immutable answer deltas;
- command request IDs are unique and return stable stored results;
- state versions are monotonic;
- every emitted durable event references an existing session and valid state;
- no answer committed after the authoritative close/deadline boundary.

Any mismatch fails the run even when latency is excellent.

## Promotion rule

Functional product/API parity is complete. Production rollout remains
feature-flagged until the 10k gate, observability, security controls,
backup/restore, graceful drain, and a tested rollback all pass. Capacity claims
must name the tested infrastructure; never extrapolate linearly beyond measured
results.
