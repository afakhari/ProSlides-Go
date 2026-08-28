# ProSlides: mandatory development guide

This is the entry document for every human or AI agent working in this
repository. Read it completely before inspecting, changing, generating, or
deleting code. It is the operational source of truth; if it conflicts with the
repository, investigate the discrepancy, correct this document in the same
change, and state the discrepancy in the final handoff.

## Sixty-second orientation

Read in this order: this file, `docs/AI_HANDOFF.md`, `docs/architecture.md`,
`docs/capacity-plan.md`, the relevant ADR, then the OpenAPI and code in scope.

The goal is to replace the historical Django/Rust/WebSocket backend with a
maintainable Go modular monolith and HTTP/SSE protocol without losing product
behavior. Correctness and durable recovery come before low-latency acceleration.
The current branch contains functional Go coverage for active product flows,
not a production-certified 10k system. The single next task is specified below.

## Product and non-negotiable decisions

ProSlides is a capacity-oriented, interactive presentation platform in the
Kahoot/AhaSlides category: presentations, quizzes, polls, word clouds, Q&A,
live sessions, scoring, leaderboards, and reports.

- The target is a future-ready system that can be proven at 10,000 participants
  in one live session before scaling beyond that.
- The backend is a Go **modular monolith**, not Django, Rust, or microservices.
- Client commands use HTTP; server-to-client live updates use SSE. Do not add a
  WebSocket feature unless the owner explicitly approves a documented,
  measured two-way need.
- PostgreSQL is the durable source of truth. Redis currently provides readiness
  and distributed identity rate limits and may later accelerate fan-out,
  presence, and cache; it must never be the only copy of a command, answer,
  score, or report.
- Start with the smallest maintainable component set. Do not introduce Kafka,
  RabbitMQ, NATS, ClickHouse, MongoDB, Kubernetes, or a microservice solely for
  anticipated scale.

The historical Django/Rust implementation was intentionally removed from this
branch. Its history remains in Git and `master`; do not restore legacy code as
a shortcut.

## Current repository state — 2026-08-28

| Area | Actual state | Rule for next work |
|---|---|---|
| `apps/api` | Go API with immutable per-run slide definitions, database-clock deadlines and automatic closure, actor-scoped idempotency, recoverable question stats, bounded live requests/rate limits, reduced live SQL/acquire paths, single-flight SSE stream creation, synchronously warmed minimum PostgreSQL pools, bounded HTTP/pool/query/live metrics, graceful SSE drain, plus the previously verified identity/content/report flows | Preserve ownership/role boundaries and never accept an external score ledger. Provider secrets belong only in deployment configuration. |
| `apps/web` | Functional React 19/Vite SPA. F1 and two F2 foundation slices are verified: semantic tokens/accessible feedback plus a persistent protected-manager shell, recoverable route error boundary, and typed Persian catalog consumed by dashboard/editor/share. Migration remains partial: 54 JSX, 15 JS, 9 TS, and 4 TSX files; most UI is still outside `tsc`, legacy runtime/mock adapters remain, and HTTP transport is duplicated. | Continue incrementally toward `app -> modules -> shared` using `docs/frontend-architecture.md`; the next F2 slice must create one typed shared HTTP/API-error boundary for manager presentation reads/mutations without changing HTTP contracts or touching live/report routes. Preserve auth behavior, live ordering/recovery, participant non-disclosure, revision conflicts, and idempotent command retries. |
| PostgreSQL | PostgreSQL 16; migrations `0001`-`0015`; authoritative users/content/settings/editor revisions/access codes/OTP and reset hashes/sessions/frozen run definitions/answers/scores/events | Durable data belongs here. Add forward-only migrations only. |
| Redis | Redis 7.4 provides readiness and fixed-window identity plus live join/answer/action/reconnect limits; live fan-out/presence acceleration is not implemented | It may accelerate ephemeral work, never replace the event/answer ledger. |
| CI | GitHub Actions validates Go tests/race, web lint/typecheck/unit/build, both Compose contracts, and API/web image builds | Keep CI passing and add checks with new tooling. |
| Tests | Web lint/current partial TS+TSX typecheck/34 unit tests/build, 3 passing Playwright system-Chrome E2E flows, real-Chrome F1 desktop/mobile snapshots, request audit, no-overflow/no-console-error and reduced-motion checks, Go tests/vet, Compose matrices, image smoke, and the prior local 100/1k evidence. Production-like 1k/5k/10k gates do not exist. | Treat `tsc` as partial until migrated UI coverage expands. Keep browser artifacts ignored and treat local/browser evidence as bounded functional proof only. |

