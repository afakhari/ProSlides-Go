# ProSlides v2 product architecture

Status: **target architecture for the active pre-production v2 program**.

This document defines the product/domain model that v2 work converges toward.
It is not a claim that the model is already implemented. Current implementation
state remains authoritative in status/current.md; durable rationale is recorded
in ADR 0004.

## Product position

ProSlides v2 is a presentation-centric audience interaction product:

    authored presentation
            +
    presenter-paced live session
            +
    audience activities
            +
    presenter control
            +
    session reports

It is not intended to become an LMS, general survey platform, team-game engine,
or collaborative design suite in v2.0.

## Explicit v2.0 scope

Included:

- authored presentations made of ordered items;
- content items and audience activity items;
- presenter-paced live delivery;
- individual participants;
- scored and unscored activities;
- activity results, cumulative overall ranking and final podium;
- Stage, Backstage and participant projections;
- session-first reporting;
- forward-compatible activity schemas.

Explicitly out of scope for v2.0:

- team mode;
- self-paced assignments/homework;
- collaborative multi-author editing/CRDTs;
- generic workflow/flow-builder DSLs;
- a parallel public /api/v2 tree;
- microservices, WebSockets or a new durable datastore without measured need.

These exclusions are deliberate scope controls, not promises that the features
will never exist.

## Core vocabulary

### Presentation

An authored reusable resource. Editing a Presentation never changes a live run
that has already started.

### Item

An ordered Presentation child. Every item is exactly one of:

- **Content item**: presents information and does not accept an audience response.
- **Activity item**: accepts audience input and defines response, evaluation and
  result behavior.

"Slide" may remain a UI word, but backend/domain code should converge on Item
where the distinction matters.

### Activity item

The mechanism of input is separate from whether the input is evaluated or
scored. The initial target primitives are:

- choice;
- text;
- scale.

Product presets may present friendlier concepts on top:

- Poll = choice with no correctness evaluation or score;
- Quiz = choice with correctness evaluation and optional score;
- Word Cloud = text with word-frequency aggregation/visualization;
- Open Text = text with list/card aggregation;
- Rating = scale.

Do not create separate backend engines for Poll and Quiz when their response
mechanism is the same.

### Activity schema version

Every persisted v2 item definition carries a positive schema_version. Definition
evolution must be explicit. Old persisted content is upgraded through
well-defined readers/upcasters or forward migrations rather than guessed from
shape.

### Session

One execution of a frozen Presentation definition. The existing
live_session_slides snapshot invariant remains: editor changes after session
creation must not alter live behavior or historical reports.

v2.0 supports **presenter-paced** delivery only. Do not add a delivery-mode
abstraction merely to represent unsupported modes. Add such a field when a
second delivery mode is actually implemented.

### Response and evaluation

A Response is one participant submission to an Activity. Request idempotency
remains mandatory.

Evaluation interprets a Response for correctness and score. It is separate from
the response payload so unscored polls and scored quizzes can share a response
primitive.

### Session ranking

The cumulative score ranking across scored activities in one Session. There is
no team ranking in v2.0.

## Activity definition model

The target is a small compositional model, not a giant list of special cases.

Conceptually an Activity definition contains:

- kind;
- schema_version;
- prompt/content;
- response policy;
- evaluation policy;
- result presentation policy.

For choice, distinguish:

- single vs multiple selection;
- no evaluation vs correctness evaluation;
- no scoring vs fixed/speed-aware scoring;
- optional partial-credit policy for multiple selection.

For the initial Text primitive used by Word Cloud:

- response policy bounds text length and submitted word count;
- evaluation and scoring are both `none`;
- result policy explicitly selects `word_frequency` aggregation;
- accepted text is Unicode-normalized at the command boundary;
- aggregation keys additionally canonicalize common Arabic/Persian yeh and kaf
  glyph variants while the participant's accepted text remains preserved;
- canonical terms are frozen with the accepted response so historical Word Cloud
  results do not change if tokenizer behavior evolves;
- repeated occurrences of the same normalized term in one participant response
  count once toward aggregation, while all submitted tokens still count toward
  the response word limit.

Open Text may later reuse the same Text response primitive with a different
result policy. Do not create a separate live Session state or response endpoint
for each Text product preset.

Do not persist a generic bag of speculative capability booleans. Capabilities
should be derived by backend/frontend registries from the concrete definition
until a real persistence need appears.

## Live lifecycle

The current question-specific session state machine is a migration source, not
the v2 target.

Target session state:

    draft -> lobby -> presenting -> ended

The active item is separate:

    active_item_id
    activity_phase = null | accepting | closed | revealed

Rules:

- Content items have no response-acceptance phase.
- Activity lifecycle belongs to the active Activity, not to the Session's global
  state name.
- HTTP mutation success remains definitive.
- Manager commands remain idempotent and version-checked.
- Snapshot-first SSE, durable replay and role-scoped projection remain
  non-negotiable.
- Migration may temporarily translate legacy question_open/question_closed/
  leaderboard states into the v2 model. Do not keep two independent truths.

## Results and leaderboard semantics

Three concepts must never be conflated.

### Activity results

Results for the Activity that just closed. A scored choice quiz typically shows
response distribution, correct answer(s), response count and aggregate
correctness. This is the normal first Stage after a scored question closes.

For an unscored Poll, this is simply the poll result.

### Activity top performers

Performance within one scored Activity only.

v2.0 policy:

- available in Backstage and reports;
- not a mandatory Stage step;
- not called "leaderboard" in user-facing Persian copy;
- if later surfaced on Stage, label it "برترین‌های این سؤال" and treat it as an
  optional spotlight.

