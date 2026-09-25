-- V2.7: canonicalize retained Choice result replay events before removing
-- production/client compatibility for the pre-generic result envelope.
--
-- Migration 0018 renamed answer.stats to activity.result_updated and renamed
-- question_slide_id to activity_item_id, but intentionally preserved the old
-- top-level option_counts payload. Current Activity result events use the
-- versioned generic envelope. Normalize retained rows once so reconnect/replay
-- has the same contract as newly written events.

UPDATE live_events AS event
SET
    schema_version = 2,
    payload = jsonb_build_object(
        'activity_item_id', event.payload->'activity_item_id',
        'activity_kind', 'choice',
        'schema_version', COALESCE(
            (
                SELECT CASE
                    WHEN item.content->>'schema_version' ~ '^[0-9]+$'
                        THEN (item.content->>'schema_version')::int
                    ELSE 1
                END
                FROM live_session_slides AS item
                WHERE item.session_id = event.session_id
                  AND item.slide_id::text = event.payload->>'activity_item_id'
                  AND item.kind = 'activity'
                LIMIT 1
            ),
            1
        ),
        'response_count', COALESCE(event.payload->'response_count', '0'::jsonb),
        'payload', jsonb_build_object(
            'option_counts',
            COALESCE(event.payload->'option_counts', '{}'::jsonb)
        )
    )
WHERE event.name = 'activity.result_updated'
  AND event.payload ? 'activity_item_id'
  AND event.payload ? 'option_counts'
  AND NOT (event.payload ? 'activity_kind');
