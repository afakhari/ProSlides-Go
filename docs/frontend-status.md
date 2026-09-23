# Frontend status and remaining debt

Last reviewed: 2026-09-24.

This file tracks frontend debt and claim boundaries. Project-wide current state
and priorities live in `status/current.md`.

## Rollback baseline

The active frontend baseline after the repository rollback is:

```
960dbce
```

Changes after this baseline are not considered part of the current mainline
state unless they are reintroduced through a reviewed change.

## Current strengths

| Area | Evidence/implementation |
|---|---|
| Product flow | Identity, dashboard, editor, reports and live flows use the Go HTTP/SSE boundary. |
| Live correctness | Live runtime ownership remains separated from React rendering concerns, with snapshot/cursor/reconnect/roster responsibilities isolated. |
| Presentation contract | Generated API types and typed domain boundaries exist where migrated; revision conflict handling follows explicit recovery flows. |
| Accessibility | Stable routes have accessibility checks and interaction assertions. |
| Performance | Build budgets and lazy route loading guard against unnecessary frontend growth. |

## Architecture debt

| Priority | Weakness / risk | Required remedy |
|---:|---|---|
| P1 | TypeScript migration is incomplete. Some legacy JSX ownership remains outside the typed module boundaries. | Continue migration by feature/domain boundary, not by mechanical file extension changes. |
| P1 | Legacy top-level ownership (`pages/components/services/utils/routes`) still coexists with the target `app/modules/shared` structure. | Continue vertical migrations and enforce dependency direction. |
| P2 | Design-system adoption is incomplete. Some legacy surfaces may still contain direct styling decisions instead of semantic tokens. | Continue route-by-route migration to shared primitives and semantic tokens. |
| P2 | Component and API-state testing is thinner than protocol/integration coverage. | Add focused tests for pending, validation, conflict, recovery and cancellation states. |

## Editor status

Editor domain work should preserve explicit ownership boundaries:

- drafts remain owned by their domain modules;
- live state must not be merged into editor draft state;
- preview state must not duplicate authoring ownership;
- conflict recovery must preserve user work.

Remaining editor work should focus on cleanup, consistency, accessibility and
coverage rather than introducing another large restructuring pass.

## Claim boundary

The frontend should not be described as fully modular, fully TypeScript, or
complete until the corresponding migration and verification work is closed.

Historical evidence remains tied to the commit and environment where it was
measured and should not automatically be treated as evidence for the current
branch.