The working branch is `feat/go-platform-foundation`. It uses a separate Git
worktree, so `master` remains available to teammates. Do not merge, force-push,
or modify `master` without explicit owner approval.

## Repository map

```text
apps/
  api/                       Go API
    cmd/api/                 composition root; process lifecycle only
    internal/platform/       config, HTTP, Postgres, Redis, observability
    internal/<module>/       module-specific application, domain, adapters
    internal/platform/migrate/sql/ ordered, embedded, forward-only SQL migrations
    openapi/                 REST and SSE contract source
  web/                       React client, progressive JS -> TypeScript migration
load/k6/                     pinned live HTTP/SSE load scenario and SQL audit
docs/
  README.md                  documentation authority map and update lifecycle
  AI_HANDOFF.md              precise execution plan and handoff template
  architecture.md            architecture boundaries
  capacity-plan.md           workload, SLOs, telemetry, and 1k/5k/10k gates
  load-test-results.md       measured local runs, fingerprints, and limitations
  configuration.md           API/web environment and deployment checklist
  local-development.md       complete stack, hot reload, verification, troubleshooting
  deployment-runbook.md      images, dependencies, secrets, TLS/SSE ingress, rollout
  operations-runbook.md      backup, restore, rollback, rotation, incident checks
  migration-status.md        Django/Rust parity and remaining production work
  frontend-architecture.md   frontend boundaries, target tree, migration gates
  frontend-professionalization.md Persian-first UX phases and acceptance gates
  decisions/                 Architecture Decision Records
AGENTS.md                    this mandatory guide
docker-compose.yaml          local web + API + PostgreSQL + Redis stack
deploy/                      production Compose/env/ingress references
```

## Installed Codex workflow skills

The following official personal skills are installed under
`C:\Users\AVAJANG\.codex\skills`. They are developer tooling, not application
dependencies, and become discoverable from the next Codex turn.

| Skill | Trigger and rule |
|---|---|
| `security-best-practices` | Use only for an explicit Go or JavaScript/TypeScript security review, report, or secure-by-default request. Load the matching frontend and backend references before findings or fixes. |
| `playwright` | Use for terminal-driven real-browser interaction. It is CLI-first, requires `npx`, snapshots before element references, and stores artifacts under ignored `output/playwright/`. Keep the repository's `@playwright/test` suite for explicit automated-test requests. |
| `gh-fix-ci` | Use only for failing GitHub Actions PR checks. Inspect checks/logs first, summarize and propose a plan, then implement only after explicit approval. External CI providers remain out of scope. |
| `yeet` | Use only when the owner explicitly requests the complete stage, commit, push, and PR flow. Preserve existing PR draft/review state and update an existing branch PR instead of creating a duplicate. |

`gh-fix-ci` and `yeet` require `gh auth status` to succeed with repository and
workflow access before use; ordinary Git credential-manager push success does
not satisfy that prerequisite. The Playwright wrapper requires Node/npm `npx`.
Python 3.13.15 is installed user-scoped for the skills' helper scripts.

Dependency flow inside the API is strictly:

```text
HTTP handler -> application/use case -> domain -> repository or infrastructure adapter
```

Domain code must not import HTTP/framework concerns. Only the `live` module can
advance session state, change scores, or close/open a question.

## Live protocol contract

Commands are HTTP and must return their definitive result; clients must not
wait for an SSE echo to decide whether a command succeeded.

```text
POST /api/v1/live/sessions/{sessionId}/join
POST /api/v1/live/sessions/{sessionId}/answers
POST /api/v1/live/sessions/{sessionId}/actions
GET  /api/v1/live/sessions/{sessionId}/snapshot
GET  /api/v1/live/sessions/{sessionId}/events       # text/event-stream
```

