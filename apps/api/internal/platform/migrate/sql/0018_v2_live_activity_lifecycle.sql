-- ProSlides v2 V2.2: cut the live runtime over from question-specific
-- session states to a generic presenter-paced Session + Activity lifecycle.

ALTER TABLE live_sessions
    DROP CONSTRAINT IF EXISTS live_sessions_state_check,
    DROP CONSTRAINT IF EXISTS live_sessions_deadline_state_check;

ALTER TABLE live_sessions
    RENAME COLUMN active_slide_id TO active_item_id;

ALTER TABLE live_sessions
    ADD COLUMN activity_phase TEXT,
    ADD COLUMN stage_view TEXT NOT NULL DEFAULT 'item';

UPDATE live_sessions
SET activity_phase = CASE state
        WHEN 'question_open' THEN 'accepting'
        WHEN 'question_closed' THEN 'closed'
        WHEN 'leaderboard' THEN 'revealed'
        ELSE NULL
    END,
    stage_view = CASE state
        WHEN 'leaderboard' THEN 'overall_ranking'
        ELSE 'item'
    END,
    state = CASE
        WHEN state IN ('content', 'question_open', 'question_closed', 'leaderboard')
            THEN 'presenting'
        ELSE state
    END;

ALTER TABLE live_sessions
    ADD CONSTRAINT live_sessions_state_check
        CHECK (state IN ('draft', 'lobby', 'presenting', 'ended')),
    ADD CONSTRAINT live_sessions_activity_phase_check
        CHECK (activity_phase IS NULL OR activity_phase IN ('accepting', 'closed', 'revealed')),
    ADD CONSTRAINT live_sessions_stage_view_check
        CHECK (stage_view IN ('item', 'overall_ranking')),
    ADD CONSTRAINT live_sessions_presenting_item_check
        CHECK (
            (state = 'presenting' AND active_item_id IS NOT NULL)
            OR (state <> 'presenting' AND active_item_id IS NULL)
        ),
    ADD CONSTRAINT live_sessions_activity_phase_state_check
        CHECK (activity_phase IS NULL OR state = 'presenting'),
    ADD CONSTRAINT live_sessions_stage_view_state_check
        CHECK (stage_view <> 'overall_ranking' OR state = 'presenting'),
    ADD CONSTRAINT live_sessions_deadline_phase_check
        CHECK (
            (activity_phase = 'accepting' AND ends_at IS NOT NULL)
            OR (activity_phase IS DISTINCT FROM 'accepting' AND ends_at IS NULL)
        );

-- Existing frozen question snapshots must be upgraded in place. Re-reading
-- authored slides here would violate the frozen-session invariant for sessions
-- created before this migration.
UPDATE live_session_slides AS s
SET kind = 'activity',
    content = jsonb_build_object(
        'schema_version', 1,
        'activity_kind', 'choice',
        'prompt', jsonb_build_object(
            'title', COALESCE(s.content->>'title', ''),
            'text', COALESCE(s.content->>'text', ''),
            'image_url', COALESCE(s.content->>'image_url', '')
        ),
        'response', jsonb_build_object(
            'selection', COALESCE(s.content->>'question_type', 'single'),
            'options', COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', COALESCE(NULLIF(option_value->>'id', ''), 'legacy-option-' || option_ordinality::text),
                        'text', option_value->>'text',
                        'image_url', COALESCE(option_value->>'image_url', ''),
                        'order', COALESCE((option_value->>'order')::int, option_ordinality::int)
                    )
                    ORDER BY option_ordinality
                )
                FROM jsonb_array_elements(s.content->'options')
                    WITH ORDINALITY AS option_rows(option_value, option_ordinality)
            ), '[]'::jsonb)
        ),
        'evaluation', jsonb_build_object(
            'mode', 'correctness',
            'correct_option_ids', COALESCE((
                SELECT jsonb_agg(
                    COALESCE(NULLIF(option_value->>'id', ''), 'legacy-option-' || option_ordinality::text)
                    ORDER BY option_ordinality
                )
                FROM jsonb_array_elements(s.content->'options')
                    WITH ORDINALITY AS option_rows(option_value, option_ordinality)
                WHERE COALESCE((option_value->>'is_correct')::boolean, false)
            ), '[]'::jsonb)
        ),
        'scoring', jsonb_build_object(
            'mode', 'points',
            'min_points', COALESCE((s.content->>'min_point')::int, 0),
            'max_points', COALESCE((s.content->>'max_point')::int, 100),
            'speed_bonus', COALESCE((s.content->>'faster_answers_more_points')::boolean, false),
            'partial_credit', COALESCE((s.content->>'partial_scoring')::boolean, false)
        ),
        'timing', jsonb_build_object(
            'duration_seconds', COALESCE((s.content->>'question_time')::int, 30)
        ),
        'results', jsonb_build_object(
            'show_overall_leaderboard_after',
            COALESCE((s.content->>'show_leaderboard_after')::boolean, false)
        )
    )
