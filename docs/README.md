# ProSlides documentation map

This is the documentation index and authority map. It does not duplicate current
project state.

## Read order

1. `../AGENTS.md` — repository-wide engineering and safety rules.
2. `status/current.md` — current state and active slice.
3. For v2 work: `v2-product-architecture.md` and
   `v2-development-plan.md`.
4. The architecture/ADR/OpenAPI documents relevant to the change.
5. Runbooks, configuration and evidence only when the work needs them.

When code and documentation disagree, verify the implementation and update the
authoritative document instead of silently choosing the convenient version.

## Active authority map

| Question | Authoritative source |
|---|---|
| What is implemented now and what is active? | `status/current.md` |
| What is the v2 product/domain target? | `v2-product-architecture.md`, ADR 0004 |
| What order should v2 work follow? | `v2-development-plan.md`, GitHub issue #82 |
| What are the system/backend/live invariants? | `architecture.md`, ADR 0001/0002/0004, OpenAPI |
| What are the frontend technical boundaries? | `frontend-architecture.md`, ADR 0003/0004 |
| What are the Persian UX/design/accessibility rules? | `frontend-professionalization.md` |
| What frontend debt is intentionally deferred? | `frontend-debt.md` |
| What proves a capacity level? | `capacity-plan.md` + `load-test-results.md` |
| Which environment values exist? | `configuration.md` + checked-in examples |
| How do I run and verify locally? | `local-development.md` |
| How is a release deployed? | `deployment-runbook.md` |
| How are backup, restore, rollback and incidents handled? | `operations-runbook.md` |
| What is the external HTTP/SSE contract? | `../apps/api/openapi/openapi.yaml` |
| Why was a durable decision made? | `decisions/` |

## Historical records

Historical material is indexed in `archive/README.md`. It includes the legacy
Django/Rust-to-Go parity record, the F0-F5 frontend program and its dated F5
quality baseline.

Archive/evidence documents explain previous decisions and measurements. They do
not set current priorities and must not be promoted into current claims without
new verification.

## Documentation classes

- **Current state:** mutable and singular; only `status/current.md`.
- **Product/architecture:** durable target and invariants.
- **Execution plan:** ordered work; currently `v2-development-plan.md`.
- **Debt register:** deferred work that should not compete with the active plan.
- **ADRs:** immutable decision history; supersede with a new ADR rather than
  rewriting rationale.
- **Runbooks/configuration:** executable operational instructions.
- **Evidence:** dated measurements tied to a commit/topology.
- **Archive:** completed programs and historical context.

## Update lifecycle

| Change | Documentation to update |
|---|---|
| v2 product/domain decision | v2 product architecture; ADR only for a durable decision |
| v2 sequencing/acceptance criteria | v2 development plan + relevant GitHub issue |
| REST/SSE contract | OpenAPI first; architecture/ADR only if an invariant changes |
| persistent data | forward-only migration; OpenAPI when external; operations notes only if operational behavior changes |
| frontend boundary/design rule | frontend architecture or product/UX guidelines |
| deferred frontend debt | frontend debt register |
| measured load/performance evidence | dated evidence + capacity plan/status only when the claim changes |
| configuration/dependency | example env files, configuration reference and affected runbooks |
| deployment/incident process | affected runbook |
| ordinary implementation detail | usually code/tests only |

## Health rules

- Do not maintain a second current-status document.
- Do not duplicate the v2 roadmap in frontend/backend documents.
- Do not copy exact current commit SHAs or "next task" prose across several files.
- Historical measurements remain historical.
- Use precise claims: `implemented and verified`,
  `implemented but not verified because ...`, or `not implemented`.
- Delete or archive obsolete active documentation instead of leaving a stale
  file beside its replacement.
