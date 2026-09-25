package reports

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/proslides/proslides/internal/presentations"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresStore struct {
	pool *pgxpool.Pool
}

func NewPostgresStore(pool *pgxpool.Pool) *PostgresStore {
	return &PostgresStore{pool: pool}
}

func (s *PostgresStore) presentationOwned(ctx context.Context, presentationID, ownerID string) (bool, error) {
	var owned bool
	if err := s.pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM presentations WHERE id=$1 AND owner_id=$2)`,
		presentationID, ownerID,
	).Scan(&owned); err != nil {
		return false, err
	}
	return owned, nil
}

func (s *PostgresStore) ListSessions(ctx context.Context, presentationID, ownerID string, query SessionQuery) (SessionPage, error) {
	page := SessionPage{Items: []SessionSummary{}, Limit: query.Limit}
	owned, err := s.presentationOwned(ctx, presentationID, ownerID)
	if err != nil {
		return page, err
	}
	if !owned {
		return page, ErrNotFound
	}

	var rows pgx.Rows
	if query.Cursor == nil {
		rows, err = s.pool.Query(ctx, `SELECT
			ls.id::text,
			ls.presentation_id::text,
			ls.presentation_title_snapshot,
			ls.state,
			ls.created_at,
			ls.ended_at,
			(SELECT count(*)::int FROM participants participant WHERE participant.session_id=ls.id),
			(SELECT count(*)::int FROM live_session_slides item WHERE item.session_id=ls.id AND item.kind='activity'),
			(SELECT count(*)::int FROM answers answer WHERE answer.session_id=ls.id),
			EXISTS(
				SELECT 1 FROM live_session_slides scored
				WHERE scored.session_id=ls.id
				  AND scored.kind='activity'
				  AND scored.content->'scoring'->>'mode'='points'
			)
			FROM live_sessions ls
			WHERE ls.presentation_id=$1
			ORDER BY ls.created_at DESC,ls.id DESC
			LIMIT $2`, presentationID, query.Limit+1)
	} else {
		rows, err = s.pool.Query(ctx, `SELECT
			ls.id::text,
			ls.presentation_id::text,
			ls.presentation_title_snapshot,
			ls.state,
			ls.created_at,
			ls.ended_at,
			(SELECT count(*)::int FROM participants participant WHERE participant.session_id=ls.id),
			(SELECT count(*)::int FROM live_session_slides item WHERE item.session_id=ls.id AND item.kind='activity'),
			(SELECT count(*)::int FROM answers answer WHERE answer.session_id=ls.id),
			EXISTS(
				SELECT 1 FROM live_session_slides scored
				WHERE scored.session_id=ls.id
				  AND scored.kind='activity'
				  AND scored.content->'scoring'->>'mode'='points'
			)
			FROM live_sessions ls
			WHERE ls.presentation_id=$1
			  AND (ls.created_at,ls.id)<($2,$3::uuid)
			ORDER BY ls.created_at DESC,ls.id DESC
			LIMIT $4`, presentationID, query.Cursor.CreatedAt, query.Cursor.SessionID, query.Limit+1)
	}
	if err != nil {
		return page, err
	}
	defer rows.Close()

	for rows.Next() {
		var item SessionSummary
		if err := rows.Scan(
			&item.SessionID,
			&item.PresentationID,
			&item.PresentationTitle,
			&item.State,
			&item.CreatedAt,
			&item.EndedAt,
			&item.ParticipantCount,
			&item.ActivityCount,
			&item.ResponseCount,
			&item.HasScoring,
		); err != nil {
			return page, err
		}
		page.Items = append(page.Items, item)
	}
	if err := rows.Err(); err != nil {
		return page, err
	}
	if len(page.Items) > query.Limit {
		page.HasMore = true
		page.Items = page.Items[:query.Limit]
	}
	return page, nil
}

func (s *PostgresStore) SessionReport(ctx context.Context, presentationID, sessionID, ownerID string) (SessionReport, error) {
	report := SessionReport{Activities: []ActivitySummary{}}
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead})
	if err != nil {
		return report, err
	}
	defer tx.Rollback(ctx)

	err = tx.QueryRow(ctx, `SELECT
		ls.id::text,
		ls.presentation_id::text,
		ls.presentation_title_snapshot,
		ls.state,
		ls.created_at,
		ls.ended_at,
		(SELECT count(*)::int FROM participants participant WHERE participant.session_id=ls.id),
		(SELECT count(*)::int FROM live_session_slides item WHERE item.session_id=ls.id AND item.kind='activity'),
		(SELECT count(*)::int FROM answers answer WHERE answer.session_id=ls.id),
		EXISTS(
			SELECT 1 FROM live_session_slides scored
			WHERE scored.session_id=ls.id
			  AND scored.kind='activity'
			  AND scored.content->'scoring'->>'mode'='points'
		)
		FROM live_sessions ls
		JOIN presentations p ON p.id=ls.presentation_id
		WHERE ls.id=$1 AND ls.presentation_id=$2 AND p.owner_id=$3`,
		sessionID, presentationID, ownerID,
	).Scan(
		&report.Session.SessionID,
		&report.Session.PresentationID,
		&report.Session.PresentationTitle,
		&report.Session.State,
		&report.Session.CreatedAt,
		&report.Session.EndedAt,
		&report.Session.ParticipantCount,
		&report.Session.ActivityCount,
		&report.Session.ResponseCount,
		&report.Session.HasScoring,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return report, ErrNotFound
	}
	if err != nil {
		return report, err
	}

	rows, err := tx.Query(ctx, `SELECT
		item.slide_id::text,
		item.position,
		item.content,
		(SELECT count(*)::int FROM answers answer
		 WHERE answer.session_id=item.session_id AND answer.question_slide_id=item.slide_id),
		(item.content->'scoring'->>'mode'='points')
		FROM live_session_slides item
		WHERE item.session_id=$1 AND item.kind='activity'
		ORDER BY item.position,item.slide_id`, sessionID)
	if err != nil {
		return report, err
	}
	for rows.Next() {
		var activity ActivitySummary
		if err := rows.Scan(
			&activity.ActivityItemID,
			&activity.Position,
			&activity.Definition,
			&activity.ResponseCount,
			&activity.Scored,
		); err != nil {
			rows.Close()
			return report, err
		}
		report.Activities = append(report.Activities, activity)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return report, err
	}
	rows.Close()

	if err := tx.Commit(ctx); err != nil {
		return report, err
	}
	return report, nil
}

func (s *PostgresStore) ActivityReport(ctx context.Context, presentationID, sessionID, activityID, ownerID string, query ResponseQuery) (ActivityReportPage, error) {
	page := ActivityReportPage{
		TopPerformers: []ActivityTopPerformer{},
		Responses:     []ActivityResponse{},
		Limit:         query.Limit,
	}
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead})
	if err != nil {
		return page, err
	}
	defer tx.Rollback(ctx)

	err = tx.QueryRow(ctx, `SELECT
		item.slide_id::text,
		item.position,
		item.content,
		(SELECT count(*)::int FROM answers answer
		 WHERE answer.session_id=item.session_id AND answer.question_slide_id=item.slide_id),
		(item.content->'scoring'->>'mode'='points')
		FROM live_session_slides item
		JOIN live_sessions ls ON ls.id=item.session_id
		JOIN presentations p ON p.id=ls.presentation_id
		WHERE item.session_id=$1
		  AND item.slide_id=$2
		  AND item.kind='activity'
		  AND ls.presentation_id=$3
		  AND p.owner_id=$4`,
		sessionID, activityID, presentationID, ownerID,
	).Scan(
		&page.Activity.ActivityItemID,
		&page.Activity.Position,
		&page.Activity.Definition,
		&page.Activity.ResponseCount,
		&page.Activity.Scored,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return page, ErrNotFound
	}
	if err != nil {
		return page, err
	}

	definition, err := presentations.DecodeActivityDefinition(page.Activity.Definition)
	if err != nil {
		return page, err
	}

	var resultPayload json.RawMessage
	switch definition.ActivityKind {
	case presentations.ActivityKindChoice:
		indexedCounts := map[int]int{}
		countRows, countErr := tx.Query(ctx, `SELECT selected.value::int,count(*)::int
			FROM answers answer
			CROSS JOIN LATERAL jsonb_array_elements_text(
				COALESCE(answer.answer->'selected_option_indexes','[]'::jsonb)
			) selected(value)
			WHERE answer.session_id=$1 AND answer.question_slide_id=$2
			GROUP BY selected.value::int`, sessionID, activityID)
		if countErr != nil {
			return page, countErr
		}
		for countRows.Next() {
			var index, count int
			if scanErr := countRows.Scan(&index, &count); scanErr != nil {
				countRows.Close()
				return page, scanErr
			}
			indexedCounts[index] = count
		}
		if rowsErr := countRows.Err(); rowsErr != nil {
			countRows.Close()
			return page, rowsErr
		}
		countRows.Close()
		resultPayload, err = choiceResultPayload(definition, indexedCounts)

	case presentations.ActivityKindText:
		type termCount struct {
			Text  string `json:"text"`
			Count int    `json:"count"`
		}
		terms := make([]termCount, 0, 100)
		termRows, termErr := tx.Query(ctx, `SELECT term.value,count(*)::int
			FROM answers answer
			CROSS JOIN LATERAL jsonb_array_elements_text(
				COALESCE(answer.answer->'terms','[]'::jsonb)
			) term(value)
			WHERE answer.session_id=$1 AND answer.question_slide_id=$2
			GROUP BY term.value
			ORDER BY count(*) DESC,term.value
			LIMIT 100`, sessionID, activityID)
		if termErr != nil {
			return page, termErr
		}
		for termRows.Next() {
			var term termCount
			if scanErr := termRows.Scan(&term.Text, &term.Count); scanErr != nil {
				termRows.Close()
				return page, scanErr
			}
			terms = append(terms, term)
		}
		if rowsErr := termRows.Err(); rowsErr != nil {
			termRows.Close()
			return page, rowsErr
		}
		termRows.Close()
		resultPayload, err = json.Marshal(map[string]any{"terms": terms})

	default:
		return page, errors.New("unsupported Activity kind in report")
	}
	if err != nil {
		return page, err
	}
	page.Result = ActivityResult{
		ActivityItemID: activityID,
		ActivityKind:   definition.ActivityKind,
		SchemaVersion:  definition.SchemaVersion,
		ResponseCount:  page.Activity.ResponseCount,
		Payload:        resultPayload,
	}

	if page.Activity.Scored {
		performerRows, performerErr := tx.Query(ctx, `WITH ranked AS (
			SELECT
				answer.id,
				participant.id AS participant_id,
				participant.display_name,
				COALESCE(participant.avatar,'') AS avatar,
				answer.score_delta,
				answer.submitted_at,
				RANK() OVER (ORDER BY answer.score_delta DESC)::int AS rank
			FROM answers answer
			JOIN participants participant ON participant.id=answer.participant_id
			WHERE answer.session_id=$1 AND answer.question_slide_id=$2
		)
		SELECT participant_id::text,display_name,avatar,score_delta,rank
		FROM ranked
		ORDER BY score_delta DESC,submitted_at,id
		LIMIT 10`, sessionID, activityID)
		if performerErr != nil {
			return page, performerErr
		}
		for performerRows.Next() {
			var performer ActivityTopPerformer
			if err := performerRows.Scan(
				&performer.ParticipantID,
				&performer.DisplayName,
				&performer.Avatar,
				&performer.ScoreDelta,
				&performer.Rank,
			); err != nil {
				performerRows.Close()
				return page, err
			}
			page.TopPerformers = append(page.TopPerformers, performer)
		}
		if err := performerRows.Err(); err != nil {
			performerRows.Close()
			return page, err
		}
		performerRows.Close()
	}

	var responseRows pgx.Rows
	if query.Cursor == nil {
		responseRows, err = tx.Query(ctx, `SELECT
			answer.id::text,
			participant.id::text,
			participant.display_name,
			COALESCE(participant.avatar,''),
			answer.answer,
			answer.score_delta,
			answer.submitted_at
			FROM answers answer
			JOIN participants participant ON participant.id=answer.participant_id
			WHERE answer.session_id=$1 AND answer.question_slide_id=$2
			ORDER BY answer.submitted_at DESC,answer.id DESC
			LIMIT $3`, sessionID, activityID, query.Limit+1)
	} else {
		responseRows, err = tx.Query(ctx, `SELECT
			answer.id::text,
			participant.id::text,
			participant.display_name,
			COALESCE(participant.avatar,''),
			answer.answer,
			answer.score_delta,
			answer.submitted_at
			FROM answers answer
			JOIN participants participant ON participant.id=answer.participant_id
			WHERE answer.session_id=$1
			  AND answer.question_slide_id=$2
			  AND (answer.submitted_at,answer.id)<($3,$4::uuid)
			ORDER BY answer.submitted_at DESC,answer.id DESC
			LIMIT $5`, sessionID, activityID, query.Cursor.SubmittedAt, query.Cursor.AnswerID, query.Limit+1)
	}
	if err != nil {
		return page, err
	}
	for responseRows.Next() {
		var response ActivityResponse
		var scoreDelta int
		if err := responseRows.Scan(
			&response.AnswerID,
			&response.ParticipantID,
			&response.DisplayName,
			&response.Avatar,
			&response.Response,
			&scoreDelta,
			&response.SubmittedAt,
		); err != nil {
			responseRows.Close()
			return page, err
		}
		response.Evaluation, err = evaluateResponse(page.Activity.Definition, response.Response, scoreDelta)
		if err != nil {
			responseRows.Close()
			return page, err
		}
		page.Responses = append(page.Responses, response)
	}
	if err := responseRows.Err(); err != nil {
		responseRows.Close()
		return page, err
	}
	responseRows.Close()
	if len(page.Responses) > query.Limit {
		page.HasMore = true
		page.Responses = page.Responses[:query.Limit]
	}

	if err := tx.Commit(ctx); err != nil {
		return page, err
	}
	return page, nil
}

func (s *PostgresStore) Ranking(ctx context.Context, presentationID, sessionID, ownerID string, query RankingQuery) (RankingPage, error) {
	page := RankingPage{Items: []RankingEntry{}, Limit: query.Limit}
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead})
	if err != nil {
		return page, err
	}
	defer tx.Rollback(ctx)

	var state string
	err = tx.QueryRow(ctx, `SELECT
		ls.state,
		EXISTS(
			SELECT 1 FROM live_session_slides scored
			WHERE scored.session_id=ls.id
			  AND scored.kind='activity'
			  AND scored.content->'scoring'->>'mode'='points'
		)
		FROM live_sessions ls
		JOIN presentations p ON p.id=ls.presentation_id
		WHERE ls.id=$1 AND ls.presentation_id=$2 AND p.owner_id=$3`,
		sessionID, presentationID, ownerID,
	).Scan(&state, &page.HasScoring)
	if errors.Is(err, pgx.ErrNoRows) {
		return page, ErrNotFound
	}
	if err != nil {
		return page, err
	}
	page.IsFinal = state == "ended"
	if !page.HasScoring {
		if err := tx.Commit(ctx); err != nil {
			return page, err
		}
		return page, nil
	}

	// Cumulative scores are mutable while a Session is running, so a score-based
	// cursor cannot provide stable pagination until the Session is final.
	// Active reports expose a bounded top slice only; ended Sessions paginate.
	if !page.IsFinal {
		query.Cursor = nil
	}

	var rows pgx.Rows
	if query.Cursor == nil {
		rows, err = tx.Query(ctx, `WITH ranked AS (
			SELECT
				id,
				display_name,
				COALESCE(avatar,'') AS avatar,
				score,
				joined_at,
				RANK() OVER (ORDER BY score DESC)::int AS rank
			FROM participants
			WHERE session_id=$1
		)
		SELECT id::text,display_name,avatar,score,rank,joined_at
		FROM ranked
		ORDER BY score DESC,joined_at,id
		LIMIT $2`, sessionID, query.Limit+1)
	} else {
		rows, err = tx.Query(ctx, `WITH ranked AS (
			SELECT
				id,
				display_name,
				COALESCE(avatar,'') AS avatar,
				score,
				joined_at,
				RANK() OVER (ORDER BY score DESC)::int AS rank
			FROM participants
			WHERE session_id=$1
		)
		SELECT id::text,display_name,avatar,score,rank,joined_at
		FROM ranked
		WHERE score<$2 OR (score=$2 AND (joined_at,id)>($3,$4::uuid))
		ORDER BY score DESC,joined_at,id
		LIMIT $5`, sessionID, query.Cursor.Score, query.Cursor.JoinedAt, query.Cursor.ParticipantID, query.Limit+1)
	}
	if err != nil {
		return page, err
	}
	for rows.Next() {
		var item RankingEntry
		if err := rows.Scan(
			&item.ParticipantID,
			&item.DisplayName,
			&item.Avatar,
			&item.Score,
			&item.Rank,
			&item.JoinedAt,
		); err != nil {
			rows.Close()
			return page, err
		}
		page.Items = append(page.Items, item)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return page, err
	}
	rows.Close()
	if len(page.Items) > query.Limit {
		page.Items = page.Items[:query.Limit]
		page.HasMore = page.IsFinal
	}

	if err := tx.Commit(ctx); err != nil {
		return page, err
	}
	return page, nil
}

