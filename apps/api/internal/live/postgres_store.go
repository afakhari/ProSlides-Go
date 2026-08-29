package live

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresStore struct{ pool *pgxpool.Pool }

func NewPostgresStore(pool *pgxpool.Pool) *PostgresStore { return &PostgresStore{pool: pool} }

func (s *PostgresStore) CreateSession(c context.Context, host, presentation, request, code string) (Session, bool, error) {
	var out Session
	tx, e := s.pool.Begin(c)
	if e != nil {
		return out, false, e
	}
	defer tx.Rollback(c)
	if _, e = tx.Exec(c, `SELECT pg_advisory_xact_lock(hashtextextended('live-session:' || $1::text || ':' || $2::text, 0))`, host, presentation); e != nil {
		return out, false, e
	}
	if e = scanSession(tx.QueryRow(c, `SELECT id::text,presentation_id::text,host_id::text,join_code,state,state_version,active_slide_id::text,ends_at FROM live_sessions WHERE host_id=$1 AND presentation_id=$2 AND state<>'ended'`, host, presentation), &out); e == nil {
		return out, true, nil
	} else if !errors.Is(e, pgx.ErrNoRows) {
		return out, false, e
	}
	if e = scanSession(tx.QueryRow(c, `SELECT id::text,presentation_id::text,host_id::text,join_code,state,state_version,active_slide_id::text,ends_at FROM live_sessions WHERE host_id=$1 AND request_id=$2`, host, request), &out); e == nil {
		return out, true, nil
	} else if !errors.Is(e, pgx.ErrNoRows) {
		return out, false, e
	}
	e = scanSession(tx.QueryRow(c, `INSERT INTO live_sessions(presentation_id,host_id,join_code,state,request_id) SELECT id,$1,COALESCE(access_code,$3),'draft',$4 FROM presentations WHERE id=$2 AND owner_id=$1 RETURNING id::text,presentation_id::text,host_id::text,join_code,state,state_version,active_slide_id::text,ends_at`, host, presentation, code, request), &out)
	if errors.Is(e, pgx.ErrNoRows) {
		return out, false, ErrNotFound
	}
	if e != nil {
		return out, false, mapPG(e)
	}
	if _, e = tx.Exec(c, `INSERT INTO live_session_slides(session_id,slide_id,revision,position,kind,content)
		SELECT $1,id,revision,position,kind,content FROM slides WHERE presentation_id=$2`, out.ID, out.PresentationID); e != nil {
		return out, false, e
	}
	if e = insertEvent(c, tx, out.ID, out.StateVersion, "session.created", map[string]any{"state": out.State}); e != nil {
		return out, false, e
	}
	if e = tx.Commit(c); e != nil {
		return out, false, e
	}
	return out, false, nil
}
func (s *PostgresStore) ResolveSession(c context.Context, code string) (SessionLocator, error) {
	var out SessionLocator
	err := s.pool.QueryRow(c, `SELECT ls.id::text,ls.presentation_id::text,p.title,
		CASE WHEN p.settings->>'background_color' ~ '^#[0-9A-Fa-f]{6}$' THEN p.settings->>'background_color' ELSE '#1e1e2e' END,
		COALESCE(p.settings->>'background_image_url',''),
		CASE WHEN p.settings->>'text_color' ~ '^#[0-9A-Fa-f]{6}$' THEN p.settings->>'text_color' ELSE '#ffffff' END
		FROM live_sessions ls JOIN presentations p ON p.id=ls.presentation_id
		WHERE ls.join_code=$1 AND ls.state<>'ended' LIMIT 1`, code).Scan(
		&out.SessionID, &out.PresentationID, &out.Presentation.Title,
		&out.Presentation.BackgroundColor, &out.Presentation.BackgroundImageURL,
		&out.Presentation.TextColor)
	if errors.Is(err, pgx.ErrNoRows) {
		return out, ErrNotFound
	}
	return out, err
}
func (s *PostgresStore) Join(c context.Context, session, request, name, avatar string, hash []byte) (Participant, bool, error) {
	var p Participant
	tx, e := s.pool.Begin(c)
	if e != nil {
		return p, false, e
	}
	defer tx.Rollback(c)
	// Check idempotency before session state so a retry always returns the
	// original committed result, including after the session has ended. Keeping
	// the lookup in this transaction avoids a second pool acquisition normally.
	if e = tx.QueryRow(c, `SELECT id::text,display_name,COALESCE(avatar,'') FROM participants WHERE session_id=$1 AND request_id=$2`, session, request).Scan(&p.ID, &p.DisplayName, &p.Avatar); e == nil {
		return p, true, nil
	} else if !errors.Is(e, pgx.ErrNoRows) {
		return p, false, e
	}
	var version int64
	e = tx.QueryRow(c, `SELECT state_version FROM live_sessions WHERE id=$1 AND state NOT IN ('draft','ended') FOR SHARE`, session).Scan(&version)
	if errors.Is(e, pgx.ErrNoRows) {
		return p, false, ErrConflict
	}
	if e != nil {
		return p, false, e
	}
	e = tx.QueryRow(c, `INSERT INTO participants(session_id,display_name,avatar,request_id,token_hash) VALUES($1,$2,$3,$4,$5) RETURNING id::text,display_name,COALESCE(avatar,'')`, session, name, avatar, request, hash).Scan(&p.ID, &p.DisplayName, &p.Avatar)
	if e != nil {
		if isUniqueViolation(e) {
			_ = tx.Rollback(c)
			if duplicateErr := s.pool.QueryRow(c, `SELECT id::text,display_name,COALESCE(avatar,'') FROM participants WHERE session_id=$1 AND request_id=$2`, session, request).Scan(&p.ID, &p.DisplayName, &p.Avatar); duplicateErr == nil {
				return p, true, nil
			}
		}
		return p, false, mapPG(e)
	}
	if e = insertEvent(c, tx, session, version, "presence.updated", map[string]any{"participant_delta": 1}); e != nil {
		return p, false, e
	}
	if e = tx.Commit(c); e != nil {
		return p, false, e
	}
	return p, false, nil
}
func (s *PostgresStore) ApplyAction(c context.Context, session, host, request string, expected int64, action, slide string, duration int) (Session, bool, error) {
	var out Session
	var prior []byte
	if e := s.pool.QueryRow(c, `SELECT c.result FROM live_commands c JOIN live_sessions l ON l.id=c.session_id WHERE c.session_id=$1 AND c.request_id=$2 AND l.host_id=$3`, session, request, host).Scan(&prior); e == nil {
		if e = json.Unmarshal(prior, &out); e != nil {
			return out, true, e
		}
		return out, true, nil
	} else if !errors.Is(e, pgx.ErrNoRows) {
		return out, false, e
	}
	tx, e := s.pool.BeginTx(c, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if e != nil {
		return out, false, e
	}
	defer tx.Rollback(c)
	e = scanSession(tx.QueryRow(c, `SELECT id::text,presentation_id::text,host_id::text,join_code,state,state_version,active_slide_id::text,ends_at FROM live_sessions WHERE id=$1 AND host_id=$2 FOR UPDATE`, session, host), &out)
	if errors.Is(e, pgx.ErrNoRows) {
		return out, false, ErrNotFound
	}
	if e != nil {
		return out, false, e
	}
	if e = tx.QueryRow(c, `SELECT c.result FROM live_commands c JOIN live_sessions l ON l.id=c.session_id WHERE c.session_id=$1 AND c.request_id=$2 AND l.host_id=$3`, session, request, host).Scan(&prior); e == nil {
		if e = json.Unmarshal(prior, &out); e != nil {
			return out, true, e
		}
		return out, true, nil
	} else if !errors.Is(e, pgx.ErrNoRows) {
		return out, false, e
	}
	if out.StateVersion != expected {
		return out, false, ErrConflict
	}
	to, e := actionTarget(out.State, action)
	if e != nil || !CanTransition(out.State, to) {
		return out, false, ErrInvalidTransition
	}
	var active any = out.ActiveSlideID
	var ends any
	if action == "open_content" || action == "open_question" {
		var kind string
		var content []byte
		e = tx.QueryRow(c, `SELECT kind,content FROM live_session_slides WHERE session_id=$1 AND slide_id=$2`, session, slide).Scan(&kind, &content)
		if errors.Is(e, pgx.ErrNoRows) {
			return out, false, ErrNotFound
		}
		if e != nil {
			return out, false, e
		}
		if action == "open_question" && kind != "question" {
			return out, false, ErrInvalid
		}
		if action == "open_content" && kind != "content" {
			return out, false, ErrInvalid
		}
		active = slide
		if action == "open_question" {
			var configured struct {
				QuestionTime int `json:"question_time"`
			}
			_ = json.Unmarshal(content, &configured)
			if configured.QuestionTime > 0 {
				duration = configured.QuestionTime
			}
			if duration < 1 || duration > 86400 {
				return out, false, ErrInvalid
			}
			var deadline time.Time
			if e = tx.QueryRow(c, `SELECT clock_timestamp()+make_interval(secs=>$1)`, duration).Scan(&deadline); e != nil {
				return out, false, e
			}
			ends = deadline
		}
	}
	if action == "end" {
		active = nil
		ends = nil
	}
	e = scanSession(tx.QueryRow(c, `UPDATE live_sessions SET state=$2,state_version=state_version+1,active_slide_id=$3,ends_at=$4,ended_at=CASE WHEN $2='ended' THEN now() ELSE ended_at END,updated_at=now() WHERE id=$1 RETURNING id::text,presentation_id::text,host_id::text,join_code,state,state_version,active_slide_id::text,ends_at`, session, to, active, ends), &out)
	if e != nil {
		return out, false, e
	}
	resultJSON, _ := json.Marshal(out)
	_, e = tx.Exec(c, `INSERT INTO live_commands(session_id,request_id,action,result_state,result_state_version,result) VALUES($1,$2,$3,$4,$5,$6)`, session, request, action, out.State, out.StateVersion, resultJSON)
	if e != nil {
		return out, false, mapPG(e)
	}
	if e = insertEvent(c, tx, session, out.StateVersion, "session.state_changed", map[string]any{"state": out.State, "active_slide_id": out.ActiveSlideID, "ends_at": out.EndsAt}); e != nil {
		return out, false, e
	}
	if action == "close_question" && out.ActiveSlideID != nil {
		stats, statsErr := answerStats(c, tx, session, *out.ActiveSlideID)
		if statsErr != nil {
			return out, false, statsErr
		}
		if e = insertEvent(c, tx, session, out.StateVersion, "answer.stats", stats); e != nil {
			return out, false, e
		}
	}
	if action == "show_leaderboard" {
		leaderboard, leaderboardErr := leaderboardSummary(c, tx, session)
		if leaderboardErr != nil {
			return out, false, leaderboardErr
		}
		if e = insertEvent(c, tx, session, out.StateVersion, "leaderboard.updated", leaderboard); e != nil {
			return out, false, e
		}
	}
	if e = tx.Commit(c); e != nil {
		return out, false, e
	}
	return out, false, nil
}

// ReconcileDeadline makes expiry a durable state transition. The UPDATE takes
// an exclusive row lock, so it waits for answers already admitted under the
// shared session lock and prevents answers admitted after the database clock
// deadline from slipping through.
func (s *PostgresStore) ReconcileDeadline(c context.Context, session string) (bool, error) {
	// Expiry is rare compared with snapshots and broker ticks. Avoid opening and
	// rolling back a write transaction for the overwhelmingly common no-op path.
	// The conditional UPDATE below remains the authoritative race winner.
	var expired bool
	if e := s.pool.QueryRow(c, `SELECT state='question_open' AND ends_at<=clock_timestamp() FROM live_sessions WHERE id=$1`, session).Scan(&expired); errors.Is(e, pgx.ErrNoRows) {
		return false, nil
	} else if e != nil {
		return false, e
	} else if !expired {
		return false, nil
	}
	tx, e := s.pool.BeginTx(c, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if e != nil {
		return false, e
	}
	defer tx.Rollback(c)
	changed, e := reconcileDeadlineTx(c, tx, session)
	if e != nil {
		return false, e
	}
	if !changed {
		return false, nil
	}
	if e = tx.Commit(c); e != nil {
		return false, e
	}
	return true, nil
}

func reconcileDeadlineTx(c context.Context, tx pgx.Tx, session string) (bool, error) {
	var out Session
	e := scanSession(tx.QueryRow(c, `UPDATE live_sessions
		SET state='question_closed',state_version=state_version+1,ends_at=NULL,updated_at=clock_timestamp()
		WHERE id=$1 AND state='question_open' AND ends_at<=clock_timestamp()
		RETURNING id::text,presentation_id::text,host_id::text,join_code,state,state_version,active_slide_id::text,ends_at`, session), &out)
	if errors.Is(e, pgx.ErrNoRows) {
		return false, nil
	}
	if e != nil {
		return false, mapPG(e)
	}
	if e = insertEvent(c, tx, session, out.StateVersion, "session.state_changed", map[string]any{"state": out.State, "active_slide_id": out.ActiveSlideID, "ends_at": nil, "reason": "deadline_elapsed"}); e != nil {
		return false, e
	}
	if out.ActiveSlideID != nil {
		stats, statsErr := answerStats(c, tx, session, *out.ActiveSlideID)
		if statsErr != nil {
			return false, statsErr
		}
		if e = insertEvent(c, tx, session, out.StateVersion, "answer.stats", stats); e != nil {
			return false, e
		}
	}
	return true, nil
}

func (s *PostgresStore) SubmitAnswer(c context.Context, session string, hash []byte, request, slide string, selected []int, policy ScoringPolicy) (AnswerResult, error) {
	var result AnswerResult
	tx, e := s.pool.BeginTx(c, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if e != nil {
		return result, e
	}
	defer tx.Rollback(c)
	var participant string
	var duplicateID *string
	var duplicateScore *int
	e = tx.QueryRow(c, `SELECT p.id::text,a.id::text,a.score_delta
		FROM participants p
		LEFT JOIN answers a ON a.session_id=p.session_id AND a.participant_id=p.id AND a.request_id=$3
		WHERE p.session_id=$1 AND p.token_hash=$2`, session, hash, request).Scan(&participant, &duplicateID, &duplicateScore)
	if errors.Is(e, pgx.ErrNoRows) {
		return result, ErrUnauthorized
	}
	if e != nil {
		return result, e
	}
	if duplicateID != nil && duplicateScore != nil {
		result.AnswerID = *duplicateID
		result.ScoreDelta = *duplicateScore
		result.Duplicate = true
		return result, nil
	}
	var active, state string
	var remainingSeconds float64
	var content []byte
	e = tx.QueryRow(c, `SELECT l.active_slide_id::text,l.state,sl.content,
		COALESCE(GREATEST(0,EXTRACT(EPOCH FROM l.ends_at-clock_timestamp())),0)::float8
		FROM live_sessions l JOIN live_session_slides sl ON sl.session_id=l.id AND sl.slide_id=l.active_slide_id
		WHERE l.id=$1 FOR SHARE OF l`, session).Scan(&active, &state, &content, &remainingSeconds)
	if errors.Is(e, pgx.ErrNoRows) {
		return result, ErrConflict
	}
	if e != nil {
		return result, e
	}
	if state != string(QuestionOpen) || active != slide || remainingSeconds <= 0 {
		return result, ErrConflict
	}
	var q struct {
		QuestionType   string `json:"question_type"`
		MaxPoints      int    `json:"max_point"`
		MinPoints      int    `json:"min_point"`
		QuestionTime   int    `json:"question_time"`
		FasterAnswers  bool   `json:"faster_answers_more_points"`
		PartialScoring bool   `json:"partial_scoring"`
		Options        []struct {
			IsCorrect bool `json:"is_correct"`
		} `json:"options"`
	}
	if json.Unmarshal(content, &q) != nil {
		return result, ErrInvalid
	}
	if q.MaxPoints <= 0 {
		q.MaxPoints = 100
	}
	seen := map[int]bool{}
	for _, index := range selected {
		if index >= len(q.Options) || seen[index] {
			return result, ErrInvalid
		}
		seen[index] = true
	}
	if q.QuestionType == "single" && len(selected) != 1 {
		return result, ErrInvalid
	}
	correct := []int{}
	for i, o := range q.Options {
		if o.IsCorrect {
			correct = append(correct, i)
		}
	}
	score := policy.Score(Question{Type: q.QuestionType, Correct: correct, MaxPoints: q.MaxPoints, MinPoints: q.MinPoints, PartialScoring: q.PartialScoring, FasterAnswers: q.FasterAnswers, Duration: time.Duration(q.QuestionTime) * time.Second, Remaining: time.Duration(remainingSeconds * float64(time.Second))}, selected)
	answer, _ := json.Marshal(map[string]any{"selected_option_indexes": selected})
	e = tx.QueryRow(c, `WITH inserted AS (
			INSERT INTO answers(session_id,participant_id,question_slide_id,request_id,answer,score_delta)
			VALUES($1,$2,$3,$4,$5,$6)
			RETURNING id,score_delta
		), updated AS (
			UPDATE participants p SET score=p.score+inserted.score_delta
			FROM inserted WHERE p.id=$2 RETURNING p.id
		)
		SELECT inserted.id::text,inserted.score_delta FROM inserted JOIN updated ON true`, session, participant, slide, request, answer, score).Scan(&result.AnswerID, &result.ScoreDelta)
	if e != nil {
		if isUniqueViolation(e) {
			_ = tx.Rollback(c)
			if duplicateErr := s.pool.QueryRow(c, `SELECT id::text,score_delta FROM answers WHERE session_id=$1 AND participant_id=$2 AND request_id=$3`, session, participant, request).Scan(&result.AnswerID, &result.ScoreDelta); duplicateErr == nil {
				result.Duplicate = true
				return result, nil
			}
		}
		return result, mapPG(e)
	}
	if e = tx.Commit(c); e != nil {
		return result, e
	}
	return result, nil
}
func (s *PostgresStore) ParticipantSnapshot(c context.Context, session string, hash []byte) (ParticipantSnapshot, error) {
	var x ParticipantSnapshot
	tx, e := s.pool.BeginTx(c, pgx.TxOptions{IsoLevel: pgx.RepeatableRead})
	if e != nil {
		return x, e
	}
	defer tx.Rollback(c)
	if _, e = reconcileDeadlineTx(c, tx, session); e != nil {
		return x, e
	}
	var full Session
	e = tx.QueryRow(c, `SELECT l.id::text,l.presentation_id::text,l.host_id::text,l.join_code,l.state,l.state_version,l.active_slide_id::text,l.ends_at,p.id::text,p.display_name,COALESCE(p.avatar,''),p.score,
		CASE WHEN l.state IN ('leaderboard','ended') THEN (SELECT count(*)::int+1 FROM participants ranked WHERE ranked.session_id=p.session_id AND (ranked.score>p.score OR (ranked.score=p.score AND (ranked.joined_at,ranked.id)<(p.joined_at,p.id)))) END,
		(SELECT count(*)::int FROM participants counted WHERE counted.session_id=l.id),
		COALESCE((SELECT max(event_id) FROM live_events WHERE session_id=l.id),0),
		(SELECT jsonb_build_object('id',slide_id,'position',position,'kind',kind,'content',content) FROM live_session_slides WHERE session_id=l.id AND slide_id=l.active_slide_id)
		FROM live_sessions l JOIN participants p ON p.session_id=l.id
		WHERE l.id=$1 AND p.token_hash=$2`, session, hash).Scan(
		&full.ID, &full.PresentationID, &full.HostID, &full.JoinCode, &full.State, &full.StateVersion, &full.ActiveSlideID, &full.EndsAt,
		&x.Participant.ID, &x.Participant.DisplayName, &x.Participant.Avatar, &x.Participant.Score, &x.Participant.Rank,
		&x.ParticipantCount, &x.LastEventID, &x.ActiveSlide,
	)
	if errors.Is(e, pgx.ErrNoRows) {
		return x, ErrUnauthorized
	}
	if e != nil {
		return x, e
	}
	x.Role = "participant"
	x.Session = publicSession(full)
	if e = snapshotQuestionStats(c, tx, session, full.State, full.ActiveSlideID, &x.QuestionStats); e != nil {
		return x, e
	}
	if x.ActiveSlide, e = sanitizeParticipantActiveSlide(x.ActiveSlide); e != nil {
		return x, e
	}
	if e = tx.Commit(c); e != nil {
		return x, e
	}
	return x, nil
}
func (s *PostgresStore) ManagerSnapshot(c context.Context, session, manager string) (ManagerSnapshot, error) {
	var x ManagerSnapshot
	tx, e := s.pool.BeginTx(c, pgx.TxOptions{IsoLevel: pgx.RepeatableRead})
	if e != nil {
		return x, e
	}
	defer tx.Rollback(c)
	if _, e = reconcileDeadlineTx(c, tx, session); e != nil {
		return x, e
	}
	e = tx.QueryRow(c, `SELECT id::text,presentation_id::text,host_id::text,join_code,state,state_version,active_slide_id::text,ends_at,
		(SELECT count(*)::int FROM participants WHERE session_id=live_sessions.id),
		COALESCE((SELECT max(event_id) FROM live_events WHERE session_id=live_sessions.id),0),
		(SELECT jsonb_build_object('id',slide_id,'position',position,'kind',kind,'content',content) FROM live_session_slides WHERE session_id=live_sessions.id AND slide_id=live_sessions.active_slide_id)
		FROM live_sessions WHERE id=$1 AND host_id=$2`, session, manager).Scan(
		&x.Session.ID, &x.Session.PresentationID, &x.Session.HostID, &x.Session.JoinCode, &x.Session.State, &x.Session.StateVersion, &x.Session.ActiveSlideID, &x.Session.EndsAt,
		&x.ParticipantCount, &x.LastEventID, &x.ActiveSlide,
	)
	if errors.Is(e, pgx.ErrNoRows) {
		return x, ErrNotFound
	}
	if e != nil {
		return x, e
	}
	x.Role = "manager"
	if e = snapshotQuestionStats(c, tx, session, x.Session.State, x.Session.ActiveSlideID, &x.QuestionStats); e != nil {
		return x, e
	}
	if e = tx.Commit(c); e != nil {
		return x, e
	}
	return x, nil
}
func (s *PostgresStore) Roster(c context.Context, session, manager string, query RosterQuery) (RosterPage, error) {
	page := RosterPage{Items: []RosterEntry{}, Order: query.Order, Limit: query.Limit}
	var owned bool
	if e := s.pool.QueryRow(c, `SELECT EXISTS(SELECT 1 FROM live_sessions WHERE id=$1 AND host_id=$2)`, session, manager).Scan(&owned); e != nil {
		return page, e
	}
	if !owned {
		return page, ErrNotFound
	}
	var rows pgx.Rows
	var e error
	if query.Order == "score" {
		if query.Cursor == nil {
			rows, e = s.pool.Query(c, `SELECT id::text,display_name,COALESCE(avatar,''),score,joined_at FROM participants WHERE session_id=$1 ORDER BY score DESC,joined_at,id LIMIT $2`, session, query.Limit+1)
		} else {
			rows, e = s.pool.Query(c, `SELECT id::text,display_name,COALESCE(avatar,''),score,joined_at FROM participants WHERE session_id=$1 AND (score<$2 OR (score=$2 AND (joined_at,id)>($3,$4::uuid))) ORDER BY score DESC,joined_at,id LIMIT $5`, session, query.Cursor.Score, query.Cursor.JoinedAt, query.Cursor.ID, query.Limit+1)
		}
	} else if query.Cursor == nil {
		rows, e = s.pool.Query(c, `SELECT id::text,display_name,COALESCE(avatar,''),score,joined_at FROM participants WHERE session_id=$1 ORDER BY joined_at,id LIMIT $2`, session, query.Limit+1)
	} else {
		rows, e = s.pool.Query(c, `SELECT id::text,display_name,COALESCE(avatar,''),score,joined_at FROM participants WHERE session_id=$1 AND (joined_at,id)>($2,$3::uuid) ORDER BY joined_at,id LIMIT $4`, session, query.Cursor.JoinedAt, query.Cursor.ID, query.Limit+1)
	}
	if e != nil {
		return page, mapPG(e)
	}
	defer rows.Close()
	for rows.Next() {
		var item RosterEntry
		if e = rows.Scan(&item.ParticipantID, &item.DisplayName, &item.Avatar, &item.Score, &item.JoinedAt); e != nil {
			return page, e
		}
		page.Items = append(page.Items, item)
	}
	if e = rows.Err(); e != nil {
		return page, e
	}
	if len(page.Items) > query.Limit {
		page.HasMore = true
		page.Items = page.Items[:query.Limit]
	}
	return page, nil
}

func snapshotQuestionStats(c context.Context, tx pgx.Tx, session string, state State, activeSlideID *string, target **QuestionStats) error {
	if activeSlideID == nil || (state != QuestionClosed && state != Leaderboard) {
		return nil
	}
	stats, err := answerStats(c, tx, session, *activeSlideID)
	if err != nil {
		return err
	}
	*target = &stats
	return nil
}

func sanitizeParticipantActiveSlide(raw json.RawMessage) (json.RawMessage, error) {
	if len(raw) == 0 {
		return raw, nil
	}
	var slide any
	if err := json.Unmarshal(raw, &slide); err != nil {
		return nil, err
	}
	stripCorrectnessMetadata(slide)
	return json.Marshal(slide)
}

func stripCorrectnessMetadata(value any) {
	switch typed := value.(type) {
	case map[string]any:
		delete(typed, "is_correct")
		delete(typed, "correct_answer")
		delete(typed, "correct_option_indexes")
		for _, child := range typed {
			stripCorrectnessMetadata(child)
		}
	case []any:
		for _, child := range typed {
			stripCorrectnessMetadata(child)
		}
	}
}

func publicSession(session Session) PublicSession {
	return PublicSession{ID: session.ID, PresentationID: session.PresentationID, State: session.State, StateVersion: session.StateVersion, ActiveSlideID: session.ActiveSlideID, EndsAt: session.EndsAt}
}
func (s *PostgresStore) Events(c context.Context, session string, after int64, limit int) ([]Event, error) {
	rows, e := s.pool.Query(c, `SELECT event_id,schema_version,session_id::text,state_version,name,payload,occurred_at FROM live_events WHERE session_id=$1 AND event_id>$2 ORDER BY event_id LIMIT $3`, session, after, limit)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := []Event{}
	for rows.Next() {
		var x Event
		if e = rows.Scan(&x.EventID, &x.SchemaVersion, &x.SessionID, &x.StateVersion, &x.Name, &x.Payload, &x.OccurredAt); e != nil {
			return nil, e
		}
		if e = sanitizeReplayedEvent(&x); e != nil {
			return nil, e
		}
		out = append(out, x)
	}
	return out, rows.Err()
}
func (s *PostgresStore) LatestEventID(c context.Context, session string) (int64, error) {
	var id int64
	e := s.pool.QueryRow(c, `SELECT COALESCE(max(event_id),0) FROM live_events WHERE session_id=$1`, session).Scan(&id)
	return id, e
}
func (s *PostgresStore) AuthorizeViewer(c context.Context, session, manager string, hash []byte) error {
	var ok bool
	e := s.pool.QueryRow(c, `SELECT EXISTS(SELECT 1 FROM live_sessions l WHERE l.id=$1 AND (l.host_id::text=$2 OR EXISTS(SELECT 1 FROM participants p WHERE p.session_id=l.id AND p.token_hash=$3)))`, session, manager, hash).Scan(&ok)
	if e != nil {
		return e
	}
	if !ok {
		return ErrUnauthorized
	}
	return nil
}
func scanSession(row pgx.Row, x *Session) error {
	return row.Scan(&x.ID, &x.PresentationID, &x.HostID, &x.JoinCode, &x.State, &x.StateVersion, &x.ActiveSlideID, &x.EndsAt)
}
func insertEvent(c context.Context, tx pgx.Tx, session string, version int64, name string, payload any) error {
	b, _ := json.Marshal(payload)
	schemaVersion := 1
	if name == "leaderboard.updated" {
		schemaVersion = 2
	}
	_, e := tx.Exec(c, `INSERT INTO live_events(schema_version,session_id,state_version,name,payload)VALUES($1,$2,$3,$4,$5)`, schemaVersion, session, version, name, b)
	return e
}

func sanitizeReplayedEvent(event *Event) error {
	if event.Name != "leaderboard.updated" {
		return nil
	}
	var rows []json.RawMessage
	payload := bytes.TrimSpace(event.Payload)
	if len(payload) > 0 && payload[0] == '[' {
		if e := json.Unmarshal(event.Payload, &rows); e != nil {
			return e
		}
		event.Payload, _ = json.Marshal(map[string]int{"participant_count": len(rows)})
	}
	event.SchemaVersion = 2
	return nil
}

func answerStats(c context.Context, tx pgx.Tx, session, slide string) (QuestionStats, error) {
	counts := map[string]int{}
	rows, e := tx.Query(c, `SELECT selected.value, count(*)::int
		FROM answers a
		CROSS JOIN LATERAL jsonb_array_elements_text(a.answer->'selected_option_indexes') selected(value)
		WHERE a.session_id=$1 AND a.question_slide_id=$2
		GROUP BY selected.value`, session, slide)
	if e != nil {
		return QuestionStats{}, e
	}
	defer rows.Close()
	for rows.Next() {
		var option string
		var count int
		if e = rows.Scan(&option, &count); e != nil {
			return QuestionStats{}, e
		}
		counts[option] = count
	}
	if e = rows.Err(); e != nil {
		return QuestionStats{}, e
	}
	var responseCount int
	if e = tx.QueryRow(c, `SELECT count(*)::int FROM answers WHERE session_id=$1 AND question_slide_id=$2`, session, slide).Scan(&responseCount); e != nil {
		return QuestionStats{}, e
	}
	return QuestionStats{QuestionSlideID: slide, ResponseCount: responseCount, OptionCounts: counts}, nil
}

func leaderboardSummary(c context.Context, tx pgx.Tx, session string) (map[string]any, error) {
	var participantCount int
	if e := tx.QueryRow(c, `SELECT count(*)::int FROM participants WHERE session_id=$1`, session).Scan(&participantCount); e != nil {
		return nil, e
	}
	return map[string]any{"participant_count": participantCount}, nil
}
func actionTarget(from State, action string) (State, error) {
	switch action {
	case "start":
		return Lobby, nil
	case "open_content":
		return Content, nil
	case "open_question":
		return QuestionOpen, nil
	case "close_question":
		return QuestionClosed, nil
	case "show_leaderboard":
		return Leaderboard, nil
	case "end":
		return Ended, nil
	}
	return from, ErrInvalid
}
func mapPG(e error) error {
	var p *pgconn.PgError
	if errors.As(e, &p) {
		if p.ConstraintName == "participants_session_id_display_name_key" {
			return ErrNameTaken
		}
		if p.Code == "23505" || p.Code == "40001" {
			return ErrConflict
		}
		if p.Code == "22P02" || p.Code == "23514" {
			return ErrInvalid
		}
	}
	return fmt.Errorf("live store: %w", e)
}

func isUniqueViolation(e error) bool {
	var p *pgconn.PgError
	return errors.As(e, &p) && p.Code == "23505"
}