WHERE s.kind = 'question';

-- Preserve idempotent command retries across the cut-over by normalizing the
-- stored command result to the new public Session representation.
UPDATE live_commands
SET action = CASE action
        WHEN 'open_content' THEN 'present_item'
        WHEN 'open_question' THEN 'present_item'
        WHEN 'close_question' THEN 'close_activity'
        WHEN 'show_leaderboard' THEN 'show_overall_ranking'
        ELSE action
    END,
    result_state = CASE
        WHEN result_state IN ('content', 'question_open', 'question_closed', 'leaderboard')
            THEN 'presenting'
        ELSE result_state
    END,
    result = (result - 'active_slide_id' - 'state')
        || jsonb_build_object(
            'state', CASE
                WHEN result->>'state' IN ('content', 'question_open', 'question_closed', 'leaderboard')
                    THEN 'presenting'
                ELSE result->>'state'
            END,
            'active_item_id', result->'active_slide_id',
            'activity_phase', CASE result->>'state'
                WHEN 'question_open' THEN to_jsonb('accepting'::text)
                WHEN 'question_closed' THEN to_jsonb('closed'::text)
                WHEN 'leaderboard' THEN to_jsonb('revealed'::text)
                ELSE 'null'::jsonb
            END,
            'stage_view', CASE result->>'state'
                WHEN 'leaderboard' THEN 'overall_ranking'
                ELSE 'item'
            END
        );

-- Normalize retained replay events so snapshot-first reconnect never observes
-- two different lifecycle vocabularies for the same session.
UPDATE live_events
SET name = CASE name
        WHEN 'answer.stats' THEN 'activity.result_updated'
        WHEN 'leaderboard.updated' THEN 'ranking.updated'
        ELSE name
    END,
    payload = CASE
        WHEN name = 'session.state_changed' THEN
            (payload - 'active_slide_id' - 'state')
            || jsonb_build_object(
                'state', CASE
                    WHEN payload->>'state' IN ('content', 'question_open', 'question_closed', 'leaderboard')
                        THEN 'presenting'
                    ELSE payload->>'state'
                END,
                'active_item_id', payload->'active_slide_id',
                'activity_phase', CASE payload->>'state'
                    WHEN 'question_open' THEN to_jsonb('accepting'::text)
                    WHEN 'question_closed' THEN to_jsonb('closed'::text)
                    WHEN 'leaderboard' THEN to_jsonb('revealed'::text)
                    ELSE 'null'::jsonb
                END,
                'stage_view', CASE payload->>'state'
                    WHEN 'leaderboard' THEN 'overall_ranking'
                    ELSE 'item'
                END
            )
        WHEN name = 'answer.stats' THEN
            (payload - 'question_slide_id')
            || jsonb_build_object('activity_item_id', payload->'question_slide_id')
        ELSE payload
    END;
