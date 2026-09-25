# Current project status

Last reviewed: 2026-09-25

This is the only mutable current-state document for ProSlides. Durable product
rules live in architecture documents/ADRs; execution order lives in the v2 plan;
historical work lives under `archive/`.

## Current product foundation

ProSlides is a pre-production interactive-presentation platform.

The current implementation uses:

- React/Vite with application source in TypeScript/TSX;
- modular frontend ownership following `app -> modules -> shared`;
- a Go modular-monolith backend;
- PostgreSQL as durable product truth;
- Redis for operational/ephemeral concerns, never the answer/score/event ledger;
- HTTP for commands/queries and SSE for server-to-client live delivery.

The current product still contains legacy question/content/leaderboard concepts
that v2 will migrate incrementally. They remain valid implementation behavior
until the owning v2 slice cuts them over.

## Active program: ProSlides v2

The v2 architecture baseline from PR #81 is merged.

Authoritative sources:

- target product/domain model: `../v2-product-architecture.md`;
- implementation sequence: `../v2-development-plan.md`;
- durable decision: ADR 0004;
- GitHub umbrella: issue #82.

V2.1 / issue #83 is complete via PR #92. Authored Choice Activities use
one canonical versioned Activity definition.

V2.2 / issue #84 is complete via PR #95. Live Sessions now use the generic
`draft | lobby | presenting | ended` lifecycle, Activity response phases are
separate from Session state, Activity results are distinct from cumulative
overall ranking, canonical Activity definitions are frozen into each Session,
and cumulative score ties use competition ranking semantics.

V2.3 / issue #85 is complete via PR #97, with the post-merge browser
expectation aligned by PR #98. Content and Choice authoring now use bounded
registries, the Editor has stable item-rail/canvas/inspector/top-actions
regions, and synthetic leaderboard selection has been removed.

V2.4 / issue #86 is complete via PRs #99, #101 and #104, with post-merge
browser/accessibility corrections in #100, #102 and #103. Participant feedback
is reconnect-safe and personal, the audience Stage is an isolated read-only
projection with bounded ranking, and Backstage owns explicit presenter controls,
private Activity results/top performers, cumulative ranking inspection and
connection/recovery insight. Stage, Backstage and Participant therefore expose
intentionally different capabilities over the same Session.

V2.5 / issue #87 is complete via PR #107, with post-merge correctness and
accessibility corrections in PR #108. Reports are now Session-first:
Presentation history lists distinct live Sessions, each report reads frozen
Session Activity definitions, Activity result/top-performer views remain
separate from cumulative Session ranking, participant response/evaluation
history is bounded, and report reads no longer depend on the removed hot
Session participant counter. The legacy latest-session and question-results
boundaries remain deprecated compatibility paths rather than the report UI
source of truth.

V2.6 / issue #88 implementation is complete via PRs #109 and #110.
Poll remains a product preset over canonical Choice with evaluation/scoring
disabled. Word Cloud proves the canonical Text Activity primitive end to end:
bounded text responses are normalized and frozen with canonical terms, the
existing generic Activity lifecycle accepts them without a new Session state,
and Stage, Backstage and Session-first reports render word-frequency
aggregation without correctness, scoring or ranking semantics.

The pre-V2.7 stabilization gate is complete via PR #111. The audit closed
a participant SSE non-disclosure gap for unrevealed Activity results, tightened
Persian Word Cloud aggregation normalization, reconciled live-contract/version
documentation, refreshed vulnerable transitive web-tooling lock entries, and
removed the remaining Stage hook warning found during the same pass. The
resulting dependency install reports zero known vulnerabilities on the CI
Node/npm toolchain.

PR #111 is merged into `main`; its post-merge CI #555 was green, including the
full browser E2E job. PR #113 subsequently removed a cache-sensitive Report E2E
waiter exposed by CI #557. The final verified pre-V2.7 baseline is CI #560 plus
Push on main #399, both green. V2.6 / issue #88 is therefore closed.

**Active implementation slice: V2.7 / issue #89 — remove verified legacy
question/slide/leaderboard compatibility paths.**

The first cleanup boundary, PR #114, removes `question_draft` from the
authored-item contract and its backend/frontend/live compatibility adapters.

