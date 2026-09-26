# Frontend debt register

Last reviewed: 2026-09-26.

This document tracks frontend debt that is useful to remember but should not
masquerade as release-blocking work.

Current implementation/release state lives in `status/current.md`. The
completed v2 delivery plan is archived.

## Debt that remains

| Priority | Debt / risk | Handling |
|---:|---|---|
| P2 | Some mature surfaces still use older utility-color styling and inconsistent logical-direction details. | Fix when materially changing that surface; do not run a standalone cosmetic rewrite. |
| P2 | Component/API-state coverage remains intentionally selective outside high-risk behavior. | Add tests when a change affects costly state/recovery behavior; do not chase a coverage percentage. |
| P3 | Visual regression is intentionally selective: stable desktop landing, mobile authentication and deterministic mobile participant-join baselines are protected; broader non-critical/stateful surfaces are not snapshotted by default. | Extend only when a surface is stable and the failure signal justifies baseline maintenance; keep behavioral E2E authoritative for dynamic editor/live/report flows. |
| P3 | The live frontend still projects canonical v2 snapshots/Items into a historical question-shaped internal view model used by mature presenter/participant components. | Treat it as internal refactor debt, not a protocol compatibility surface. Replace it only as those components are materially redesigned; do not destabilize the production-readiness gate for naming cleanup. |
| P3 | Major framework/toolchain upgrades remain isolated from product/release hardening. | Upgrade only for a concrete requirement or in a dedicated compatibility change. |

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

## Handling policy

Resolve debt opportunistically when a product change already owns the affected
surface or when measurements show a real maintenance/accessibility/performance
cost. Do not reopen broad migration or cosmetic cleanup programs solely to make
internal names newer.
