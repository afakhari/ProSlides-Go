# ProSlides system architecture

## Status and intent

This document owns current infrastructure/backend correctness invariants and the
system architecture that v2 preserves. The system is designed to scale to a
measured 10,000 concurrent participants in one live session, but
that capacity is **not yet certified**. Certification requires the workload and
gates in `docs/capacity-plan.md`; architecture alone is not proof.

The governing design is a Go modular monolith with PostgreSQL as the durable
system of record, Redis for optional ephemeral coordination, HTTP for commands,
and SSE for server-to-client delivery. It deliberately avoids the operational
cost of microservices and a message broker until measurements justify them.

The current ProSlides v2 product/domain model is defined separately in
`docs/v2-product-architecture.md` and ADR 0004. This document owns the
infrastructure and correctness invariants that model relies on.

## System context

```text
Browser (manager/player)
  |-- HTTPS command/query --> Load balancer --> Go API instances
  |-- HTTPS SSE stream -----> Load balancer --> Go API instances
                                           |-- PostgreSQL (truth + event ledger)
                                           `-- Redis (identity/live rate limits now;
                                                       presence/fan-out optional later)
Object storage/CDN <---------------- media module (future)
Telemetry backend <---------------- bounded Prometheus metrics now; traces later
```

No sticky session is required for correctness. Session cookies and participant
credential hashes are validated against shared PostgreSQL. Each API instance
can replay from the durable event ledger and then deliver new events locally.

## Frontend boundary

The browser remains a React 19/Vite TypeScript single-page application. Its
durable dependency boundary is:

```text
app (bootstrap, router, providers, route layouts/errors)
  -> modules (identity, presentations/editor, live, reports, marketing)
       -> shared (API transport, UI primitives, styles, utilities)
```

Dependencies point downward; `shared` never imports a product module and one
module does not reach into another module's internals. React Router owns URL
state and route-level loading/error behavior. Server-backed REST state may use
one cache layer when introduced deliberately; the live runtime remains a
separate typed snapshot + HTTP command + SSE reducer because event ordering,
replay, and reconnect are domain requirements rather than generic cache state.

Application source is TS/TSX. New work must preserve typed module/domain
boundaries rather than reintroducing untyped compatibility leaves. Styling uses
one Tailwind v4/CSS semantic-token source and logical RTL-aware
properties. Local component state stays local; no global store, state machine,
SSR framework, microfrontend, or separate design-system package is added absent
a measured need.

Frontend technical boundaries, state ownership, forms/API rules, styling and
testing live in `docs/frontend-architecture.md`; ADR 0003 records the decision
rationale. Persian product/UX rules live in
`docs/frontend-professionalization.md`. Current implementation/release status
is kept only in `docs/status/current.md`; intentionally deferred frontend debt
is in `docs/frontend-debt.md`. The completed v2 delivery plan is archived.

## Module boundaries

| Module | Owns | Must not own |
|---|---|---|
| `identity` | accounts, password hashes, email verification/reset delivery, Google verification, opaque sessions, CSRF | live state or scores |
| `presentations` | presentations and authored Content/Activity Item definitions | accepting live responses |
| `live` | sessions, participants, responses/evaluations, cumulative scoring/ranking, snapshots, events | account lifecycle or mutable authoring truth |
| `reports` | immutable/session-scoped result projections and exports | live command handling |
| `media` (future) | object metadata and access policy | binary storage in PostgreSQL |
| `platform` | process lifecycle, config, HTTP, PostgreSQL, Redis; future telemetry | product rules |

Dependencies point inward:

```text
HTTP adapter -> application service -> domain policy -> repository interface
                                                    -> PostgreSQL/Redis adapter