PR #115 is the next verified authoring cleanup: migrations 0017 and 0018 already
upgraded persisted authored Questions and frozen live-session Question snapshots
to canonical Choice Activities, so the deprecated Question creation endpoint,
generic `kind: question` translator, legacy Editor read adapter and their dead
OpenAPI shapes are removed. Post-merge CI #566, including browser E2E, and Push
on main #405 are green.

PR #116 moves the maintained k6 and Compose integration scenarios onto the
same canonical Activity contract: `present_item`, `close_activity`,
`reveal_activity`, `show_overall_ranking`, versioned Activity responses,
current SSE event names and Session-first Activity reports. State-version
chaining comes from each authoritative command response rather than hard-coded
transition counts. A temporary branch-only verification workflow exercised the
full Compose integration matrix and a pinned SSE-enabled 10-participant k6
smoke against PostgreSQL/Redis/API: the matrix passed, all 32 k6 checks passed,
join/answer/SSE success rates were 100%, no HTTP request failed, and the final
database reconciliation passed. The temporary workflow was removed before
merge and is not part of the product CI surface.

Other legacy paths, including numeric `slide_type`, Choice response
compatibility inside production boundaries, deprecated question-result reads
and persisted leaderboard compatibility, remain until their replacements are
verified independently.

v2 is a staged migration of the existing system, not a rewrite.

### v2.0 scope locks

- presenter-paced live only;
- individual participation only;
- no team mode;
- no self-paced/assignment mode;
- no parallel internal `/api/v2`;
- no generic flow/workflow DSL;
- no framework/toolchain upgrade mixed into a domain redesign unless required.

Changing one of these locks requires updating the v2 architecture decision
before implementation.

## Correctness that must survive every v2 slice

- presentation edits preserve `If-Match` revision conflict behavior;
- live command retries reuse stable `request_id`;
- manager commands preserve `expected_state_version`;
- live Sessions use frozen authored definitions and are not mutated by later
  editor changes;
- PostgreSQL remains authoritative for accepted responses, scores and events;
- live clients recover snapshot-first and resume SSE from `last_event_id`;
- participant projections and event streams never retain or deliver
  manager-only roster, score-map or unrevealed Activity-result/correctness data;
- server deadline/closure remains authoritative for response acceptance.

These are migration constraints, not reasons to keep legacy naming forever.

## Development mode

Speed of pre-production product redesign is the current priority.

Keep cheap/high-signal guardrails continuously:

- OpenAPI/generated type consistency when contracts change;
- Go tests/vet for affected backend packages;
- frontend lint, TypeScript and architecture checks;
- stable domain/protocol tests;
- focused component/API-state tests for behavior that is expensive to rediscover.

Do not freeze temporary UI with broad snapshot/state-matrix coverage solely to
increase a coverage number.

Deferred frontend debt is tracked in `../frontend-debt.md`.

## Pull-request safety net

Required `web` and `api` CI checks are the normal merge gates.

During active v2 redesign, pull requests run only the cheap container
configuration validation. The full Docker/browser E2E stack is intentionally
deferred to pushes on `main` and manual workflow runs because registry pulls,
image builds and Playwright installation dominate iteration cost. CodeQL remains
a useful non-required security signal.

High-risk live/domain slices still verify the invariant they change with focused
API/domain/protocol tests, including idempotency, stale-version conflict, frozen
Session definitions, deadline rejection, reconnect recovery and participant
non-disclosure. Browser E2E failures on `main` must still be investigated
before continuing into another risky slice.

V2.8 / issue #90 restores the stable critical browser flows to the pull-request
gate after the final v2 live protocol and UI surfaces stop moving.

## Production-readiness boundary

The project is not production-certified.

V2.8 / issue #90 owns final hardening after the v2 product surfaces and live
protocol stabilize. That phase includes:

- expanded/repeated critical browser E2E;
- accessibility and responsive audits;
- visual regression for stable UI;
- deferred export/dependency analysis;
- security/deployment/restore verification;
- production-like load/capacity gates against the **final v2 live protocol**;
- observability and event-retention decisions.

Existing local load and frontend-quality measurements are historical evidence,
not proof of v2 production readiness.