Every mutation carries `request_id`; manager mutations also carry
`expected_state_version`. A duplicate request returns the original result and
must not create a second answer or score.

Every event must be documented and versioned in `apps/api/openapi/` with at
least `event_id`, `schema_version`, `session_id`, `state_version`,
`occurred_at`, and `payload`. Current names are `session.created`,
`presence.updated`, `session.state_changed`, `answer.stats`, and
`leaderboard.updated`; never use opaque numeric messages.

`event_id` orders delivery and replay. `state_version` orders state-machine
changes, but several aggregate events may legitimately share the same state
version. Clients reject a state regression; they must not discard a newer
`event_id` merely because its state version equals the last applied version.

The state machine is:

```text
draft -> lobby -> content | question_open -> question_closed -> leaderboard -> ended
```

Answers are accepted only during `question_open` and before server `ends_at`.
Invalid transitions return `409 Conflict`. Never broadcast one event per answer.
The process-local broker polls once per active session (not per connection),
uses bounded subscriber buffers, and compacts presence bursts. Clients first
fetch the snapshot, then connect with its `last_event_id` as `Last-Event-ID`.
Slow clients are disconnected and recover; server memory must remain bounded.

## Capacity invariants and current gaps

- 10,000 concurrent participants in one session is the target workload, not a
  verified claim. The only valid proof is `docs/capacity-plan.md` on a recorded
  production-like topology.
- HTTP success means the durable mutation committed. SSE is delivery/recovery,
  not command acknowledgement.
- Answer writes remain concurrent; closure cannot pass an admitted answer.
- Score reads use `participants.score`, not repeated full-history aggregation.
- PostgreSQL polling grows with active sessions/API replicas, not SSE clients.
- Redis failure must not lose answers, scores, command results, or replay events.
- Known blockers before a serious 10k run: production-like cold/warm 1k proof,
  continuous PostgreSQL lock sampling, real TLS/ingress validation, event
  retention, measured multi-replica database tuning, and staged 5k/10k evidence.
  Bounded HTTP/runtime/pool/query/SSE/broker/answer metrics, pool controls, live
  admission limits, and local 100/two-run 1k evidence now exist but are not
  production capacity proof.

## Required workflow for every change

1. Read this file, then `docs/AI_HANDOFF.md`, then the files relevant to the
   requested scope.
2. Inspect `git status --short --branch`. Preserve unrelated changes; never
   reset, checkout, delete, or overwrite them.
3. For a REST or event contract change: edit OpenAPI first, implement API and
   web consumer second, then add/update contract and behavior tests.
4. Keep migrations forward-only. Never edit an applied migration, reset a
   database, purge Redis, or delete data without explicit owner authorization.
5. Use structured logs with request/session/participant identifiers. Never log
   secrets, access tokens, answers before closure, or personally identifying
   data beyond what the product requires.
6. Run the applicable verification commands in `docs/AI_HANDOFF.md`.
7. Update this file and `docs/AI_HANDOFF.md` whenever a material implementation,
   contract, decision, known risk, tool prerequisite, or next task changes.
8. In the final handoff state: files changed, behavior delivered, verification
   run and result, work not verified, and exactly one recommended next task.

## Completion criteria and safety rails

A task is not complete merely because code compiles. It is complete when its
contract, error behavior, tests, documentation, and operational consequence are
consistent. New external behavior needs an OpenAPI entry; new configuration
needs `.env.example` documentation; new persistent data needs a migration;
new operational dependency needs Compose, health/readiness, and CI coverage.

Before production, require TLS, secure/HttpOnly cookies or short-lived SSE
tickets, CSRF protection for mutations, restricted CORS, disabled proxy
buffering for SSE, appropriate timeouts/heartbeats, OpenTelemetry/metrics, and
load tests. Long-lived JWTs in an SSE query string are prohibited.

## Single exact next task

Implement the third frontend F2 foundation slice: create one typed shared HTTP
client and stable API-error type, then migrate only manager presentation reads/
mutations used by dashboard/editor/share to it. Preserve credentials, CSRF,
`AbortSignal`, `If-Match`, request counts, and existing error codes; do not add
a query cache or touch live/report routes.

