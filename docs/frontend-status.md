# Frontend status, evidence, and remaining debt

Last reviewed: 2026-08-29. This is the canonical statement of frontend quality.
Completed phase labels do not mean every legacy file is modern, fully typed,
or production-certified.

## Executive assessment

The active frontend is professional and regression-gated for its verified
flows. The entire source tree is not yet top-tier: most UI remains JSX, several
manager/editor surfaces are oversized, visual tokens are not universal,
component/API-state tests are thinner than protocol tests, and field
performance is not measured. These are explicit follow-ups, not hidden F5
claims.

## Current strengths

| Area | Current evidence |
|---|---|
| Product flow | Identity, dashboard, editor, reports, manager live, and participant live use the Go HTTP/SSE boundary. |
| Persian UX | The participant join, waiting, question, content, result, and final leaderboard surfaces use Persian copy, RTL layout, and explicit mixed-content direction. |
| Quiz theming | Public join resolution exposes only display-safe title/background/image/text settings. The whole participant mobile flow uses those settings instead of a hard-coded theme; invalid colors fall back safely and a low-contrast chosen text color receives a WCAG-readable foreground fallback. |
| Live correctness | Snapshot recovery, named commands, stable request IDs, event ordering, participant non-disclosure, and answer retry remain enforced. Closed questions cannot replay as new questions; `show_leaderboard_after` retains `close_question -> show_leaderboard`. |
| Accessibility | Critical routes have axe WCAG gates, keyboard focus, reduced motion, live status semantics, and 390x844 overflow checks. |
| Performance | Build budgets enforce initial JS/CSS, largest route/file, and zero initial preloads. |
| Cleanup | Dead mock archives, an unused game page, and an unused 5,400-line manager leaderboard duplicate were removed. |

## Known weaknesses and concrete remedies

| Priority | Weakness / risk | Required remedy and closure evidence |
|---:|---|---|
| P1 | TypeScript is partial: 49 JSX, 15 JS, 14 TS, and 7 TSX source files. | Migrate live first, then reports/identity/marketing; use discriminated snapshot types and no broad `any`. Close every slice with lint, typecheck, behavior tests, and browser acceptance. |
| P1 | Manager live screens retain legacy structure, debug branches, and duplicated visual patterns. | Extract a typed `modules/live` manager shell and shared theme primitives; remove old route components only after a complete manager/player lifecycle passes. |
| P1 | A deterministic checked-in manager+participant lifecycle is not run on every change. | Add seeded Compose E2E for create -> themed mobile join -> answer -> `show_leaderboard_after` -> participant rank -> reconnect -> end. Assert one question render. |
| P2 | Styling debt remains outside migrated surfaces. Runtime quiz colors are legitimate; repeated chrome colors are not. | Move route by route to semantic tokens and logical `start/end`; record count reduction and 1440x900/390x844 comparisons. |
| P2 | Component/API-state coverage is thinner than protocol coverage. | Add Testing Library + MSW with migrated slices for pending, success, validation, cancellation, conflict, reconnect, and duplicate-submit behavior. |
| P2 | Local Web Vitals are not field performance. | Add stable throttled mobile lab evidence, then privacy-safe production RUM and percentile budgets before claiming field-grade Core Web Vitals. |
| P3 | The development tree has one advisory and stale browser compatibility data. | Review compatible upgrades separately; do not run broad `npm audit fix`. |

## Claim boundary

Do not call the entire frontend “top-tier” until every P1 item is closed,
production RUM and TLS evidence exist, the complete manager/player lifecycle is
a stable browser gate, and no critical active surface sits outside typed module
boundaries. F0-F5 is a professional baseline, not an exemption from this debt.

The exact repository next task remains the production-like TLS 1k protocol
gate. Frontend debt must be scheduled explicitly and cannot waive that evidence.
