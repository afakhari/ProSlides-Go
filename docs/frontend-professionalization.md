# ProSlides frontend product and UX guidelines

## Purpose

This document owns durable Persian-first product experience rules. It does not
track implementation phases or current source counts. Current status is in
`status/current.md`; frontend debt is in `frontend-status.md`; historical
F0-F5 delivery is archived in `archive/frontend-f0-f5-2026-08.md`.

## Product language and direction

Persian is the default user-facing language. Product chrome, validation, empty
states, loading states and accessibility labels are Persian and RTL.

API fields, URLs, logs, code identifiers and developer documentation remain
English. User-authored presentation content may be Persian, English or mixed
and must use safe direction boundaries rather than forced alignment.

## Experience principles

1. Navigation preserves spatial context. Route/data loading uses a
   context-shaped skeleton instead of unrelated full-screen loading.
2. Every mutation exposes pending, success when needed, and recoverable error
   behavior. Duplicate submission is blocked.
3. Validation is actionable and stays near the relevant field.
4. Disabled controls communicate why when the reason is not obvious.
5. Empty states identify the next useful action.
6. Unimplemented controls are hidden or explicitly unavailable.
7. Motion is functional, normally short, and respects reduced-motion settings.
8. Keyboard, focus, screen-reader behavior and touch targets are definition of
   done, not post-launch polish.
9. Runtime presentation theming may change visual mood without changing basic
   interaction/accessibility semantics.
10. Responsive behavior is designed, not merely shrunk.

## Design-system contract

All product areas share one semantic design-system kernel even when they use
different themes.

Shared semantics include:

- typography hierarchy;
- spacing rhythm;
- radii and elevation;
- focus treatment;
- field/error/help behavior;
- disabled/loading states;
- dialog/menu/popover behavior;
- feedback colors and live-region rules;
- motion duration/easing categories.

Marketing, manager/dashboard, editor and live participant surfaces may use
different theme values. A theme does not invent new meanings for "danger",
"focus", "disabled" or "surface".

## Forms

Forms use semantic labels, descriptions and field errors. Errors should not be
communicated by color alone.

Persian/Arabic digit entry is accepted where users naturally type numeric
values. Display formatting may use Persian digits, while API/domain
representation stays canonical. Numeric identifiers remain strings.

Password policy/help copy must be generated from or tested against the actual
validation contract so guidance cannot drift from backend/OpenAPI rules.

## Feedback and errors

Use one feedback policy:

- field validation next to the field;
- form-level errors near the form;
- transient success/status in an accessible status region;
- destructive confirmation through an accessible alert dialog;
- network/server recovery with retained user context and retry when safe;
- edit conflicts explain that newer server state exists and provide a clear
  recovery action.

Do not expose raw backend/internal English messages as primary Persian UI copy.
Use stable machine-readable error codes and localized client messages.

## Responsive behavior

Regression anchors remain 390x844 mobile and 1440x900 desktop. Test intermediate
sizes when layout changes.

Editor/live controls must account for safe areas and virtual-keyboard pressure.
Reusable components should respond to their container when appropriate rather
than assuming the whole viewport defines available space.

Avoid physical-direction assumptions. Prefer logical layout so RTL behavior is
structural rather than a collection of exceptions.

## Accessibility

Target WCAG 2.2 AA.

Required behavior includes:

- semantic headings/landmarks/forms/tables;
- visible, unobscured focus;
- keyboard access to all actions;
- accessible names for icon-only controls;
- correct dialog focus containment/restoration;
- no pointer-only essential interaction;
- meaningful async/live announcements without noise;
- reduced motion;
- usable touch targets;
- readable contrast across allowed runtime themes.

Automated axe checks are a gate, not a substitute for keyboard/manual review.

## Motion

Motion should explain continuity, hierarchy or state change. Avoid long
decorative animation that delays work.

Route/editor transitions may use platform/React transition capabilities where
appropriate; richer live effects may use a motion library behind the route
boundary. All effects require reduced-motion behavior.

## Browser acceptance

Material UI changes should be checked in a real browser for:

- desktop and mobile anchor sizes;
- relevant intermediate/container states;
- RTL and mixed LTR content;
- keyboard focus/order;
- reduced motion;
- horizontal overflow;
- console/network errors;
- pending/error/recovery paths.

Static screenshots alone do not prove interaction quality.
