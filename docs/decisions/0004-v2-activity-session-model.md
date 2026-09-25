# ADR 0004: ProSlides v2 activity and session model

Status: Accepted

Date: 2026-09-25

## Context

ProSlides is entering a new pre-production product generation. The current
implementation is optimized around content slides, single/multiple-choice
questions and a leaderboard-oriented live state machine. That model works for
the present feature set but makes future audience interactions increasingly
expensive because question type, scoring, live state, rendering and reporting
are too tightly coupled.

Competitive products demonstrate several durable product patterns:

- the same response mechanism can be used for scored and unscored purposes;
- session-wide ranking is distinct from the result of one question;
- presenter control, audience Stage and participant device are different
  projections of the same run;
- reporting is naturally session-first;
- Q&A-style interaction is session-scoped rather than necessarily slide-scoped.

ProSlides is not yet in production and has no supported external API consumer,
so maintaining a parallel compatibility stack would slow development without
protecting a real customer contract.

## Decision

### Product/domain model

ProSlides v2 remains presentation-centric.

A Presentation contains ordered Items. An Item is either Content or an Activity.

Activity input mechanisms are modeled as reusable primitives. Product concepts
such as Poll and Quiz may share a choice primitive while differing in evaluation
and scoring policy.

Persisted v2 definitions carry explicit schema versions.

### Live model

v2.0 supports presenter-paced individual participation only.

Team mode and self-paced/assignment delivery are out of scope.

The target Session state is generic:

    draft -> lobby -> presenting -> ended

The active Item and Activity phase are separate from the Session state.

Existing HTTP idempotency, expected state versions, frozen session definitions,
snapshot-first SSE, durable replay and role-scoped projections remain required.

### Ranking model

Activity results, per-Activity top performers and the cumulative Session
leaderboard are separate concepts.

The audience Stage normally sees Activity results first.

Per-Activity top performers are initially a Backstage/report concern.

The overall leaderboard is cumulative across scored Activities. Legacy
show_leaderboard_after maps only to the v2 concept
show_overall_leaderboard_after.

New scored Activities default to not automatically showing the overall
leaderboard after each Activity. The presenter may inspect ranking privately in
Backstage. A final podium is available when at least one scored Activity exists.

Equal cumulative scores are real ties. Displayed rank uses competition ranking
such as 1, 1, 3. Stable ordering among tied rows does not secretly change rank.

### Frontend model

The v2 Editor uses separate content and activity registries behind a stable
Editor shell. Registry entries own type-specific editor/live/result rendering
but do not become a generic dependency container.

The live experience separates:

- Stage: audience-facing projection;
- Backstage: presenter controls and private insight;
- Participant: mobile-first personal interaction.

### API/version strategy

"v2" names the product architecture program, not an HTTP path.

The existing /api/v1 path evolves with OpenAPI, backend and frontend changed
together in bounded slices. A parallel /api/v2 implementation is not created
until an actual external compatibility contract requires it.

### Development strategy

There is no long-lived v2 branch.

main remains the integration line. Each v2 change is delivered as a small
vertical pull request that leaves main coherent. Forward-only migrations are
used for persistent data. Temporary compatibility adapters are removed as soon
as the corresponding slice is fully cut over.

## Consequences

### Positive

- adding a new audience interaction no longer requires inventing a new global
  Session state;
- Poll and Quiz can reuse response machinery without pretending to be the same
  user-facing feature;
- leaderboard semantics become explicit and less confusing;
- Stage, Backstage and participant UX can evolve independently while sharing one
  Session truth;
- the redesign can proceed quickly without a duplicate API or long-lived branch;
- current real-time correctness work is preserved.

### Costs

- legacy slide/question types require a staged migration;
- current question-specific live states need translation during cut-over;
- reports and frontend models must migrate from question-centric names;
- schema versioning adds deliberate migration work for persisted Activity
  definitions.

### Risks and controls

Risk: over-generalizing before multiple Activity types exist.

Control: no generic capability persistence, plugin framework or flow DSL is
introduced without a concrete use case.

Risk: v2 changes destabilize the existing live path.

Control: preserve frozen Session definitions, idempotency, state versioning,
snapshot-first SSE and durable event invariants in every slice.

Risk: maintaining legacy and v2 models indefinitely.

Control: every migration slice identifies the legacy surface it removes before
the issue is considered complete.

## Rejected alternatives

### Rewrite backend and frontend from scratch

Rejected because the current Go/PostgreSQL/HTTP/SSE foundation already provides
valuable correctness guarantees.

### Keep question-specific Session states and add more states per interaction

Rejected because each new Activity would expand global state-machine coupling.

### Model every user-facing Activity as a separate backend engine

Rejected because mechanisms such as choice can serve both Poll and Quiz.

### Build a generic workflow engine now

Rejected because v2.0 only requires a simple post-Activity result reveal plus an
optional cumulative leaderboard step.

### Add team and self-paced modes to the foundation

Rejected for v2.0 to protect development speed and avoid speculative domain
abstractions.
