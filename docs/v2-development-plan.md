# ProSlides v2 development plan

This is the authoritative execution plan for the active v2 redesign program.
Current completion state still belongs in status/current.md. Durable product
rules are in v2-product-architecture.md and ADR 0004.

## Delivery model

v2 is developed on main through short-lived vertical branches and squash-merged
pull requests. Do not create a long-lived v2 integration branch.

Each slice should:

1. preserve a coherent main branch;
2. update OpenAPI first when the external contract changes;
3. use forward-only database migrations;
4. migrate backend and frontend ownership together where practical;
5. remove the legacy path when the replacement is verified;
6. add only the tests needed to protect expensive behavior;
7. avoid broad visual polish until the relevant v2 surface stabilizes.

Because the project is pre-production, internal contract compatibility is not a
goal by itself. Compatibility code exists only to keep a slice safely
migratable, then is removed.

## Architecture baseline

PR #81 established the v2 architecture and tracking baseline. Git remains
authoritative for the exact commit history; this plan does not duplicate a
moving SHA.

## Scope locks

For v2.0:

- presenter-paced live only;
- individual participation only;
- no team mode;
- no self-paced/assignment mode;
- no parallel /api/v2;
- no workflow DSL;
- no backend/frontend rewrite;
- no framework/toolchain upgrade mixed into the redesign unless required.

If one of these locks changes, update ADR 0004 before implementation.

## Slice sequence

### V2.1 — Domain vocabulary and persisted definition foundation

Goal: make the data model capable of expressing Content and Activity without
changing the visible product flow yet.

Work:

- define the target Item/Activity transport/domain types;
- add explicit schema_version to new v2 persisted definitions;
- define choice response/evaluation/scoring schema;
- preserve current question/content behavior through translation;
- document the exact legacy fields and kinds scheduled for removal;
- keep Presentation revision/If-Match semantics unchanged.

Exit criteria:

- current editor/live behavior still works;
- one authoritative v2 definition exists for the migrated Choice Activity;
- OpenAPI/generated frontend types agree;
- no second source of truth for the same persisted definition.

### V2.2 — Live Activity lifecycle and ranking semantics

Goal: remove question-specific meaning from the core live lifecycle without
losing existing correctness guarantees.

Work:

- introduce generic active Item/Activity phase semantics;
- migrate close/reveal/navigation behavior;
- separate Activity result from overall Session ranking;
- rename/migrate show_leaderboard_after to the unambiguous
  show_overall_leaderboard_after contract;
- keep Activity top performers out of the automatic Stage flow;
- implement cumulative ranking tie semantics as 1, 1, 3;
- keep Stage leaderboard bounded to a small top set and Backstage/report reads
  paginated;
- preserve request idempotency, state-version conflicts, frozen Session
  definitions, deadline authority and durable events.

Exit criteria:

- the same Choice Activity can be scored or unscored without a second live
  engine;
- overall leaderboard no longer masquerades as an Activity result;
- legacy global leaderboard/question states are no longer authoritative.

### V2.3 — Frontend registries and Editor shell

Goal: make adding an Item type local rather than a cross-application switch
exercise.

Work:

- add content registry and activity registry boundaries;
- migrate existing content and Choice editor rendering through the registries;
- redesign the Editor shell around item rail, canvas, inspector and top actions;
- show "result after activity" and "overall leaderboard after this activity" as
  explicit behavior, not fake persisted slides;
- remove synthetic leaderboard selection once equivalent UX exists;
- preserve dirty/save/discard/conflict semantics.

Exit criteria:

- EditorRoute does not need new top-level branching for every new Activity type;
- Content and Choice are fully registry-owned;
- no user-facing ambiguity between Activity results and overall leaderboard.

### V2.4 — Stage, Backstage and Participant redesign

Goal: make the three live projections intentional.

Work:

- build a dedicated audience Stage shell;
- build presenter Backstage with current/next Item, open/close/reveal controls,
  response count, overall ranking and private Activity insight;
- keep opening Backstage ranking from changing Stage;
- redesign participant shell for mobile-first submission/recovery/personal
  result/score/rank;
- show top-5 cumulative ranking on Stage when explicitly requested;
- show final podium only when scored Activities exist.

Exit criteria:

- presenter can inspect ranking privately;
- participant never receives manager-only roster/correctness data;
- current live reconnect and recovery invariants remain intact.

### V2.5 — Reports v2

Goal: make reporting Session-first instead of "latest question result" oriented.

Work:

- list Sessions for a Presentation;
- expose one Session report summary;
- expose per-Activity results;
- expose participant response/evaluation history with bounded reads;
- expose final cumulative ranking when scoring exists;
- retain latest-session only as temporary/convenience compatibility where still
  useful.

Exit criteria:

- a historical Session can be understood without reading the mutable current
  Presentation;
- Activity result and overall ranking are visibly distinct in API and UI.

### V2.6 — First new Activities

Goal: prove the architecture with genuinely different interactions.

Order:

1. Poll using the Choice primitive with no evaluation/scoring;
2. Word Cloud using the Text primitive and word-frequency aggregation;
3. Open Text;
4. Rating/Scale.

Do not add all four in one pull request.

Exit criteria for each Activity:

- editor definition;
- backend validation;
- frozen Session definition;
- participant response;
- Stage result;
- report result;
- no new global Session state invented solely for that Activity.

### V2.7 — Legacy cleanup

Goal: delete migration scaffolding once v2 paths own the product.

Targets include, when no longer referenced:

- numeric slide_type compatibility;
- question_draft compatibility;
- synthetic leaderboard slides;
- legacy question-specific live state names;
- duplicate result/ranking adapters;
- legacy frontend model translations.

No compatibility layer is retained merely because deleting it feels risky. Its
replacement must be verified, then the duplicate path is removed.

### V2.8 — Production-readiness hardening

Only after the redesign is functionally stable:

- broaden critical browser E2E;
- full accessibility/keyboard/screen-reader review;
- responsive matrix;
- visual regression for stable surfaces;
- export-level dead-code/dependency analysis;
- security and deployment hardening;
- load/capacity gates on the final v2 live protocol;
- event-retention and production observability decisions.

## Pull-request sizing

Prefer one domain capability or one complete migration boundary per PR.

Good examples:

- add ChoiceActivity schema and adapter;
- migrate ranking terminology/API;
- move Content rendering behind registry;
- introduce Backstage ranking drawer;
- add Poll end-to-end.

Avoid:

- "rewrite editor and live backend";
- "add all activity types";
- "v2 everything";
- framework upgrade plus domain migration.

## Verification policy during v2

Fast checks remain continuous because they are cheap:

- OpenAPI/generated type consistency when contracts change;
- Go tests/vet for affected backend packages;
- frontend lint/typecheck/architecture check;
- focused domain/component tests for the changed behavior.

Browser/container checks are valuable integration evidence but remain
non-required during the current single-developer pre-production phase. A
failure related to the changed boundary must still be investigated.

Before merging a high-risk live/domain slice, explicitly verify the affected
invariant, especially:

- duplicate command idempotency;
- stale state-version conflict;
- edit revision conflict;
- frozen Session definition;
- response after close/deadline rejection;
- reconnect snapshot + SSE cursor recovery;
- participant projection non-disclosure.

## GitHub tracking

The v2 program is tracked by umbrella GitHub issue #82. Slice issues #83-#90
own their acceptance criteria and PR links; issue #82 owns the ordered checklist
and cross-slice sequencing.

Do not duplicate the live checklist in status/current.md. That document should
link here and state only which slice is active.
