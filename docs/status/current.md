# Current project status

Last reviewed: 2026-09-26

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

**V2.7 / issue #89 is complete.** The cleanup program removed the verified legacy
question/slide/leaderboard compatibility boundaries through PRs #114-#122.
Persisted legacy leaderboard Items were removed as a migration-backed boundary
in PR #122. Its post-merge Compose startup exposed a malformed PostgreSQL
dollar-quote delimiter; PR #124 corrected the migration and added an embedded
migration regression guard so the same delimiter defect is rejected by
`go test ./...`.

The final V2.7 baseline is commit
`7b6cf714b94823c6b77bd0f5c92771f0ca511de6`. Post-merge CI #608 is green,
including API readiness on a real PostgreSQL migration path and the full browser
E2E job. Push on main #448 is also green. Issue #89 is closed.

**Active implementation slice: V2.8 / issue #90 — production-readiness
hardening.**

V2.8 now owns the final quality gates: critical browser E2E expansion and
repeatability, accessibility/keyboard/screen-reader review, responsive coverage,
stable-surface visual regression, export/dependency analysis,
security/deployment/restore hardening, load/capacity verification against the
final v2 live protocol, observability/event-retention decisions, and release
readiness.

The first V2.8 hardening boundaries are merged. PR #126 restored browser E2E to
pull requests behind a fast frontend job; PR #127 added bounded repeatability for
critical flows plus responsive/accessibility coverage. PR #128 moved the
remaining hand-rolled modal semantics to focus-managed dialogs. Its browser run
then exposed both an item-picker focus defect and a fail-open aggregate-check
edge case. PR #129 corrected the focus contract and changed the required
aggregate `web` job to run with fail-closed semantics. PR #130 unified the
remaining native-dialog focus lifecycle for manager QR, private ranking and the
Editor image URL flow, including nested Backstage modal behavior. PR CI #628
passed the full browser suite plus repeated critical flows; post-merge CI #629
and Push on main #471 are green.

PR #131 completed the conservative frontend export/dependency boundary. It
added the required `dead-code:check`, removed the surfaced unused-export/dead
symbol baseline rather than normalizing it as exemptions, and documents the
small set of intentional non-static tooling dependencies. PR CI #667 passed all
fast checks, the full browser suite and repeated critical flows; post-merge CI
#668 and Push/CodeQL on main #529 are green.

The active hardening boundary is now security/deployment/restore. The current
slice makes production origin/proxy/provider configuration fail closed in the
API process and turns PostgreSQL backup/restore from runbook-only commands into
checked-in guarded operations exercised against an isolated restored database
in CI. Provider-level snapshots/PITR, production-volume RPO/RTO, and external
secret/network controls remain deployment-environment responsibilities and are
not implied by the repository drill.

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

The main ruleset still requires the `api` and `web` checks. In V2.8, `web`
is an aggregate release gate rather than the fast frontend job itself:
`web-fast` runs dependency review, generated-type checks, lint, typecheck,
architecture checks, unit/component tests and the production build, while
`browser-e2e` runs the real Compose/API/Playwright stack on pull requests,
pushes to `main` and manual workflow runs. The required `web` job uses
`if: always()` and explicitly fails unless both dependencies report
`success`; a failed or skipped browser job therefore cannot satisfy the
required check.

This keeps fast frontend feedback visible without allowing a pull request to
merge before the stable browser flows have passed. The existing `api` required
check remains unchanged, and `containers` remains the browser stack
prerequisite. CodeQL is still a useful non-required security signal.

High-risk live/domain changes continue to verify focused API/domain/protocol
invariants, including idempotency, stale-version conflict, frozen Session
definitions, deadline rejection, reconnect recovery and participant
non-disclosure. Browser E2E is now part of the pull-request path again rather
than a post-merge discovery mechanism.

## Production-readiness boundary

The project is not production-certified.

V2.8 / issue #90 owns final hardening after the v2 product surfaces and live
protocol stabilize. That phase includes:

- expanded/repeated critical browser E2E;
- accessibility and responsive audits;
- visual regression for stable UI;
- enforced export/dependency analysis;
- security/deployment/restore verification;
- production-like load/capacity gates against the **final v2 live protocol**;
- observability and event-retention decisions.

Existing local load and frontend-quality measurements are historical evidence,
not proof of v2 production readiness.
