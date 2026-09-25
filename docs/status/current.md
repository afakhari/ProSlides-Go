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

**Active implementation slice: V2.1 / issue #83 — Item and Activity domain
foundation.**

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
- participant projections never retain manager-only roster, score-map or
  unrevealed correctness data;
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

`containers`/browser E2E and CodeQL remain useful non-required integration and
security signals during the current single-developer pre-production phase.
Investigate failures that plausibly come from the changed boundary; do not wait
on unrelated non-required work merely for ceremony.

High-risk live/domain slices explicitly verify the invariant they change, such
as idempotency, stale-version conflict, frozen Session definitions, deadline
rejection, reconnect recovery or participant non-disclosure.

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
