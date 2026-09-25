-- V2.7: remove persisted legacy leaderboard Items.
--
-- Overall ranking is a Session stage view in v2, not a persisted authored Item.
-- A legacy leaderboard can be translated without changing presenter order only
-- when it immediately follows a scored Activity. Ambiguous rows fail the
-- migration instead of silently moving ranking earlier in the Presentation.
--
-- The migration preserves authored and frozen Session behavior independently,
-- repairs an active Session that is currently showing a legacy ranking, then
-- removes the obsolete authored/frozen rows and compacts positions.

-- Durable answers must never reference a non-Activity Item. Refuse to discard
-- impossible history even if such a row predates the current validators.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM answers a
        JOIN slides s ON s.id = a.question_slide_id
        WHERE s.kind = 'leaderboard'
    ) THEN
        RAISE EXCEPTION
            'cannot remove legacy leaderboard Items referenced by durable answers';
    END IF;
END $$;

-- Resolve the immediately preceding authored Item. Do not skip over Content or
-- an unscored Activity to find an older scored Activity; doing so would change
-- the live order from "Activity -> ... -> leaderboard" to
-- "Activity -> leaderboard -> ...".
CREATE TEMP TABLE v27_authored_leaderboard_map ON COMMIT DROP AS
SELECT
    lb.presentation_id,
    lb.id AS leaderboard_id,
    lb.position AS leaderboard_position,
    previous_item.id AS previous_item_id,
    CASE
        WHEN previous_item.kind = 'activity'
         AND previous_item.content->'scoring'->>'mode' = 'points'
            THEN previous_item.id
        ELSE NULL
    END AS owner_activity_id
FROM slides lb
LEFT JOIN LATERAL (
    SELECT item.id, item.kind, item.content
    FROM slides item
    WHERE item.presentation_id = lb.presentation_id
      AND item.position < lb.position
    ORDER BY item.position DESC, item.id DESC
    LIMIT 1
) previous_item ON true
WHERE lb.kind = 'leaderboard';

CREATE INDEX ON v27_authored_leaderboard_map(leaderboard_id);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM v27_authored_leaderboard_map
        WHERE owner_activity_id IS NULL
    ) THEN
        RAISE EXCEPTION
            'legacy leaderboard Item must immediately follow a scored Activity before V2.7 cleanup';
    END IF;
END $$;

-- Apply the same proof to each immutable Session snapshot. A Session may have
-- been frozen before later editor changes, so its mapping is intentionally
-- independent from the current authored Presentation.
CREATE TEMP TABLE v27_frozen_leaderboard_map ON COMMIT DROP AS
SELECT
    lb.session_id,
    lb.slide_id AS leaderboard_id,
    lb.position AS leaderboard_position,
    previous_item.slide_id AS previous_item_id,
    CASE
        WHEN previous_item.kind = 'activity'
         AND previous_item.content->'scoring'->>'mode' = 'points'
            THEN previous_item.slide_id
        ELSE NULL
    END AS owner_activity_id
FROM live_session_slides lb
LEFT JOIN LATERAL (
    SELECT item.slide_id, item.kind, item.content
    FROM live_session_slides item
    WHERE item.session_id = lb.session_id
      AND item.position < lb.position
    ORDER BY item.position DESC, item.slide_id DESC
    LIMIT 1
) previous_item ON true
WHERE lb.kind = 'leaderboard';

CREATE INDEX ON v27_frozen_leaderboard_map(session_id, leaderboard_id);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM v27_frozen_leaderboard_map
        WHERE owner_activity_id IS NULL
    ) THEN
        RAISE EXCEPTION
            'frozen legacy leaderboard Item must immediately follow a scored Activity before V2.7 cleanup';
    END IF;
END $$;

-- Preserve the canonical authored post-Activity ranking policy.
UPDATE slides activity
SET
    content = activity.content || jsonb_build_object(
        'results',
        COALESCE(activity.content->'results', '{}'::jsonb)
        || jsonb_build_object('show_overall_leaderboard_after', true)
    ),
    revision = activity.revision + 1,
    updated_at = now()
FROM (
    SELECT DISTINCT owner_activity_id
    FROM v27_authored_leaderboard_map
) mapped
WHERE activity.id = mapped.owner_activity_id;

-- Preserve the same policy in frozen Session definitions without re-reading
-- mutable authored data.
UPDATE live_session_slides activity
SET content = activity.content || jsonb_build_object(
    'results',
    COALESCE(activity.content->'results', '{}'::jsonb)
    || jsonb_build_object('show_overall_leaderboard_after', true)
)
FROM (
    SELECT DISTINCT session_id, owner_activity_id
    FROM v27_frozen_leaderboard_map
) mapped
WHERE activity.session_id = mapped.session_id
  AND activity.slide_id = mapped.owner_activity_id;

-- An active legacy ranking still references the authored leaderboard through
-- live_sessions.active_item_id. Repair it to the frozen owning Activity before
-- deleting that FK target. The owning Activity must still exist in the current
-- Presentation because active_item_id retains its historical authored FK.
CREATE TEMP TABLE v27_active_session_repair ON COMMIT DROP AS
SELECT
    ls.id AS session_id,
    ls.presentation_id,
    lb.id AS leaderboard_id,
    mapped.owner_activity_id AS replacement_item_id