### Overall leaderboard

Cumulative Session ranking across all scored activities completed so far.

This is what legacy show_leaderboard_after means in v2.

Target persisted/API name:

    show_overall_leaderboard_after

Migration rule:

- legacy show_leaderboard_after=true maps to
  show_overall_leaderboard_after=true;
- it never means "top performers for this question."

The boolean is deliberately retained instead of adding a general post-activity
flow DSL. v2.0 does not need that abstraction.

### Default flow

Scored Activity:

    activity
      -> accepting responses
      -> close
      -> activity results + correct answer
      -> optional overall leaderboard
      -> next item

Unscored Activity:

    activity
      -> accepting responses
      -> close
      -> activity results
      -> next item

Content:

    content -> next item

### User-friendly defaults

- Result reveal is part of normal quiz/poll flow.
- show_overall_leaderboard_after defaults to false for newly created scored
  Activities.
- The presenter can inspect overall ranking in Backstage at any time without
  changing the audience Stage.
- A Presentation with at least one scored Activity gets a final podium/result
  view when the Session ends.
- A Presentation without scored Activities ends with a neutral finished view.

### Stage

Mid-session overall leaderboard:

- top 5 by default;
- cumulative score;
- clear Persian title "رتبه‌بندی کلی";
- never a giant participant table.

Final Stage result:

- podium emphasis for leading participants;
- distinct visual treatment from the mid-session leaderboard.

### Participant device

After a scored Activity, prioritize personal feedback:

- correct/incorrect where disclosure is allowed;
- score gained;
- cumulative personal score;
- own current rank when an overall ranking exists.

Do not render the full public leaderboard on a small participant screen by
default.

### Backstage

The presenter may inspect without changing Stage:

- overall ranking;
- Activity results;
- Activity top performers;
- response count and connection health.

Full lists remain bounded/paginated.

### Reports

Session report hierarchy:

    Session
      Overview
      Activities
        Activity result
        Activity top performers when scored
      Participants
        personal responses/evaluations
      Final ranking when scoring exists

Reports are session-first. "Latest session" may remain a convenience endpoint
during migration but is not the target reporting model.

### Ranking ties

Rank is determined by cumulative score only.

Equal scores are true ties and use competition ranking:

    1, 1, 3

Stable display/pagination ordering among tied participants may use joined_at and
id, but it must not secretly alter their displayed rank. If speed matters, it
must already be represented in the scoring policy; there is no hidden
time-based tie breaker.

## Stage, Backstage and participant projections

The same Session has three intentionally different views.

### Stage

Audience-facing projection optimized for readability at distance:

- current content/activity;
- Activity result visualization;
- optional top-5 overall leaderboard;
- final podium;
- join information where appropriate.

### Backstage

Presenter-only control and insight surface:

- current and next item;
- open/close/reveal controls;
- participant and response counts;
- overall ranking;
- Activity result/top performers;
- connection/recovery status;
- future session channels such as Q&A.

### Participant

Mobile-first personal interaction surface:

- current Activity;
- submission state;
- personal result/score/rank;
- waiting/recovery state.

Manager-only correctness or complete roster/score-map data must never leak into
participant snapshots.

## Q&A and reactions

Q&A is not a slide/activity response type in the target model. If implemented,
it is a Session channel with its own questions, moderation and votes. A
Presentation item may later display that channel on Stage, but it does not own
the channel data.

Reactions follow the same Session-channel principle. Neither is required for the
first v2 foundation slices.

## API versioning strategy

"ProSlides v2" is the product architecture/version program, not an immediate
HTTP path version.

The project is pre-production and has no supported external API consumer.
Therefore:

- continue using /api/v1 while v2 is built;
- change OpenAPI, backend and frontend together in bounded vertical slices;
- do not maintain parallel v1/v2 HTTP implementations solely for internal
  compatibility;
- introduce an external API version boundary only when a published/stable
  compatibility contract actually requires one.

## Persistence migration strategy

- Applied migrations remain immutable.
- Schema changes use new forward-only migrations.
- Prefer add/backfill/cut-over/remove across small slices when data shape changes
  are risky.
- Do not preserve obsolete internal schema forever for hypothetical
  compatibility.
- Existing session snapshots and durable event invariants remain protected.

## Frontend target

The v2 editor converges on:

    Editor shell
      item rail
      canvas
      inspector
      top actions
        |
        +-- content registry
        +-- activity registry

A registry entry owns the UI/behavior needed for that item type, such as:

- default definition;
- editor canvas;
- editor inspector;
- validation adapter;
- Stage renderer;
- participant renderer where interactive;
- results renderer.

The registry must not become a service locator for unrelated application state.

The live UI converges on explicit Stage, Backstage and Participant shells rather
than type-specific top-level pages.

## Migration compatibility

Keep and migrate these existing invariants rather than rewriting them:

- presentation revisions and If-Match;
- frozen live-session slide definitions;
- HTTP command idempotency;
- manager state-version checks;
- durable events and replay;
- role-scoped snapshots;
- bounded roster/leaderboard reads;
- PostgreSQL score authority.

Legacy question_draft, numeric slide_type, question_open/question_closed/
leaderboard state, synthetic leaderboard slides and show_leaderboard_after are
migration surfaces. Remove each only when its v2 replacement has equivalent
behavior and verification.

## Foundation non-goals

Do not use v2 as justification to add microservices, Kafka/NATS, WebSockets,
GraphQL, Redux/Zustand/XState, another frontend framework, an all-purpose plugin
framework, or speculative team/self-paced abstractions.

The redesign should make the next real product capability cheaper, not make
today's code more ceremonial.
