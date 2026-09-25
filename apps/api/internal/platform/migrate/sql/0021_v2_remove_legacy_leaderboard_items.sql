-- V2.7: remove persisted legacy leaderboard Items.
--
-- Overall ranking is a Session stage view in v2, not a persisted authored Item.
-- Legacy leaderboard rows are migrated to the nearest preceding scored Activity
-- by enabling that Activity's show_overall_leaderboard_after behavior, then the
-- redundant rows are deleted from authored and frozen Session definitions.
--
-- Fail rather than discard impossible durable answer history.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM answers a
        JOIN slides s ON s.id = a.question_slide_id
        WHERE s.kind = 'leaderboard'
    ) THEN
        RAISE EXCEPTION 'cannot remove legacy leaderboard slides referenced by durable answers';
    END IF;
END $$;

CREATE TEMP TABLE v27_authored_leaderboard_map ON COMMIT DROP AS
SELECT
    lb.presentation_id,
    lb.id AS leaderboard_id,
    lb.position AS leaderboard_position,
    (
        SELECT activity.id
        FROM slides activity
        WHERE activity.presentation_id = lb.presentation_id
          AND activity.kind = 'activity'
          AND activity.position < lb.position
          AND activity.content->'scoring'->>'mode' = 'points'
        ORDER BY activity.position DESC, activity.id DESC
        LIMIT 1
    ) AS owner_activity_id
FROM slides lb
WHERE lb.kind = 'leaderboard';

CREATE INDEX ON v27_authored_leaderboard_map(leaderboard_id);

CREATE TEMP TABLE v27_frozen_leaderboard_map ON COMMIT DROP AS
SELECT
    lb.session_id,
    lb.slide_id AS leaderboard_id,
    lb.position AS leaderboard_position,
    (
        SELECT activity.slide_id
        FROM live_session_slides activity
        WHERE activity.session_id = lb.session_id
          AND activity.kind = 'activity'
          AND activity.position < lb.position
          AND activity.content->'scoring'->>'mode' = 'points'
        ORDER BY activity.position DESC, activity.slide_id DESC
        LIMIT 1
    ) AS owner_activity_id
FROM live_session_slides lb
WHERE lb.kind = 'leaderboard';

CREATE INDEX ON v27_frozen_leaderboard_map(session_id, leaderboard_id);

-- Preserve authored automatic-ranking behavior.
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
    WHERE owner_activity_id IS NOT NULL
) mapped
WHERE activity.id = mapped.owner_activity_id;

-- Preserve frozen live-run behavior without re-reading mutable authored data.
UPDATE live_session_slides activity
SET content = activity.content || jsonb_build_object(
    'results',
    COALESCE(activity.content->'results', '{}'::jsonb)
    || jsonb_build_object('show_overall_leaderboard_after', true)
)
FROM (
    SELECT DISTINCT session_id, owner_activity_id
    FROM v27_frozen_leaderboard_map
    WHERE owner_activity_id IS NOT NULL
) mapped
WHERE activity.session_id = mapped.session_id
  AND activity.slide_id = mapped.owner_activity_id;