FROM live_sessions ls
JOIN slides lb
  ON lb.id = ls.active_item_id
 AND lb.presentation_id = ls.presentation_id
 AND lb.kind = 'leaderboard'
LEFT JOIN v27_frozen_leaderboard_map mapped
  ON mapped.session_id = ls.id
 AND mapped.leaderboard_id = lb.id
WHERE ls.state <> 'ended';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM v27_active_session_repair repair
        LEFT JOIN slides replacement
          ON replacement.id = repair.replacement_item_id
         AND replacement.presentation_id = repair.presentation_id
         AND replacement.kind = 'activity'
        WHERE repair.replacement_item_id IS NULL
           OR replacement.id IS NULL
    ) THEN
        RAISE EXCEPTION
            'cannot safely repair an active Session showing a legacy leaderboard Item';
    END IF;
END $$;

UPDATE live_sessions ls
SET
    state = 'presenting',
    state_version = ls.state_version + 1,
    active_item_id = repair.replacement_item_id,
    activity_phase = 'revealed',
    stage_view = 'overall_ranking',
    ends_at = NULL,
    updated_at = clock_timestamp()
FROM v27_active_session_repair repair
WHERE ls.id = repair.session_id;

-- Keep stored idempotent command results coherent when their public Session
-- representation points at a legacy leaderboard Item.
UPDATE live_commands command
SET result = (command.result - 'active_item_id')
    || jsonb_build_object(
        'active_item_id',
        to_jsonb(mapped.owner_activity_id::text)
    )
FROM v27_frozen_leaderboard_map mapped
WHERE command.session_id = mapped.session_id
  AND command.result->>'active_item_id' = mapped.leaderboard_id::text;

-- Retained state-change events are historical, but normalize their Item
-- reference as well so replay/export/debug data never points at a deleted Item.
UPDATE live_events event
SET payload = (event.payload - 'active_item_id')
    || jsonb_build_object(
        'active_item_id',
        to_jsonb(mapped.owner_activity_id::text)
    )
FROM v27_frozen_leaderboard_map mapped
WHERE event.session_id = mapped.session_id
  AND event.payload->>'active_item_id' = mapped.leaderboard_id::text;

-- The historical active_item_id FK still targets authored slides. Surface a
-- migration-specific invariant failure instead of relying on an opaque FK
-- violation if any unexpected Session reference survived the repair above.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM live_sessions ls
        JOIN slides s ON s.id = ls.active_item_id
        WHERE s.kind = 'leaderboard'
    ) THEN
        RAISE EXCEPTION
            'cannot delete legacy leaderboard Items while a Session still references one';
    END IF;
END $$;

DELETE FROM live_session_slides
WHERE kind = 'leaderboard';

DELETE FROM slides
WHERE kind = 'leaderboard';

-- Compact authored positions after removing persisted pseudo-items. Shift all
-- surviving positions above the previous maximum first so the unique
-- (presentation_id, position) constraint cannot collide during renumbering.
CREATE TEMP TABLE v27_affected_presentations ON COMMIT DROP AS
SELECT DISTINCT presentation_id
FROM v27_authored_leaderboard_map;

WITH offsets AS (
    SELECT
        presentation_id,
        COALESCE(max(position), 0) + 1 AS offset_value
    FROM slides
    WHERE presentation_id IN (
        SELECT presentation_id FROM v27_affected_presentations
    )
    GROUP BY presentation_id
)
UPDATE slides slide
SET
    position = slide.position + offsets.offset_value,
    revision = slide.revision + 1,
    updated_at = now()
FROM offsets
WHERE slide.presentation_id = offsets.presentation_id;

WITH ordered AS (
    SELECT
        id,
        row_number() OVER (
            PARTITION BY presentation_id
            ORDER BY position, id
        ) - 1 AS next_position
    FROM slides
    WHERE presentation_id IN (
        SELECT presentation_id FROM v27_affected_presentations
    )
)
UPDATE slides slide
SET position = ordered.next_position
FROM ordered
WHERE slide.id = ordered.id;

UPDATE presentations presentation
SET
    revision = presentation.revision + 1,
    updated_at = now()
WHERE presentation.id IN (
    SELECT presentation_id FROM v27_affected_presentations
);

-- Compact frozen positions independently per immutable Session run.
CREATE TEMP TABLE v27_affected_sessions ON COMMIT DROP AS
SELECT DISTINCT session_id
FROM v27_frozen_leaderboard_map;

WITH offsets AS (
    SELECT
        session_id,
        COALESCE(max(position), 0) + 1 AS offset_value
    FROM live_session_slides
    WHERE session_id IN (
        SELECT session_id FROM v27_affected_sessions
    )
    GROUP BY session_id
)
UPDATE live_session_slides slide
SET position = slide.position + offsets.offset_value
FROM offsets
WHERE slide.session_id = offsets.session_id;

WITH ordered AS (
    SELECT
        session_id,
        slide_id,
        row_number() OVER (
            PARTITION BY session_id
            ORDER BY position, slide_id
        ) - 1 AS next_position
    FROM live_session_slides
    WHERE session_id IN (
        SELECT session_id FROM v27_affected_sessions
    )
)
UPDATE live_session_slides slide
SET position = ordered.next_position
FROM ordered
WHERE slide.session_id = ordered.session_id
  AND slide.slide_id = ordered.slide_id;
