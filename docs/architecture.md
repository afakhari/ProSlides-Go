# ProSlides target architecture

## Status and intent

This is the target and current architecture for the Go migration. It is designed
to scale to a measured 10,000 concurrent participants in one live session, but
that capacity is **not yet certified**. Certification requires the workload and
gates in `docs/capacity-plan.md`; architecture alone is not proof.

The governing design is a Go modular monolith with PostgreSQL as the durable
system of record, Redis for optional ephemeral coordination, HTTP for commands,
and SSE for server-to-client delivery. It deliberately avoids the operational
cost of microservices and a message broker until measurements justify them.

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

The browser remains a React 19/Vite single-page application. Its accepted
incremental target is:

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

New or substantially changed UI is TS/TSX at module boundaries. Existing JSX
migrates by feature, with lint/typecheck coverage expanding in the same change.
Styling uses one Tailwind v4/CSS semantic-token source and logical RTL-aware
properties. Local component state stays local; no global store, state machine,
SSR framework, microfrontend, or separate design-system package is added absent
a measured need.

The complete current-state audit, target tree, state ownership, styling,
testing, performance policy, and F0-F5 migration gates live in
`docs/frontend-architecture.md`; the decision rationale is ADR 0003. The
Persian UX order and viewport/accessibility acceptance gates live in
`docs/frontend-professionalization.md`.

## Module boundaries

| Module | Owns | Must not own |
|---|---|---|
| `identity` | accounts, password hashes, email verification/reset delivery, Google verification, opaque sessions, CSRF | live state or scores |
| `presentations` | presentations, slides, question definitions | accepting answers |
| `live` | live state machine, participants, answers, scoring, snapshots, events | account lifecycle |
| `reports` (future) | immutable post-session projections and exports | live command handling |
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
setting patches merge supplied keys atomically. Question and content slide
definitions are validated by the Go API even when a client bypasses the React
editor. This editor revision is not the live session `state_version`; the two
order different domains and must not be conflated.

Answer transactions take a shared lock on the live-session row. Answers from
different participants therefore remain concurrent, while a manager transition
that closes the question waits for all already-admitted answers to commit. The
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
burst. The exact count always comes from the snapshot. Answers never produce
one SSE event per participant; `answer.stats` is emitted after closure and
`leaderboard.updated` carries only an aggregate participant count when the
leaderboard is shown. Complete rows are never broadcast. Newly written
leaderboard notifications use event schema version 2; retained version-1 array
payloads are reduced to their count by the PostgreSQL adapter before replay,
without rewriting the durable ledger.

Snapshots are role-scoped and read from a single PostgreSQL `REPEATABLE READ`
view. Participants receive public session state, active slide, their own
participant/score, aggregate count, and the event cursor. Managers receive a
bounded snapshot and fetch roster/leaderboard rows separately with `limit <=
100` and stable keyset cursors. Joined order uses `(joined_at, id)`; score order
uses `(score DESC, joined_at, id)`.

The React live runtime mirrors this boundary with narrow TypeScript types. A
public join code resolves directly to the active Go live-session ID; the client
also receives only display-safe presentation title/background/image/text
settings for participant theming—never slides, correctness, owner, or roster
data. The client
then joins over HTTP, applies the authoritative role-scoped snapshot, opens SSE
with `Last-Event-ID`, and refreshes snapshot state before reconnecting. Manager
roster pages are loaded in batches of at most 100; participant projections
discard roster input and never hold a complete score map.

Per-question reports are owner-only and bounded. They derive option counts and
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
- The event ledger needs a measured retention/archive policy before production.
- Pool sizes, statement timeouts, autovacuum, and connection limits are tuned
  from load-test evidence rather than copied from arbitrary defaults.

## Security boundary

- TLS terminates at the trusted ingress in production.
- Manager mutations use opaque server sessions plus CSRF.
- Participant credentials are high-entropy values stored only as SHA-256 hashes
  and sent in scoped HttpOnly cookies, never SSE query strings.
- Production cookies are Secure; CORS and origins must be explicitly restricted.
- Logs must not contain passwords, cookies, credentials, or answers before a
  question closes.
- Redis coordinates fixed-window limits for register, login, verification,
  Google login, and password reset while hashing the client identifier in keys.
  Identity and live limits fail open during Redis failure so durable commands
  remain available while readiness reports the outage.

## Observability and operations required before production

At minimum expose RED/USE metrics for HTTP, SSE, PostgreSQL, broker subscribers,
dropped slow subscribers, answer acceptance/conflicts, replay size, event lag,
and active sessions. Structured logs need request/session IDs; traces must sample
hot paths rather than recording every answer at full rate.

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
2. Bounded HTTP/runtime/pool/query/SSE/broker/answer/event-lag metrics exist;
   continuous lock sampling and sampled cross-component traces remain. Real
   ingress validation is pending.
3. Event retention/compaction and measured PostgreSQL tuning are undefined;
   pool size/lifetime controls now exist.
4. Local 100 and repeatable 1k protocol evidence exists, but no production-like
   1k or any 5k/10k gate exists; therefore 10k is a target, not a claim.

The ordered capacity work and pass/fail thresholds are in
`docs/capacity-plan.md`. Deployment inputs and migration status are recorded in
`docs/configuration.md` and `docs/migration-status.md`.