```

Only `live` may transition a session, accept an answer, change a live score, or
publish a live-domain event. Domain policy does not import HTTP or Redis.

## Durable command path

1. The client sends an HTTP mutation with a cryptographically random
   `request_id`. Manager actions also send `expected_state_version`.
2. Authentication/CSRF and domain validation run before mutation.
3. One PostgreSQL transaction verifies state and deadline, writes the command
   result/answer, updates the participant score, and writes any durable event.
4. The HTTP response is definitive. The client never waits for an SSE echo to
   decide whether its own command succeeded.
5. A retry with the same `request_id` returns the original stored result and
   cannot double-apply a score.

Presentation editing uses a separate optimistic-concurrency boundary. Every
presentation and slide representation carries a positive monotonic `revision`.
Editor mutations send the last observed value in `If-Match`; PostgreSQL checks
it while holding the existing presentation/slide transaction locks and returns
`409 edit_conflict` instead of silently overwriting a newer edit. Presentation
setting patches merge supplied keys atomically. Activity and Content Item
definitions are validated by the Go API even when a client bypasses the React
editor. This editor revision is not the live session `state_version`; the two
order different domains and must not be conflated.

Answer transactions take a shared lock on the live-session row. Answers from
different participants therefore remain concurrent, while a manager transition
that closes the Activity waits for all already-admitted responses to commit. The
server-side `ends_at` deadline remains authoritative.

## Scoring

`ScoringPolicy` is a replaceable domain interface. The current
`DeductionPolicy` supports exact match or partial multiple-choice scoring:

```text
fraction = max(0, correct_selected - incorrect_selected) / correct_option_count
score    = fraction * time_adjusted_available_points
```

Each accepted answer stores its immutable `score_delta` and atomically adds it
to `participants.score`. Snapshots and leaderboards read the indexed aggregate
instead of summing the full answer history. A policy change must be versioned if
historical sessions need reproducible recalculation.

## SSE, replay, and fan-out

PostgreSQL `live_events` is the replay ledger. Every event has a monotonic
`event_id`, schema version, session/state version, name, payload, and timestamp.
`event_id` orders delivery; `state_version` prevents state-machine regression.
Multiple aggregate events can share one state version and still apply in event
order.

The current single/multi-instance-safe delivery path is:

1. Client fetches an authoritative snapshot.
2. Snapshot returns `last_event_id`.
3. Client connects to SSE using that value as `Last-Event-ID`.
4. API subscribes the connection to one process-local session broker.
5. The broker polls PostgreSQL once per active session per API process, not once
   per SSE connection, and fans events to local subscribers.
6. A slow subscriber whose bounded buffer fills is disconnected. It recovers
   through snapshot plus durable replay; the server never grows memory without
   bound for a slow client.

Presence bursts are compacted so only the newest consecutive
`presence.updated` event in a fetched batch is fanned out, with its
`participant_delta` equal to the number of committed joins in that compacted
burst. The exact count always comes from the snapshot. Answers never produce one
SSE event per participant; canonical `activity.result_updated` is emitted only
after Activity closure and `ranking.updated` carries only an aggregate
participant count when cumulative ranking is shown. Complete rows are never
broadcast. Both result/ranking event families use schema version 2; migrations
normalize retained pre-v2 payloads before replay.

Participant SSE streams announce connection and disconnection in PostgreSQL
(a nullable `participants.disconnected_at`), so a participant who loses the
stream can restore their existing record by rejoining the same session: the
server rotates the credential to the new `request_id`, clears the disconnect
marker, and keeps the row, answers, and score untouched, so
`participant_count` never increases for a restore. An actively connected
display name continues to be rejected with `409 display_name_taken`; a new run
is a new session, so the name joins fresh there. A host reconnection recreates
or resolves the same non-ended session idempotently (`request_id` or
host+presentation lookup), so the run resumes at the exact live point.

Snapshots are role-scoped and read from a single PostgreSQL `REPEATABLE READ`
view. Participants receive public Session state, the active Item, their own
participant/score, aggregate count, and the event cursor. While an Activity is
not yet revealed, the participant snapshot may expose only the boolean
`has_responded` acknowledgement for the active Activity. This lets a refreshed
client recover from a lost HTTP acknowledgement without exposing the submitted
response, correctness, or score delta. Managers receive a bounded snapshot and
fetch roster/leaderboard rows separately with `limit <= 100` and stable keyset
cursors. Joined order uses `(joined_at, id)`; score order uses
`(score DESC, joined_at, id)`.

The React live runtime mirrors this boundary with narrow TypeScript types. A
public join code resolves directly to the active Go live-session ID; the client
also receives only display-safe presentation title/background/image/text
settings for participant theming—never slides, correctness, owner, or roster
data. The client
then joins over HTTP, applies the authoritative role-scoped snapshot, opens SSE
with `Last-Event-ID`, and refreshes snapshot state before reconnecting. JSON
live requests are bounded so a broken network cannot leave the UI waiting
forever. The SSE client treats receipt of response headers as the connection
boundary and uses the server heartbeat as a liveness signal; prolonged stream
silence forces the normal snapshot-plus-replay recovery path. Manager roster
pages are loaded in batches of at most 100; participant projections discard
roster input and never hold a complete score map.

Per-Activity reports are owner-only and bounded. They derive option counts and
`(score_delta DESC, submitted_at, answer_id)` keyset-ranked rows directly from
durable Go answers; no Rust callback or second score ledger is accepted.

Redis Pub/Sub can later replace PostgreSQL polling as the low-latency wake-up
path across instances, but only through an outbox relay from `live_events`.
Redis loss must degrade latency/presence, never lose a durable event or answer.

## Consistency and failure semantics

| Failure | Required behavior |
|---|---|
| duplicate HTTP request | original result, no second mutation |
| stale manager version | `409 Conflict`, snapshot then retry with a new request ID |
| answer after deadline/closure | `409 Conflict`, never scored |
| SSE disconnect | exponential reconnect, snapshot, resume from `last_event_id` |
| half-open/stalled SSE | heartbeat silence watchdog closes the client stream; snapshot then replay |
| lost answer HTTP acknowledgement | snapshot `has_responded` confirms the durable response without pre-reveal disclosure |
| slow SSE client | disconnect; bounded server memory; client recovers |
| API process loss | committed PostgreSQL state survives; client reconnects elsewhere |
| API container address change | web Nginx re-resolves Docker DNS; transient commands retry with the same request ID |
| Redis loss | readiness fails; durable commands continue and identity limits fail open |
| PostgreSQL unavailable | readiness fails and durable mutations fail closed |

## PostgreSQL design rules

- Migrations are ordered and forward-only. Never edit an applied migration.
- Foreign keys and unique constraints enforce ownership and idempotency.
- Hot reads use `participants(session_id, score ...)` and event-ledger indexes.
- Large unbounded lists require pagination or role-scoped projections.
- Replay events for active/non-ended Sessions are never pruned. Ended-Session
  replay events have a 30-day default operational retention window and are
  deleted only by the guarded, batched maintenance command after dry-run review.
  Reports/answers/scores remain durable independently of this replay ledger.
- Pool sizes, statement timeouts, autovacuum, and connection limits are tuned
  from load-test evidence rather than copied from arbitrary defaults.

## Security boundary

- TLS terminates at the trusted ingress in production.
- Manager mutations use opaque server sessions plus CSRF.
- Participant credentials are high-entropy values stored only as SHA-256 hashes
  and sent in scoped HttpOnly cookies, never SSE query strings.
- Production cookies are Secure; CORS and origins must be explicitly restricted.
- Logs must not contain passwords, cookies, credentials, or participant
  responses/correctness before disclosure is allowed.
- Redis coordinates fixed-window limits for register, login, verification,
  Google login, and password reset while hashing the client identifier in keys.
  Identity and live limits fail open during Redis failure so durable commands
  remain available while readiness reports the outage.

## Observability and operations required before production

At minimum expose RED/USE metrics for HTTP, SSE, PostgreSQL, broker subscribers,
dropped slow subscribers, answer acceptance/conflicts and event lag. Event lag
is exported as a bounded histogram so p95/p99 can be alerted rather than inferred
from an average. Host/container CPU, RSS, file descriptors/network and
PostgreSQL CPU/IO/locks come from the deployment platform/database exporter, not
from high-cardinality application labels. Structured logs must not contain
credentials or unrevealed answers; sampled cross-component traces remain a
deployment-level enhancement rather than a release prerequisite for the current
modular monolith.

Deployments require graceful draining: stop accepting new connections, allow
in-flight HTTP transactions to finish, close SSE so clients reconnect, and keep
the old version available until schema/event compatibility is confirmed.

Startup migrations acquire one PostgreSQL advisory lock across replicas. Every
migration and its `schema_migrations` ledger entry commit in one transaction;
`MIGRATION_TIMEOUT` bounds waiting and execution. The production reference binds
the web ingress to loopback, keeps API private, and trusts forwarded client
addresses only from the explicitly configured application subnet.

## Known capacity gaps (truth, not aspirations)

1. Ephemeral presence TTLs and Redis wake-up fan-out are not implemented;
   bounded identity/live rate limiting is implemented.
2. Bounded HTTP/runtime/pool/query/SSE/broker/answer/event-lag metrics exist,
   including an event-lag histogram; production dashboards/alerts still need to
   be wired to the deployment telemetry backend and real ingress.
3. Ended-Session replay retention is defined and guarded in-repository; measured
   PostgreSQL autovacuum/lock/storage tuning still depends on production-like
   load evidence.
4. Local 100 and repeatable 1k protocol evidence exists, but no production-like
   1k or any 5k/10k gate exists; therefore 10k is a target, not a claim.

The capacity gates and evidence rules are in `docs/capacity-plan.md`.
Deployment inputs are recorded in `docs/configuration.md`; the completed
Django/Rust-to-Go parity record is archived under
`docs/archive/legacy-to-go-migration-parity.md`.
