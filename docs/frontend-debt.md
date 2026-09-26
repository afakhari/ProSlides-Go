# Frontend debt register

Last reviewed: 2026-09-26.

This document tracks frontend debt that is useful to remember but should not
compete with the active ProSlides v2 roadmap.

Current project state and the active slice live in `status/current.md`.
v2 sequencing lives in `v2-development-plan.md`.

## Debt that remains

| Priority | Debt / risk | Handling |
|---:|---|---|
| P2 | Some mature surfaces still use older utility-color styling and inconsistent logical-direction details. | Fix when the v2 slice redesigns that surface; do not run a standalone cosmetic rewrite. |
| P2 | Component/API-state coverage is intentionally selective outside the existing representative dashboard coverage. | Add tests only for high-risk behavior touched by a v2 slice; broaden state matrices in V2.8 hardening. |
| P3 | Stable-surface visual regression and broader non-critical browser-state matrices remain intentionally selective. | Add them only where the surface is stable and the failure signal justifies snapshot/state maintenance. |
| P3 | The live frontend still projects canonical v2 snapshots/Items into a historical question-shaped internal view model used by mature presenter/participant components. | Treat it as internal refactor debt, not a protocol compatibility surface. Replace it only as those components are materially redesigned; do not destabilize the production-readiness gate for naming cleanup. |
| P3 | Major framework/toolchain upgrades remain isolated from the product redesign. | Upgrade only when required or after v2 surfaces stabilize, with dedicated compatibility verification. |

## Continuous guardrails

These are not deferred debt and remain active during v2:

- TypeScript/TSX for application frontend source;
- `app -> modules -> shared` dependency enforcement;
- unreachable-file, unused-export and direct-dependency analysis with reviewed exemptions;
- generated OpenAPI contract checks;
- editor revision/conflict semantics;
- snapshot-first live recovery and participant non-disclosure;
- focused unit/component coverage for expensive behavioral invariants;
- build budgets and route-level lazy loading.

## v2 relationship

Resolve debt opportunistically when a v2 slice already owns the affected
surface. Do not open parallel cleanup programs that slow the v2 sequence.

Anything still relevant after V2.7 moves into the production-readiness
hardening work tracked by V2.8 / GitHub issue #90.
