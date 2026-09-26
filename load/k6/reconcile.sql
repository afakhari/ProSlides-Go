\set ON_ERROR_STOP on

WITH target AS (
    SELECT
        session.id,
        session.state,
        session.state_version,
        (SELECT count(*) FROM participants WHERE session_id = session.id) AS durable_participants,
        (SELECT count(*) FROM answers WHERE session_id = session.id) AS durable_answers,
        (SELECT count(DISTINCT participant_id) FROM answers WHERE session_id = session.id) AS answered_participants
    FROM live_sessions AS session
    WHERE session.id = :'session_id'::uuid
), activity AS (
    SELECT slide_id
    FROM live_session_slides
    WHERE session_id = :'session_id'::uuid
      AND slide_id = :'activity_item_id'::uuid
      AND kind = 'activity'
), score_mismatches AS (
    SELECT count(*) AS value
    FROM (
        SELECT participant.id
        FROM participants AS participant
        LEFT JOIN answers AS answer
          ON answer.session_id = participant.session_id
         AND answer.participant_id = participant.id
        WHERE participant.session_id = :'session_id'::uuid
        GROUP BY participant.id, participant.score
        HAVING participant.score <> COALESCE(sum(answer.score_delta), 0)
    ) AS mismatch
), duplicate_activity_responses AS (
    SELECT count(*) AS value
    FROM (
        SELECT participant_id, question_slide_id
        FROM answers
        WHERE session_id = :'session_id'::uuid
        GROUP BY participant_id, question_slide_id
        HAVING count(*) > 1
    ) AS duplicate
), duplicate_requests AS (
    SELECT count(*) AS value
    FROM (
        SELECT request_id
        FROM answers
        WHERE session_id = :'session_id'::uuid
        GROUP BY request_id
        HAVING count(*) > 1
    ) AS duplicate
), event_regressions AS (
    SELECT count(*) AS value
    FROM (
        SELECT state_version, lag(state_version) OVER (ORDER BY event_id) AS previous_version
        FROM live_events
        WHERE session_id = :'session_id'::uuid
    ) AS ordered_events
    WHERE state_version < previous_version
), invalid_events AS (
    SELECT count(*) AS value
    FROM live_events, target
    WHERE session_id = target.id
      AND (live_events.state_version <= 0 OR live_events.state_version > target.state_version)
), legacy_lifecycle_events AS (
    SELECT count(*) AS value
    FROM live_events
    WHERE session_id = :'session_id'::uuid
      AND (
        name IN ('answer.stats', 'leaderboard.updated')
        OR payload->>'state' IN ('content', 'question_open', 'question_closed', 'leaderboard')
        OR payload ? 'active_slide_id'
        OR payload ? 'question_slide_id'
      )
), close_boundary AS (
    SELECT min(occurred_at) AS occurred_at
    FROM live_events
    WHERE session_id = :'session_id'::uuid
      AND name = 'session.state_changed'
      AND payload->>'state' = 'presenting'
      AND payload->>'activity_phase' = 'closed'
      AND payload->>'active_item_id' = :'activity_item_id'
), late_answers AS (
    SELECT count(*) AS value
    FROM answers, close_boundary
    WHERE session_id = :'session_id'::uuid
      AND question_slide_id = :'activity_item_id'::uuid
      AND close_boundary.occurred_at IS NOT NULL
      AND submitted_at > close_boundary.occurred_at
), activity_result_events AS (
    SELECT
        count(*) AS event_count,
        count(*) FILTER (
            WHERE schema_version = 2
              AND payload->>'activity_item_id' = :'activity_item_id'
              AND payload->>'activity_kind' = 'choice'
              AND payload->>'schema_version' = '1'
              AND (payload->>'response_count')::int = :expected_answers
              AND jsonb_typeof(payload->'payload'->'option_counts') = 'object'
        ) AS canonical_count
    FROM live_events
    WHERE session_id = :'session_id'::uuid
      AND name = 'activity.result_updated'
      AND payload->>'activity_item_id' = :'activity_item_id'
), ranking_events AS (
    SELECT count(*) AS value
    FROM live_events
    WHERE session_id = :'session_id'::uuid
      AND name = 'ranking.updated'
      AND jsonb_typeof(payload) = 'object'
      AND (payload->>'participant_count')::int = :expected_participants
), audit AS (
    SELECT
        target.*,
        EXISTS(SELECT 1 FROM activity) AS activity_exists,
        COALESCE((SELECT value FROM score_mismatches), 0) AS score_mismatches,
        COALESCE((SELECT value FROM duplicate_activity_responses), 0) AS duplicate_activity_responses,
        COALESCE((SELECT value FROM duplicate_requests), 0) AS duplicate_requests,
        COALESCE((SELECT value FROM event_regressions), 0) AS event_regressions,
        COALESCE((SELECT value FROM invalid_events), 0) AS invalid_events,
        COALESCE((SELECT value FROM legacy_lifecycle_events), 0) AS legacy_lifecycle_events,
        COALESCE((SELECT value FROM late_answers), 0) AS late_answers,
        (SELECT occurred_at FROM close_boundary) AS close_occurred_at,
        COALESCE((SELECT event_count FROM activity_result_events), 0) AS activity_result_event_count,
        COALESCE((SELECT canonical_count FROM activity_result_events), 0) AS canonical_activity_result_count,
        COALESCE((SELECT value FROM ranking_events), 0) AS ranking_event_count
    FROM target
)
SELECT
    jsonb_build_object(
        'session_id', id,
        'activity_item_id', :'activity_item_id',
        'state', state,
        'state_version', state_version,
        'durable_participants', durable_participants,
        'durable_answers', durable_answers,
        'answered_participants', answered_participants,
        'activity_exists', activity_exists,
        'score_mismatches', score_mismatches,
        'duplicate_activity_responses', duplicate_activity_responses,
        'duplicate_requests', duplicate_requests,
        'event_regressions', event_regressions,
        'invalid_events', invalid_events,
        'legacy_lifecycle_events', legacy_lifecycle_events,
        'late_answers', late_answers,
        'close_occurred_at', close_occurred_at,
        'activity_result_event_count', activity_result_event_count,
        'canonical_activity_result_count', canonical_activity_result_count,
        'ranking_event_count', ranking_event_count
    )::text AS audit_json,
    state = 'ended'
        AND durable_participants = :expected_participants
        AND durable_answers = :expected_answers
        AND answered_participants = :expected_answers
        AND activity_exists
        AND score_mismatches = 0
        AND duplicate_activity_responses = 0
        AND duplicate_requests = 0
        AND event_regressions = 0
        AND invalid_events = 0
        AND legacy_lifecycle_events = 0
        AND late_answers = 0
        AND close_occurred_at IS NOT NULL
        AND activity_result_event_count = 1
        AND canonical_activity_result_count = 1
        AND ranking_event_count >= 1 AS audit_ok
FROM audit
\gset

\echo :audit_json
\if :audit_ok
    \echo 'canonical v2 live smoke reconciliation passed'
\else
    \echo 'canonical v2 live smoke reconciliation failed'
    \quit 1
\endif
