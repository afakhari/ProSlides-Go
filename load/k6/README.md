# Live protocol load scenario

This scenario exercises the canonical v2 presenter-paced Activity lifecycle.
It is regression/capacity evidence for the current live foundation, but final
production capacity claims still require the V2.8 gates and topology recorded
in `docs/capacity-plan.md`.

This scenario is a capacity test tool, not a release gate during rapid v2 UI/
domain redesign. It provisions one real manager, Presentation, Choice Activity,
and Session through HTTP, then runs the configured number of participants
through join, snapshot, authenticated SSE, and canonical Activity response.
The manager presents the Activity only after clients begin subscribing;
participants respond after the durable `session.state_changed` transition to
`presenting/accepting`, and the manager closes it through
`close_activity`. Teardown reveals the Activity, shows the overall ranking and
ends the Session using authoritative state versions returned by each command.
It never writes scores outside the API.

Build the pinned SSE-enabled binary, then run from the repository root against
Compose:

```powershell
New-Item -ItemType Directory -Force .tmp/k6 | Out-Null
New-Item -ItemType Directory -Force .tmp/k6-go,.tmp/k6-build-cache | Out-Null
docker run --rm -e GOPATH=/home/xk6/go `
  -e "GOPROXY=https://proxy.golang.org|direct" -e GOSUMDB=sum.golang.org `
  -v "${PWD}/.tmp/k6:/output" `
  -v "${PWD}/.tmp/k6-go:/home/xk6/go" `
  -v "${PWD}/.tmp/k6-build-cache:/home/xk6/.cache/go-build" `
  grafana/xk6:1.3.5 `
  build v1.2.2 --with github.com/phymbert/xk6-sse@v0.1.12 `
  --output /output/k6
New-Item -ItemType Directory -Force .tmp/load-results | Out-Null
docker run --rm --network proslides-go-platform_default `
  -v "${PWD}/.tmp/k6:/tools:ro" -v "${PWD}/load/k6:/scripts:ro" `
  -v "${PWD}/.tmp/load-results:/results" `
  --entrypoint /tools/k6 grafana/k6:2.2.0 `
  run --summary-export=/results/live-smoke-100.json `
  -e BASE_URL=http://api:8080 -e USERS=100 `
  /scripts/live-smoke.js
```

`JOIN_RATE` deterministically staggers the single iteration assigned to each
VU. Leave it unset for the simultaneous 100-user smoke. Use `USERS=1000` and
`JOIN_RATE=500` for the documented 500 joins/second 1k workload; do not compare
that result with an instantaneous 1k stress run as though they were identical.

When `JOIN_RATE` is set and `CONTROLLER_DELAY` is not, the harness delays
Activity presentation until the calculated join window has elapsed plus a
two-second margin. Set `CONTROLLER_DELAY` explicitly when the test plan calls
for a different phase boundary. `PARTICIPANT_MAX_DURATION` defaults to `3m`
so slower 5k/10k join windows do not terminate VUs before Activity closure.
Participants submit from either an already-accepting snapshot or the canonical
SSE transition, whichever they observe first; one local guard prevents duplicate
submission attempts.

Capture both `session_id` and `activity_item_id` printed by
`live_smoke_setup`, then make correctness a hard gate (the command exits
non-zero on any mismatch):

```powershell
Get-Content load/k6/reconcile.sql | docker compose exec -T postgres `
  psql -U proslides -d proslides -v session_id=<session-id> `
  -v activity_item_id=<activity-item-id> `
  -v expected_participants=100 -v expected_answers=100
```

The reconciliation verifies the final Session state, durable participant and
response counts, immutable score totals, one-response-per-Activity cardinality,
request-id uniqueness, monotonic event versions, the canonical
`presenting/closed` boundary, absence of legacy lifecycle payloads, no accepted
response after closure, one canonical `activity.result_updated` event for the
Activity, and at least one cumulative `ranking.updated` event. The database
column that stores the Activity reference is still physically named
`question_slide_id`; that internal storage name is not part of the public v2
protocol.

`k6/x/sse` is a community extension, not a Grafana-maintained module. The
versions above match the extension's documented compatibility. The `|direct`
fallback matters because Go's comma-separated proxy fallback does not advance
after every HTTP error. Review and pin both components before accepting
production-like evidence. Record
the commit, topology, raw summary, API/PostgreSQL metrics, and correctness SQL
from `docs/capacity-plan.md`. A local pass is not evidence for 1k or 10k.
