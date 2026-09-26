# ProSlides documentation map

This is the documentation index and authority map. It does not duplicate current
project state.

## Read order

1. `../AGENTS.md` — repository-wide engineering and safety rules.
2. `status/current.md` — current implementation baseline and remaining release gates.
3. The durable architecture/product/ADR document relevant to the change.
4. Runbooks, configuration, debt and evidence only when the work needs them.

When code and documentation disagree, verify the implementation and update the
authoritative document rather than preserving two narratives.

## Active authority map

| Question | Authoritative source |
|---|---|
| What is implemented now and what still blocks release? | `status/current.md` |
| What is the current product/domain model? | `v2-product-architecture.md`, ADR 0004 |
| What are the system/backend/live invariants? | `architecture.md`, ADR 0001/0002/0004, OpenAPI |
| What are the frontend technical boundaries? | `frontend-architecture.md`, ADR 0003/0004 |
| What are the Persian UX/design/accessibility rules? | `frontend-professionalization.md` |
| What frontend debt is intentionally deferred? | `frontend-debt.md` |
| What proves a capacity level? | `capacity-plan.md`; dated results live under `archive/` |
| Which environment values exist? | `configuration.md` + checked-in examples |
| How do I run and verify locally? | `local-development.md` |
| How is a release deployed? | `deployment-runbook.md` |
| How are backup, restore, retention, rollback and incidents handled? | `operations-runbook.md` |
| What is the external HTTP/SSE contract? | `../apps/api/openapi/openapi.yaml` |
| Why was a durable decision made? | `decisions/` |

## Historical records

Completed programs and dated evidence live under `archive/`.

Important records include:

- completed V2.1-V2.8 repository delivery plan;
- dated local live-load measurements;
- the F0-F5 frontend modernization program and F5 quality baseline;
- the completed Django/Rust-to-Go parity record.

Archive documents explain how the current system was reached. They do not set
current priorities or override current architecture/status without new evidence.

## Documentation classes

- **Current state:** mutable and singular; only `status/current.md`.
- **Product/architecture:** durable current model and invariants.
- **Debt register:** explicitly deferred work that should not masquerade as the current plan.
- **ADRs:** decision history; supersede with a new ADR rather than rewriting rationale.
- **Runbooks/configuration:** executable operational instructions.
- **Evidence/archive:** dated measurements and completed delivery programs.

There is intentionally no active repository roadmap document after completion of
the V2.1-V2.8 repository program. Environment release evidence is tracked by
GitHub issue #90 and summarized in `status/current.md`.

## Update lifecycle

| Change | Documentation to update |
|---|---|
| product/domain decision | product architecture; new ADR when the decision is durable |
| current implementation/release gate | `status/current.md` + relevant GitHub issue |
| REST/SSE contract | OpenAPI first; architecture/ADR only if an invariant changes |
| persistent data | forward-only migration; OpenAPI when external; runbook only for operational behavior |
| frontend boundary/design rule | frontend architecture or product/UX guidelines |
| deferred frontend debt | frontend debt register |
| measured load/performance evidence | dated archive evidence + capacity/status only when the claim changes |
| configuration/dependency | example env files, configuration reference and affected runbooks |
| deployment/incident process | affected runbook |
| ordinary implementation detail | usually code/tests only |

## Health rules

- Do not maintain a second current-status document.
- Do not recreate a completed roadmap as an active plan.
- Do not copy exact moving commit SHAs or "next task" prose across several files.
- Historical measurements remain historical.
- Use precise claims: `implemented and verified`, `implemented but environment evidence pending`, or `not implemented`.
- Delete/archive obsolete active documentation instead of leaving stale files beside replacements.
