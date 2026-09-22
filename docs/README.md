# ProSlides documentation map

This file is the documentation index and authority map. It deliberately does
not repeat the project's current state.

## Read first

1. `../AGENTS.md` — repository-wide development rules and safety rails.
2. `status/current.md` — the single current-state and active-priority source.
3. The architecture document and ADR relevant to the work.
4. OpenAPI, configuration, runbooks, and code in scope.

When documentation and code disagree, verify the implementation and evidence.
Do not silently choose the more convenient source.

## Authority by question

| Question | Authoritative source |
|---|---|
| What is the current state and what work is active? | `status/current.md` |
| What are the system/backend/live invariants? | `architecture.md`, ADR 0001/0002, OpenAPI |
| What is the frontend target architecture? | `frontend-architecture.md`, ADR 0003 |
| What are the Persian UX/design/accessibility rules? | `frontend-professionalization.md` |
| What frontend debt remains? | `frontend-status.md` |
| What frontend measurements were accepted in F5? | `frontend-quality-baseline.md` |
| What proves a capacity level? | `capacity-plan.md` plus dated evidence in `load-test-results.md` |
| Which legacy behaviors have Go parity? | `migration-status.md` |
| Which environment values exist? | `configuration.md` and checked-in examples |
| How do I run and verify locally? | `local-development.md` |
| How is a release deployed? | `deployment-runbook.md` |
| How are backup, restore, rollback and incidents handled? | `operations-runbook.md` |
| What is the external HTTP/SSE contract? | `../apps/api/openapi/openapi.yaml` |
| Why was a durable architecture decision made? | `decisions/` |

## Documentation classes

- **Current state:** mutable and singular. Only `status/current.md`.
- **Architecture/guidelines:** durable rules; update only when the rule changes.
- **ADRs:** decision records; supersede rather than rewrite historical rationale.
- **Runbooks/configuration:** executable operational instructions.
- **Evidence:** dated measurements tied to a commit/topology.
- **Archive:** completed migration/program history that is useful but not current.

The completed frontend F0-F5 history is preserved in
`archive/frontend-f0-f5-2026-08.md`.

## Update lifecycle

| Change | Documentation to update |
|---|---|
| REST/SSE contract | OpenAPI first; architecture/ADR only if an invariant changes; current status only if project state changes |
| persistent data | forward-only migration; OpenAPI when external; operations notes when operational behavior changes |
| configuration/dependency | example env files, `configuration.md`, affected runbooks/health/CI |
| frontend boundary or design rule | frontend architecture/guidelines; ADR only for a durable decision |
| completed frontend debt item | `frontend-status.md` and, when material, `status/current.md` |
| measured load/performance evidence | dated evidence and the relevant plan/status claim |
| deployment/incident process | the affected runbook |
| ordinary implementation detail | usually code/tests only; do not update five documents for ceremony |

Use precise language: `implemented and verified`, `implemented but not
verified because …`, or `not implemented`. A target, screenshot, local
observation or historical benchmark is never production proof.

## Health rule

Do not copy counts, versions, machine paths, "next task" text, or dated evidence
into multiple active documents. Link to the authoritative source instead.
