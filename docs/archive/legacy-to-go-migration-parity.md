# Legacy-to-Go migration parity

Status: **historical record**.

This document records the completed Django/Rust-to-Go parity program. It is not
an active roadmap and must not be used to override the current v2 architecture
or status.

See `../status/current.md` for current priorities and production-readiness state.

## Parity summary

Active product flows no longer require Django or Rust services.

| Product behavior | Go implementation | Parity |
|---|---|---|
| register/login/logout/current user | opaque PostgreSQL sessions, HttpOnly cookies, CSRF | implemented |
| email verification/resend | hashed OTP, TTL/attempt/resend controls, SMTP adapter | implemented; provider config required |
| forgot/reset password | one-time hashed token, TTL, SMTP reset link | implemented; provider config required |
| Google login | signed ID-token/JWKS/issuer/audience/expiry/email verification | implemented; provider config required |
| presentation CRUD/settings | owner-scoped PostgreSQL API | implemented |
| editor/content model | validated slides/questions/options, revisions and atomic ordering | implemented |
| live session control | HTTP commands, request idempotency and state versions | implemented |
| participant lifecycle | scoped credential, idempotent join and same-session restore | implemented |
| answers/scoring | deadline/state enforcement, durable answers and aggregate score | implemented |
| role-scoped snapshots | participant-safe snapshot; bounded manager snapshot | implemented |
| roster/leaderboard | manager-only keyset pagination | implemented |
| live delivery | snapshot-first SSE, durable replay and bounded fan-out | implemented |
| question/report results | owner-scoped bounded reads from Go-owned durable data | implemented |

## Deliberate boundary changes

The migration intentionally did not reproduce several legacy implementation
choices:

- Django JWT access/refresh browser storage became opaque server-side sessions
  with cookie auth and CSRF.
- Full quiz/live exports became bounded presentation definitions plus
  role-scoped live snapshots and paginated result/roster reads.
- Rust result ingestion and its second score ledger were removed; Go answers are
  authoritative.
- Persistent access codes are owner-selected and synchronized with the active
  non-ended session.
- Google token handling verifies signatures and claims instead of reproducing
  weaker legacy behavior.
- Django admin was not recreated as a product feature.
- Media remains URL metadata until an object-storage capability is designed as a
  separate product/operations concern.

## Frontend migration relationship

The historical F0-F5 frontend modernization program is archived in
`frontend-f0-f5-2026-08.md`. At the time it completed, the client still had
remaining TypeScript/module migration work; that later work is now complete at
the application-source level. Current debt is tracked in `../frontend-debt.md`.

## Production boundary

Functional parity is not production certification. Production readiness still
depends on the gates in `../status/current.md`, `../capacity-plan.md`,
`../deployment-runbook.md` and `../operations-runbook.md`.
