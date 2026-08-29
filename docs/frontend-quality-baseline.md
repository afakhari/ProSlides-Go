# Frontend F5 quality baseline

Recorded 2026-08-29 on Windows 11, Node 24.11.1, npm 11.6.2, Vite 7.1.14,
and system Chrome 151. This is a frontend regression baseline, not backend
capacity or production Web-Vitals evidence.

## Enforced build budgets

`npm run build` emits a Vite manifest and runs
`scripts/check-bundle-budgets.mjs`. The accepted ceilings are checked in at
`apps/web/bundle-budgets.json`.

| Metric | Measured | CI ceiling |
|---|---:|---:|
| initial JavaScript gzip | 80.50 KiB | 90 KiB |
| initial CSS gzip | 17.31 KiB | 20 KiB |
| largest route JavaScript gzip | 63.89 KiB | 70 KiB |
| largest JavaScript file raw | 269.35 KiB | 300 KiB |
| initial module preloads | 0 | 0 |

The previous substring-based manual chunking preloaded DnD and motion and had
about 252 KiB initial gzip. Native route splitting now keeps editor DnD,
player emoji, and live animation code behind dynamic route boundaries. The
largest route is the participant join page.

## Browser acceptance

The checked Playwright suite runs axe WCAG 2 A/AA, 2.1 A/AA, and 2.2 AA rules
at the stable landing, authentication, dashboard, empty-editor, report, and
unknown-code states. It also asserts:

- one keyboard focus target is visible after tab navigation;
- no horizontal overflow at the mobile viewport;
- reduced-motion produces no running landing animation and globally shortens
  animation/transition duration;
- local system-Chrome landing FCP <= 2,000 ms, LCP <= 2,500 ms, and CLS <= 0.1;
- registration, one-request creation, type-first slide creation, report
  history navigation, logout/login recovery, and invalid-code behavior.

The final run had zero axe violations and all three interaction flows passed.
Earlier baseline failures identified four contrast issues in landing/auth/report
and one fake Upgrade control; those sources were corrected or removed. Live
ordering, reconnect, role non-disclosure, timers, and named join/answer command
behavior remain covered by the protocol/unit suite and the previously recorded
real manager/player Chrome lifecycle.

## Scope and interpretation

These local, unthrottled measurements protect against obvious frontend
regressions. They do not represent field Core Web Vitals, TLS ingress latency,
or the production-like 1k capacity gate. Re-baselining a ceiling requires a
recorded explanation and an inspected production build; do not raise budgets
only to make CI pass.
