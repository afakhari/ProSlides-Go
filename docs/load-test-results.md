# Live load-test evidence

This file records measured results, including failed experiments. The measured
runs below exercise the pre-v2 question-specific live protocol. They remain
historical evidence for the underlying system but do not certify the final v2
Activity protocol or production capacity.

The checked-in load scenario and reconciliation harness have since been migrated
to the canonical v2 Activity lifecycle. That makes the next run meaningful; it
does not retroactively convert the measurements below into v2 evidence. Raw k6
summaries and before/after Prometheus scrapes are kept under ignored
`.tmp/load-results/` on the machine that ran the test.

## 2026-08-23 local Compose topology

- One Go API process, PostgreSQL 16, Redis 7.4, and one k6 process on Docker
  Desktop 29.7.2 (`x86_64`, 8 logical CPUs, 5.7 GiB Docker memory).
- API PostgreSQL pool: max 50. The original accepted runs called the private
  `api:8080` container endpoint with a steady-state pool. Follow-up runs on
  2026-08-24 called the public same-origin `web:8080` Nginx endpoint and thus
  included Nginx proxying and no-buffer SSE behavior. TLS, internet latency,
  and a remote load generator were not measured.
- Base Git commit: `dbeb9bd10b5da4add562543fe9eb299d358409da`; the tested live hardening was an
  uncommitted working tree and must not be represented as that base commit.
- k6 binary: v1.2.2 plus `xk6-sse` v0.1.12, SHA-256
  `014a9ab52db0206fab5c1391141354837ad37f320e923f2bfedef5d9fdc2902a`.
- Final protocol script SHA-256:
  `0321837262e580b632d412612bcc9b44215a0f011402463dd8ce3b1c4120849f`.
- Reconciliation SQL SHA-256:
  `343b3bfd8e52c044fa8031e88080f0393d9608fd2fbd513d4355e3d1bba714c3`.

The protocol starts in the lobby. Participants join, fetch a snapshot, and
open authenticated SSE. The manager then opens the question; each participant
submits one HTTP answer from the `question_open` event. Ten seconds later the
manager closes the question and every stream must receive `question_closed`.

## Accepted local results

| Run | Join shape | Answer p95 / p99 | Close-event lag p95 | HTTP/check result | Durable audit |
|---|---:|---:|---:|---|---|
| 100 protocol users (`4c495623-e047-4647-aa8d-f05d7ad85c49`) | simultaneous | 68.14 / 71.60 ms | 217.05 ms | 0 failures; 301/301 checks | 100 participants/answers; pass |
| 1k protocol run 1 (`f6cee552-d347-42a7-8b06-7ad1f89a6308`) | 500 joins/s | 345.99 / 365.98 ms | 293 ms | 0 failures; 3001/3001 checks | 1000 participants/answers; pass |
| 1k protocol run 2 (`760991e7-19b9-4c9a-977b-e96e1a1e717b`) | 500 joins/s | 338.11 / 352.79 ms | 216 ms | 0 failures; 3001/3001 checks | 1000 participants/answers; pass |
| Nginx 100 (`3921152c-587b-4fc9-8006-cd5060e847f9`) | 100 joins/s | 427.65 / 430.38 ms | 252 ms | 0 failures; 301/301 checks | 100 participants/answers; pass |
| Nginx 1k run 2 (`c6937262-d5d9-49ec-8a89-c1a4d276a423`) | 500 joins/s | 456.86 / 472.69 ms | 176.04 ms | 0 failures; 3001/3001 checks | 1000 participants/answers; pass |
| Nginx 1k run 3 (`ad1731f3-ef58-424d-b7c6-09cf14285ed0`) | 500 joins/s | 417.41 / 440.67 ms | 193 ms | 0 failures; 3001/3001 checks | 1000 participants/answers; pass |

Both 1k audits reported zero score mismatches, duplicate answers, duplicate
participant request IDs, state-version regressions, invalid event versions, or
answers after the close boundary. Pool acquisition cancellation, slow SSE
subscriber drops, broker database failures, and internal answer failures were
also zero. The two runs accumulated 951.55 and 237.94 seconds of pool wait,
respectively, which is why production-like pool/lock sampling remains required.

## Findings that changed the implementation

- An instantaneous exploratory 1k run exposed pool saturation and failed the
  answer SLO. Combining snapshot reads, making answer+score one SQL statement,
  moving join idempotency into its transaction, and reconciling deadlines in
  the snapshot transaction removed thousands of SQL calls/acquisitions.
- Concurrent SSE startup caused a `LatestEventID` thundering herd. Broker
  stream creation is now single-flight per session and rejects initialization
  after shutdown.
- A post-restart exploratory run showed materially worse latency before the
  pool reached its configured steady-state size. Startup now waits for pgx to
  establish `DATABASE_POOL_MIN_CONNS`; deployment still has to choose a minimum
  that fits its total PostgreSQL connection budget and cold-start SLO.
- Raising the single API pool from 50 to 80 made latency worse and was reverted.
  Pool size must be measured per topology rather than increased by assumption.
- The first Nginx 1k attempt committed all 1,000 answers and passed every
  correctness check, but answer p95 was 581.88 ms and failed the 500 ms SLO.
  The next two independent runs passed at 456.86 and 417.41 ms. This warm local
  variability is why the production gate requires two consecutive runs plus
  cold-start evidence rather than selecting the best sample.
- A deliberately malformed load setting closed a question while answers were
  starting and exposed a nullable-deadline scan that returned 500 instead of
  the correct 409 conflict. The store now treats a cleared deadline as closed,
  and the load script rejects non-numeric duration settings before provisioning.
- Nginx previously resolved the Compose API address only at startup. Its
  upstream now uses Docker DNS dynamically and keeps bounded upstream idle
  connections. With the Web container unchanged, a forced API address move
  from `172.18.0.4` to `172.18.0.6` recovered from transient 502 responses to
  the expected API response on the eighth one-second probe.

## What this does not prove

The local 1k passes are functional/performance evidence for this named machine
only. The Nginx follow-up covers the application ingress configuration, but it
does not satisfy the production-like 1k gate because TLS, remote network
behavior, cold deployment acceptance, production database storage, continuous
lock sampling, and multi-replica behavior were absent. No 5k or 10k claim is
permitted from these results.