-- Repair any non-ended Session whose legacy state still points at a leaderboard
-- row before the authored FK target is deleted. Prefer the frozen scored
-- Activity that owned the ranking. If that Activity is no longer present in
-- mutable authored data, fall back to the nearest preceding presentable Item
-- shared by both the frozen run and the current Presentation. An orphaned
-- ranking with no safe Item returns to lobby rather than inventing live state.
CREATE TEMP TABLE v27_active_session_repair ON COMMIT DROP AS
SELECT
    ls.id AS session_id,
    lb.id AS leaderboard_id,
    COALESCE(
        (
            SELECT fm.owner_activity_id
            FROM v27_frozen_leaderboard_map fm
            JOIN slides authored_owner
              ON authored_owner.id = fm.owner_activity_id
             AND authored_owner.presentation_id = ls.presentation_id
             AND authored_owner.kind = 'activity'
            WHERE fm.session_id = ls.id
              AND fm.leaderboard_id = lb.id
            LIMIT 1
        ),
        (
            SELECT frozen.slide_id
            FROM live_session_slides frozen
            JOIN slides authored
              ON authored.id = frozen.slide_id
             AND authored.presentation_id = ls.presentation_id
             AND authored.kind IN ('activity', 'content')
            WHERE frozen.session_id = ls.id
              AND frozen.position < COALESCE((
                    SELECT legacy.position
                    FROM live_session_slides legacy
                    WHERE legacy.session_id = ls.id
                      AND legacy.slide_id = lb.id
                    LIMIT 1
                  ), lb.position)
              AND frozen.kind IN ('activity', 'content')
            ORDER BY frozen.position DESC, frozen.slide_id DESC
            LIMIT 1
        )
    ) AS replacement_item_id
FROM live_sessions ls
JOIN slides lb
  ON lb.id = ls.active_item_id
 AND lb.kind = 'leaderboard'
WHERE ls.state <> 'ended';

UPDATE live_sessions ls
SET
    state = CASE
        WHEN repair.replacement_item_id IS NULL THEN 'lobby'
        ELSE 'presenting'
    END,
    state_version = ls.state_version + 1,
    active_item_id = repair.replacement_item_id,
    activity_phase = CASE
        WHEN replacement.kind = 'activity' THEN 'revealed'
        ELSE NULL
    END,
    stage_view = CASE
        WHEN replacement.kind = 'activity' THEN 'overall_ranking'
        ELSE 'item'
    END,
    ends_at = NULL,
    updated_at = clock_timestamp()
FROM v27_active_session_repair repair
LEFT JOIN slides replacement ON replacement.id = repair.replacement_item_id
WHERE ls.id = repair.session_id;

-- Keep stored idempotent command results coherent when their public Session
-- representation points at a legacy leaderboard Item.
UPDATE live_commands command
SET result = (command.result - 'active_item_id')
    || jsonb_build_object(
        'active_item_id',
        CASE
            WHEN mapped.owner_activity_id IS NULL THEN 'null'::jsonb
            ELSE to_jsonb(mapped.owner_activity_id::text)
        END
    )
FROM v27_frozen_leaderboard_map mapped
WHERE command.session_id = mapped.session_id
  AND command.result->>'active_item_id' = mapped.leaderboard_id::text;

-- Retained state-change events below a reconnect snapshot are historical, but
-- normalize their Item reference as well so exported/debugged event history
-- does not keep a deleted authored Item identifier.
UPDATE live_events event
SET payload = (event.payload - 'active_item_id')
    || jsonb_build_object(
        'active_item_id',
        CASE
            WHEN mapped.owner_activity_id IS NULL THEN 'null'::jsonb
            ELSE to_jsonb(mapped.owner_activity_id::text)
        END
    )
FROM v27_frozen_leaderboard_map mapped
WHERE event.session_id = mapped.session_id
  AND event.payload->>'active_item_id' = mapped.leaderboard_id::text;

DELETE FROM live_session_slides
WHERE kind = 'leaderboard';

DELETE FROM slides
WHERE kind = 'leaderboard';

-- Compact ordered authored positions after removing persisted pseudo-items.
CREATE TEMP TABLE v27_affected_presentations ON COMMIT DROP AS
SELECT DISTINCT presentation_id
FROM v27_authored_leaderboard_map;

UPDATE slides slide
SET
    position = slide.position + 1000000,
    revision = slide.revision + 1,
    updated_at = now()
WHERE slide.presentation_id IN (
    SELECT presentation_id FROM v27_affected_presentations
);

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

UPDATE live_session_slides slide
SET position = slide.position + 1000000
WHERE slide.session_id IN (
    SELECT session_id FROM v27_affected_sessions
);

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
