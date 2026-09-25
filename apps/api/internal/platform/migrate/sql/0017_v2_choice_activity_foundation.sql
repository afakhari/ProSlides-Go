-- ProSlides v2 V2.1: make authored Choice Activities the durable source of
-- truth while leaving existing live_session_slides untouched. Frozen live
-- snapshots remain in the legacy question shape until the V2.2 live cut-over.

UPDATE slides AS s
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

ALTER TABLE slides
    ADD CONSTRAINT slides_activity_schema_version_check
    CHECK (
        kind <> 'activity'
        OR (
            jsonb_typeof(content) = 'object'
            AND jsonb_typeof(content->'schema_version') = 'number'
            AND COALESCE((content->>'schema_version') ~ '^[1-9][0-9]*$', false)
        )
    );