Acceptance: migrated code has one base-URL/JSON/error implementation; auth
expiry is surfaced through the existing notice path; creation remains one
request/navigation and editor writes retain revisions; cancellation and 409
conflicts remain distinguishable; lint, expanded typecheck, 39+ unit tests,
build, and the three real-Chrome E2E flows pass.

The production-like TLS 1k proof remains mandatory and unchanged, but is queued
after the owner-prioritized frontend F1-F5 sequence. It is not completed or
waived by frontend work.

## Phases and the single next task

- [x] Phase 0a: choose Go modular monolith + PostgreSQL + Redis + HTTP/SSE.
- [x] Phase 0b: establish monorepo, Go bootstrap, Compose, initial schema,
  contract skeleton, CI, architecture documents, and remove legacy stack.
- [x] Phase 0c: PostgreSQL and Redis adapters, safe dependency readiness,
  configuration validation, route tests, and API contract documentation.
- [x] **Phase 1a:** identity contract, schema, password/session primitives,
  PostgreSQL adapter, secure cookie handlers, and the real Compose auth matrix
  are implemented and verified.
- [x] Phase 1: identity, content, quizzes, presentations, slides, reports, and
  React Go-API consumers. Media remains URL metadata; object storage is a
  separate production capability, not a missing Django upload endpoint.
- [x] Phase 2: functional live state machine, commands, role-scoped snapshots,
  SSE, idempotency, timers, scoring, bounded fan-out, replay, and React
  WebSocket-to-SSE migration. Redis wake-up/presence TTL and capacity proof are
  later scale work, not functional parity gaps.
- [ ] Phase 3: bounded telemetry and staged k6 scenarios for 100/1k/5k/10k
  users, reconnects, host disconnects, and answer bursts; document measured SLOs.
- [ ] Phase 4: feature-flagged cutover and exercised rollback only after
  production gates pass. Do not merge legacy code into this branch.

Frontend modernization is a separate ordered track:

- [x] Phase F0: audit the runtime, styles, typing, dependencies, bundle, and
  browser flow; accept ADR 0003 and document the target architecture.
- [x] Phase F1: creation-to-editor continuity, guarded mutations, Persian RTL
  onboarding, responsive editor chrome, and real-browser acceptance.
- [ ] **Phase F2 — in progress:** tokens/feedback and the protected-manager
  shell/error boundary plus typed Persian catalog are implemented; the typed
  shared HTTP/API-error boundary is the exact next slice.
- [ ] Phase F3: presentation/editor module extraction and responsive editor
  information architecture.
- [ ] Phase F4: remove legacy runtime/mock production dependencies and extend
  TypeScript, lint, and tests over migrated UI.
- [ ] Phase F5: performance/accessibility hardening and measured regression
  budgets, followed by resumption of the production-like capacity gate.

## Change log

