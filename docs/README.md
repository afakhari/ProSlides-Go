# ProSlides documentation map

## Start here

Read repository work in this order:

1. `AGENTS.md` — mandatory rules, current state, and the one exact next task;
2. `AI_HANDOFF.md` — detailed evidence, environment facts, verification, and
   handoff format;
3. the architecture document for the scope;
4. the relevant ADR;
5. OpenAPI, configuration/runbooks, and code in scope.

When two documents conflict, do not choose silently. Verify against code and
evidence, update every affected source in the same change, and record the
discrepancy in the handoff.

## Authority by question

| Question | Authoritative document |
|---|---|
| What is the current state and exact next task? | `../AGENTS.md`, then `AI_HANDOFF.md` |
| What are the backend and live invariants? | `architecture.md`, ADR 0001/0002, and OpenAPI |
| What is the frontend target and migration order? | `frontend-architecture.md` and ADR 0003 |
| What should Persian UX look and behave like? | `frontend-professionalization.md` |
| What frontend accessibility and bundle budgets are enforced? | `frontend-quality-baseline.md` |
| What is the honest frontend quality status and remaining debt? | `frontend-status.md` |
| What proves 1k/5k/10k? | `capacity-plan.md`; observations in `load-test-results.md` |
| Which Go/legacy behaviors have parity? | `migration-status.md` |
| Which environment values exist? | `configuration.md` and checked-in examples |
| How do I run and verify locally? | `local-development.md` |
| How is a release deployed? | `deployment-runbook.md` |
| How are backup, restore, rollback, and incidents handled? | `operations-runbook.md` |
| What is the external HTTP/SSE contract? | `../apps/api/openapi/openapi.yaml` |

ADRs explain durable decisions; they do not replace current-state or execution
documents. Historical change-log statements are evidence from their date, not
the present priority.

## Current position — 2026-08-29

- Backend product/API parity is functionally implemented in the Go modular
  monolith; production certification is incomplete.
- Local Docker evidence includes accepted 100 and repeated 1k runs, including
  Nginx, but no production-like TLS 1k/5k/10k gate has passed.
- The frontend is functional but still mixes legacy JavaScript/view models and
  partial TypeScript with inconsistent architecture/styles.
- Frontend F0-F3 are complete. Presentation API/model, dashboard, sharing, and
  editor UI are owned by `modules/presentations`; OpenAPI transport generation,
  CI drift checks, type-first slide creation, responsive editor navigation, and
  unified dirty/save/conflict state are verified. F4 cleanup is the exact next
  task, followed by F5 hardening.
- The production-like TLS 1k gate remains mandatory and is queued after F5.

This priority order is scheduling, not a capacity or production waiver.

## Documentation lifecycle

Update documentation in the same change as behavior:

| Change | Required documentation |
|---|---|
| REST/SSE behavior | OpenAPI first, architecture if invariant changes, AGENTS, AI_HANDOFF |
| persistent data | forward-only migration, OpenAPI if external, operations consequence, AGENTS, AI_HANDOFF |
| configuration/dependency | `.env.example`, `configuration.md`, Compose/deploy/runbooks, health/CI coverage |
| frontend module/style/UX | frontend architecture, professionalization plan, AGENTS, AI_HANDOFF; ADR if decision changes |
| load or production proof | raw artifact location, `load-test-results.md`, `capacity-plan.md`, AGENTS, AI_HANDOFF |
| deployment/incident process | deployment or operations runbook plus AGENTS/AI_HANDOFF when status or next task changes |

Use only `implemented and verified`, `implemented but not verified because …`,
or `not implemented`. Never turn a target, local observation, screenshot, or
architecture claim into production evidence.

## Document health rule

Every material handoff must leave exactly one next task in `AGENTS.md` and
`AI_HANDOFF.md`. Dates, test counts, paths, phase status, and provider/tool facts
must be corrected when they become stale. Do not bulk-update an evidence record
merely to make its date look current.
