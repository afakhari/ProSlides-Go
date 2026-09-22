# Frontend F0-F5 modernization record

Status: historical record.  
Period: 2026-08-28 to 2026-08-29.

This document preserves the implementation history of the F0-F5 frontend
professionalization sequence. It is not a current-state or architecture source.

## F0 — audit and architecture baseline

The frontend was audited for routing, source size, TypeScript coverage, styling,
dependencies, bundle behavior, and browser flow. ADR 0003 and the modular
`app -> modules -> shared` target were accepted.

## F1 — creation-to-editor continuity

Presentation creation was reduced to one guarded request/navigation, with
Persian pending/retry feedback, an editor-shaped route fallback, responsive
onboarding, and type-first slide creation.

## F2 — application foundation

The frontend introduced a CSS-first semantic token source, typed accessible
notice feedback, a persistent manager shell, a typed Persian catalog, a shared
typed HTTP/API-error boundary for presentation flows, OpenAPI-generated
presentation transport types, and a CI drift check.

## F3 — presentation/editor module extraction

Presentation API/model, dashboard, sharing, and editor code moved under
`modules/presentations`. Editor canvas, slide list, inspector, toolbar and route
boundaries were separated. Dirty/save/conflict state and type-first slide
creation were unified.

## F4 — cleanup

The duplicate/unreachable App runtime, production mock-data dependencies, demo
fallbacks, and dead mock-era components were removed. The route table was
reduced to one active composition root and structural regression checks were
added.

## F5 — measured quality hardening

Axe/browser checks, RTL/reduced-motion/overflow assertions, local Web-Vitals
checks, native route splitting and measured bundle ceilings were introduced.
Numeric live-message dispatch was replaced by named commands and direct
snapshot/event projection.

The accepted 2026-08-29 local build baseline was approximately 80.5 KiB initial
JavaScript gzip, 17.4 KiB initial CSS gzip, 63.5 KiB largest route gzip and zero
initial module preloads.

## Follow-up live UX work

Participant join/wait/question/content/result surfaces were unified around a
Persian mobile-first shell using display-safe presentation theme fields. Closed
questions stopped replaying as fresh timed questions and the explicit
close-to-leaderboard transition was preserved.

## Interpretation

F0-F5 established a professional baseline. They did not complete the
JavaScript-to-TypeScript migration, eliminate all legacy ownership, produce
field Core Web Vitals, or make the complete manager/participant browser
lifecycle a per-change CI gate. Current debt is documented in
`../frontend-status.md`.