| Date | Change | Verification / consequence |
|---|---|---|
| 2026-08-18 | Go-first capacity architecture selected | Replaces Django/Rust/WebSocket direction. |
| 2026-08-18 | Foundation created and repository reset to `apps/api` + `apps/web` | Legacy sources/docs removed only on feature branch; `master` preserved. |
| 2026-08-18 | Added Compose, initial PostgreSQL schema, OpenAPI skeleton, CI, ADR, and web migration notes | Web lint/unit/build and Compose configuration passed; Docker daemon was unavailable. |
| 2026-08-18 | Made this guide and `AI_HANDOFF.md` the explicit AI handoff protocol | Future agents must update both for material changes. |
| 2026-08-18 | Registered existing Go 1.26.6 installation in the user PATH and ran API formatting/tests | `go fmt ./...` and `go test ./...` passed; Docker daemon remains unavailable. |
| 2026-08-18 | Added the AI execution handoff and completed the local verification matrix | Web lint, 12 web unit tests, web build, Go tests, Compose syntax, and diff hygiene passed; `npm ci` reports 20 dependency vulnerabilities for later reviewed remediation. |
| 2026-08-18 | Added PostgreSQL/Redis clients and truthful `/readyz` | `healthz` remains process-only; `readyz` reports only safe per-dependency states and returns 503 on missing, failed, or timed-out dependencies. |
| 2026-08-18 | Replaced blocked `gcr.io` runtime image with Docker Hub Alpine non-root runtime | Docker build and real Compose `healthz`/`readyz` passed with PostgreSQL and Redis. |
| 2026-08-18 | Began identity boundary with forward-only opaque-session schema and OpenAPI contract | `0002_identity_sessions.sql`, `SESSION_TTL`, and register/login/logout/me contract added; HTTP auth behavior is not implemented yet. |
| 2026-08-18 | Wired identity HTTP handlers into the Go API | Application routes are present; PostgreSQL-backed auth route integration tests remain required. |
| 2026-08-18 | Added embedded forward-only migration runner | API applies tracked schema migrations before serving; auth runtime validation remains next. |
| 2026-08-18 | Corrected overly strict email parser comparison | Go identity tests pass; repeat the full Compose auth flow before declaring auth complete. |
| 2026-08-18 | Added Compose auth-matrix script and corrected registration success status to 201 | Go tests, Compose startup, and the full register/login/me/logout/CSRF matrix passed. |
| 2026-08-18 | Defined owner-scoped presentation read contract | `GET /api/v1/presentations/{presentationId}` documents authentication, ordered slides, and non-disclosing 404 behavior. |
| 2026-08-18 | Implemented owner-scoped presentation read slice | PostgreSQL adapter, authenticated handler, composition wiring, and behavior tests pass. |
| 2026-08-18 | Verified presentation read against Compose | Embedded presentation schema migration, owner read, ordered slides, and non-owner 404 passed end to end. |
| 2026-08-18 | Implemented and verified presentation creation | CSRF-protected owner creation and subsequent owner read passed through Compose. |
| 2026-08-18 | Implemented and verified slide creation | Contract, CSRF-protected handler, owner-scoped PostgreSQL write, Go behavior tests, and Compose flow passed. |
| 2026-08-18 | Implemented question creation with single/multiple choice | Question validation requires two options and correct answers; single has exactly one correct option. |
| 2026-08-18 | Verified question creation against Compose | Content and multiple-choice question slides were created and read back through the API. |
| 2026-08-18 | Implemented the durable live-session backend vertical slice | Forward-only live schema, versioned state transitions, idempotent commands/join/answers, deduction-based partial scoring behind `ScoringPolicy`, snapshots, aggregate answer/leaderboard events, and `Last-Event-ID` SSE replay passed Go and Compose tests. |
| 2026-08-18 | Removed two immediate high-load bottlenecks | Durable aggregate participant scores replace repeated answer-history sums; bounded per-session event brokers replace per-SSE-connection database polling; snapshots expose a recovery cursor and presence bursts are compacted. Capacity still requires the documented load gates. |
| 2026-08-19 | Implemented role-scoped snapshots and manager pagination | Participant snapshots expose only public state, self/score, counts, active slide, and cursor; manager roster/leaderboard uses bounded stable keyset pages; leaderboard SSE is aggregate-only. Go, Compose, and web checks passed. |
| 2026-08-19 | Replaced the React live WebSocket runtime with typed HTTP + SSE | Snapshot-first recovery, event/version ordering, Go join-code resolution, participant non-disclosure (including correctness metadata), incremental manager paging, exhaustive UI/state navigation tests, web tests/build, Go tests/vet, and the real Compose matrix passed. |
| 2026-08-19 | Migrated dashboard, editor, reports, and password-reset domain to the Go API | Owner CRUD/settings/slides/reorder/duplicate/results, cookie+CSRF route guards, bounded report/preview pages, one-time hashed reset tokens, and expanded authorization/non-disclosure Compose tests passed. The original auth UI was retained; provider delivery followed in the next parity commit. |
| 2026-08-19 | Completed remaining Django product parity in Go | Added keyed email OTP, SMTP verification/reset delivery, secure Google token verification, Redis identity limits, atomic slide insertion/movement, owner-only per-question results from durable Go answers, frontend adapters, OpenAPI/migration/tests/docs; Go/web/Compose and both GitHub CI runs passed. |
| 2026-08-19 | Added the first real-browser E2E smoke and fixed issues it exposed | System Chrome now verifies responsive auth, registration/login/logout, presentation and slide creation, report/history navigation, and invalid join codes. Local analytics is disabled, report fetches abort cleanly, expected invalid codes do not log errors, and Add Slide is keyboard-accessible. |
| 2026-08-19 | Installed official Codex security, browser, CI-fix, and publish skills | `security-best-practices`, `playwright`, `gh-fix-ci`, and `yeet` are available from the next turn; documented their narrow triggers, artifact path, approval boundary, and `npx`/Python/`gh auth` prerequisites. |
| 2026-08-23 | Added a reproducible local/production deployment path | Full-stack Compose now includes a production React/Nginx image; env interpolation includes SMTP credentials; advisory-locked transactional migrations, trusted-proxy client IPs, API/web health checks, reference production Compose/TLS ingress, and local/deploy/operations runbooks were added and verified with Go, web, image, and stack smoke checks. |
| 2026-08-23 | Exercised and corrected the complete quiz editor/live browser flow | Question timing/scoring validation is shared by save/present; option IDs/order and question saves are durable and atomic; type conversion normalizes correctness; empty queues and ended-session reruns are safe; manager/player startup avoids guaranteed 404/401 probes; SSE presence updates the lobby; unavailable score deltas are hidden; and logout aborts stale fetches. Go/web checks, 26 unit tests, Compose integration, system-Chrome E2E, and real manager/player edit/answer/leaderboard flows passed. |
| 2026-08-23 | Reworked quiz creation/editing around a typed canonical boundary and revision-aware writes | Forward-only migration `0013` adds presentation/slide revisions; OpenAPI and Go reject malformed question/content definitions and stale `If-Match` edits; settings merge by key; the editor saves each mutation once, selects by stable ID, supports question/content conversion and editing, isolates derived leaderboard IDs, shares save/present validation, and recovers conflicts. Web lint/typecheck/31 unit tests/build, Go tests/vet, both images, health/readiness, and the preserved-volume Compose integration matrix passed; no browser was opened for this change. |
| 2026-08-23 | Added persistent owner-selected quiz access codes and direct public join links | Migration `0014`, OpenAPI, Go and React now enforce case-insensitive unique 5-12 character codes, use them for new sessions, atomically replace the current active-session code, and resolve `/{accessCode}` for participants. Go tests/vet, web lint/typecheck/32 unit tests/build, image builds, OpenAPI parsing, and the preserved-volume Compose matrix passed, including old-link invalidation and uniqueness; no browser E2E was run. |
| 2026-08-23 | Defined the Persian-first frontend professionalization program | The initial F1-F4 UX plan made creation-to-editor continuity owner-prioritized without changing independent capacity gates; the 2026-08-28 audit supersedes its phase detail with F0-F5. |
| 2026-08-23 | Enabled local mobile-device browser testing | A real Compose stack published web on `0.0.0.0:5173` while API, PostgreSQL, and Redis stayed loopback-only; both loopback and `192.168.100.10:5173` returned HTTP 200, API readiness passed, the web build passed, and Vite advertised LAN addresses. The local runbook documents IPv4, firewall, reset-link, and opt-out settings. |
| 2026-08-23 | Hardened the complete live-quiz lifecycle and LAN participant flow | Migration `0015` freezes run definitions and enforces one active run; PostgreSQL-clock deadlines close durably; idempotency is actor-scoped; snapshots recover stats/rank; active runs resist destructive reset/delete; React recovery is monotonic and LAN-safe; Redis limits, request bounds/timeouts, pool controls, bounded metrics, graceful SSE failure/drain, and raised Nginx/FD limits were added. Go tests/vet, web lint/typecheck/32 tests/build, preserved-volume Compose integration, Nginx config, migration, and a real Chrome mobile join over `192.168.100.10` passed. A 100-user scenario was added, but its pinned `xk6-sse` build did not resolve locally, so no 100/1k/5k/10k capacity claim was made. |
| 2026-08-23 | Measured and optimized the live protocol through local 1k | The pinned k6 build was recovered with proxy-to-direct fallback. Query metrics exposed pool pressure; snapshot/answer/deadline/join round trips were reduced; SSE initialization became single-flight; configured minimum pool readiness became synchronous; and the load model now follows lobby → snapshot/SSE → question-open event → HTTP answer → close. The 100-user run and two local 1k runs met SLOs with zero HTTP/check/correctness failures. `docs/load-test-results.md` records fingerprints and limitations; production-like 1k, 5k, and 10k remain unproven. |
| 2026-08-24 | Verified and hardened the public Nginx live path | A nullable closed-question deadline now maps late/concurrent answers to 409 instead of 500; SSE metric flushing no longer emits duplicate-header warnings; load settings fail fast; and Nginx dynamically re-resolves API addresses with upstream keepalive. Nginx passed 100 users and two consecutive local 1k runs with durable reconciliation; a forced API IP change recovered without restarting Web. One preceding 1k sample missed answer p95 and remains documented. TLS/remote production-like 1k became the next capacity gate and remains queued/unproven. |
| 2026-08-28 | Audited and fixed the frontend modernization documentation | ADR 0003 and `docs/frontend-architecture.md` define the incremental React/Vite `app -> modules -> shared` target, routing/state/style/type/test boundaries, measured current debt, and F0-F5 gates. Conflicting next-task statements were resolved in favor of owner-prioritized F1; the independent production-like TLS 1k gate remains queued and unproven. No runtime code changed. |
| 2026-08-28 | Completed frontend F1 creation-to-editor continuity | Dashboard creation is guarded to one request/navigation with Persian pending/retry feedback; route and data loading use an editor-shaped TSX skeleton; empty presentations provide focused first-slide onboarding and open responsive Persian type selection after the intentional create action. Dashboard/editor chrome is RTL, fake controls were removed, and the toolbar exposes only working features. Lint, TS/TSX typecheck, 34 unit tests, build, healthy rebuilt API/Web images, three system-Chrome E2E flows, real-Chrome request audit, 1440x900/390x844 screenshots, no overflow/console errors, and reduced motion passed. |
| 2026-08-28 | Completed the first frontend F2 foundation slice | `index.css` now owns Tailwind and CSS-first semantic tokens; typed `shared/ui/Notice.tsx` owns pending/success/warning/error live-region behavior. Dashboard/editor/share use the shared feedback and brand/feedback tokens, native alerts in that slice are removed, Persian share copy and explicit `auto`/LTR boundaries are present, and the duplicate Tailwind import is gone. Lint, expanded TS/TSX typecheck, 37 unit tests, build, and real Chrome at 1440x900/390x844 passed with no horizontal overflow or console errors. F2 remains in progress. |
| 2026-08-28 | Completed the second frontend F2 foundation slice | Dashboard/editor now share one authenticated manager shell with a route-local Suspense fallback and recoverable Persian render-error boundary. A typed Persian catalog is consumed by dashboard/editor/share, and session guarding moved behind a typed TSX boundary without changing auth behavior. Lint, expanded typecheck, 39 unit tests, build, and all three system-Chrome E2E flows passed. F2 remains in progress. |

