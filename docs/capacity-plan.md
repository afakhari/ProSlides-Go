# Capacity proof plan

## Purpose

This plan defines how a future “supports 10,000 participants” claim must be
proven. Do not mark a capacity level complete from unit tests, a local demo, or
an average latency number. Save the test configuration, commit SHA, environment,
raw results, and bottleneck analysis for every accepted run.

## Reference workload for one live session

| Phase | Workload |
|---|---|
| connect | target users establish authenticated SSE over 120 seconds |
| steady | all streams remain open for 10 minutes with 15-second heartbeats |
| join burst | target users join over 60 seconds; presence is compacted |
| activity open | one manager action; all clients receive state within the event SLO |
| response burst | 80% of users respond within 5 seconds; 100% within 15 seconds |
| reconnect | 20% of SSE clients disconnect and recover through snapshot/cursor |
| closure | manager closes the Activity; aggregate results and any requested overall ranking are published |
| host loss | manager disconnects/reconnects without changing authoritative state |

Test levels are 1,000, then 5,000, then 10,000 concurrent participants. A level
is attempted only after the previous level passes twice without manual repair.

## Initial service-level objectives

These are acceptance thresholds to validate or revise with product evidence:

| Signal | Gate |
|---|---|
| response HTTP latency | p95 <= 500 ms, p99 <= 1 s during burst |
| manager command latency | p95 <= 250 ms, p99 <= 750 ms |
| SSE event propagation | p95 <= 1 s, p99 <= 2 s |
| reconnect recovery | p95 <= 3 s including snapshot |
| mutation error rate | < 0.1%, excluding intentional 409 validation conflicts |
| correctness | zero lost accepted answers, zero double scores, zero invalid transitions |
| API saturation | CPU < 80% sustained; no unbounded goroutine/memory growth |
| PostgreSQL saturation | no pool starvation; lock waits and storage limits documented |

## Required telemetry

- HTTP request count, duration, response status, and in-flight requests by route.
- PostgreSQL pool acquired/idle/max, acquire duration, query latency, errors,
  transaction duration, lock waits, deadlocks, and database CPU/IO.
- Active SSE connections, reconnect behavior, broker sessions/subscribers,
  buffer drops, events published, and ledger-to-client lag. Application event
  lag is a Prometheus histogram so p95/p99 can be evaluated directly.
- Accepted/duplicate/rejected responses and score-update duration.
- Process CPU, RSS, goroutines, GC pauses, file descriptors, and network throughput.

Metrics must use bounded labels. Never label by participant, request, session,
email, or raw error text in a way that creates unbounded cardinality. Process
CPU/RSS/network/file-descriptor metrics and PostgreSQL host CPU/IO/lock/deadlock
metrics are deployment/exporter responsibilities; application `/metrics`
provides request, runtime heap/goroutine, pool/query and live-protocol signals.

## Test topology

Use dedicated load generators separate from the API/database hosts. Record CPU,
RAM, network, PostgreSQL storage class, API replica count, pool configuration,
TLS/proxy settings, Go version, and dataset size. Local Docker Compose is only a
functional gate; it is not capacity evidence.

## Current evidence

The recorded load evidence exercises the **pre-v2 question-specific live
protocol**. It remains useful engineering evidence for the underlying
HTTP/SSE/PostgreSQL foundation, but it does not certify the final v2 Activity
protocol.

The checked-in k6 scenario now drives the canonical v2 presenter-paced Activity
lifecycle and its reconciliation gate checks canonical Activity close/result/
ranking semantics plus durable correctness invariants. This is harness readiness,
not capacity evidence. Production-like capacity gates still have to be executed
and recorded against the final v2 build and named infrastructure.

Role-scoped snapshots, manager keyset pagination, aggregate-only leaderboard
events, bounded subscriber buffers, presence compaction, one ledger poller per
active session/API process, Redis live limits, configurable pools, raised
Nginx/FD ceilings, and bounded HTTP/runtime Prometheus metrics are implemented
and functionally verified. Bounded PostgreSQL pool/query, SSE/broker, live-
answer, and event-lag metrics are also present. The real protocol scenario and
hard SQL reconciliation passed locally at 100 users and twice at 1k with 500
joins/second, both directly and in two consecutive follow-up runs through the
same-origin Nginx ingress. These Docker Desktop runs are recorded in
`docs/load-test-results.md`; they do not include TLS or remote hosts and are not
the production-like 1k gate. Continuous lock sampling and sampled
cross-component traces remain.

## Ordered execution

Current scheduling is recorded in `status/current.md`; this section defines the
capacity sequence and does not compete with that status document.

1. **Completed:** role-scoped/paginated snapshots prevent participant clients
   from downloading a full roster; audience SSE remains aggregate-only.
2. **Completed locally:** bounded metrics, the 100-user protocol run, hard SQL
   reconciliation, consecutive local 1k passes through Nginx, and API-address
   recovery evidence. These are local observations only.
3. **Ready to execute in V2.8:** the final v2 live protocol and canonical
   correctness harness are stable enough to repeat the two-run 1k result on a
   named production-like single API through TLS ingress, including cold
   readiness and continuous CPU/heap/pool/query/lock evidence.
4. Fix measured bottlenecks and rerun the same gate twice.
5. Repeat at 5k with multiple API instances and no sticky sessions.
6. Add Redis outbox wake-up only if event polling/latency measurements require it.
7. Repeat at 10k, including reconnect and answer bursts.
8. Document capacity per infrastructure shape and set alerts from observed headroom.

## Correctness audit after every run

Query PostgreSQL and reconcile:

- accepted HTTP response IDs equal durable response rows;
- each participant/Activity respects that Activity's submission cardinality;
- participant aggregate score equals the sum of immutable scored-response deltas;
- command request IDs are unique and return stable stored results;
- state versions are monotonic;
- every emitted durable event references an existing session and valid state;
- no response committed after the authoritative close/deadline boundary.

Any mismatch fails the run even when latency is excellent.

## Promotion rule

The completed legacy Go-parity program is historical evidence, not a v2 release
gate. ProSlides v2 must finish its product hardening and rerun capacity gates
against the final live protocol before production rollout. Production remains
blocked until the applicable 10k gate, observability, security controls,
backup/restore, graceful drain and tested rollback all pass. Capacity claims
must name the tested infrastructure; never extrapolate linearly beyond measured
results.