## References

- `docs/README.md` — documentation authority map, reading order, and lifecycle.
- `docs/AI_HANDOFF.md` — exact next task, commands, acceptance criteria, and
  final-response template.
- `docs/architecture.md` — boundaries and scale design.
- `docs/capacity-plan.md` — exact high-load workload, SLOs, metrics, and proof gates.
- `docs/configuration.md` — complete API/web environment and deployment checklist.
- `docs/local-development.md` — clean-machine start, hot reload, tests, and troubleshooting.
- `docs/deployment-runbook.md` — immutable build, dependency, TLS/SSE, and rollout procedure.
- `docs/operations-runbook.md` — backup/restore, rollback, rotation, and incident procedure.
- `docs/migration-status.md` — current parity matrix, evidence, and remaining work.
- `docs/frontend-architecture.md` — audited current frontend, target boundaries, and migration gates.
- `docs/frontend-professionalization.md` — Persian-first UX direction, phases, and acceptance gates.
- `docs/decisions/0001-go-modular-monolith.md` — architecture decision record.
- `docs/decisions/0002-durable-events-and-bounded-sse-fanout.md` — replay/fan-out and backpressure decision.
- `docs/decisions/0003-modular-react-frontend.md` — incremental modular React frontend decision.
- `apps/api/openapi/openapi.yaml` — contract source of truth.
