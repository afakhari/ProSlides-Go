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
	"github.com/proslides/proslides/internal/presentations"
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
	if e = scanSession(tx.QueryRow(c, `SELECT id::text,presentation_id::text,host_id::text,join_code,state,state_version,active_item_id::text,activity_phase,stage_view,ends_at FROM live_sessions WHERE host_id=$1 AND presentation_id=$2 AND state<>'ended'`, host, presentation), &out); e == nil {
		return out, true, nil
	} else if !errors.Is(e, pgx.ErrNoRows) {
		return out, false, e
	}
	if e = scanSession(tx.QueryRow(c, `SELECT id::text,presentation_id::text,host_id::text,join_code,state,state_version,active_item_id::text,activity_phase,stage_view,ends_at FROM live_sessions WHERE host_id=$1 AND request_id=$2`, host, request), &out); e == nil {
		return out, true, nil
	} else if !errors.Is(e, pgx.ErrNoRows) {
		return out, false, e
	}
	e = scanSession(tx.QueryRow(c, `INSERT INTO live_sessions(presentation_id,host_id,join_code,state,request_id) SELECT id,$1,COALESCE(access_code,$3),'draft',$4 FROM presentations WHERE id=$2 AND owner_id=$1 RETURNING id::text,presentation_id::text,host_id::text,join_code,state,state_version,active_item_id::text,activity_phase,stage_view,ends_at`, host, presentation, code, request), &out)
	if errors.Is(e, pgx.ErrNoRows) {
		return out, false, ErrNotFound
	}
	if e != nil {
		return out, false, mapPG(e)
	}
	type authoredSlide struct {
		id       string
		revision int64
		position int
		kind     string
		content  json.RawMessage
	}
	rows, queryErr := tx.Query(c, `SELECT id::text,revision,position,kind,content
		FROM slides WHERE presentation_id=$1 ORDER BY position`, out.PresentationID)
	if queryErr != nil {
		return out, false, queryErr
	}
	authored := make([]authoredSlide, 0)
	for rows.Next() {
		var slide authoredSlide
		if scanErr := rows.Scan(&slide.id, &slide.revision, &slide.position, &slide.kind, &slide.content); scanErr != nil {
			rows.Close()
			return out, false, scanErr
		}
		authored = append(authored, slide)
	}
	if rowsErr := rows.Err(); rowsErr != nil {
		rows.Close()
		return out, false, rowsErr
	}
	rows.Close()

	if len(authored) > 0 {
		batch := &pgx.Batch{}
		for _, slide := range authored {
			batch.Queue(`INSERT INTO live_session_slides(session_id,slide_id,revision,position,kind,content)
				VALUES($1,$2,$3,$4,$5,$6)`, out.ID, slide.id, slide.revision, slide.position, slide.kind, slide.content)
		}
		results := tx.SendBatch(c, batch)
		for range authored {
			if _, e = results.Exec(); e != nil {
				_ = results.Close()
				return out, false, e
			}
		}
		if e = results.Close(); e != nil {
			return out, false, e
		}
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
		COALESCE(p.settings->>'music_url',''),
		CASE WHEN p.settings->>'text_color' ~ '^#[0-9A-Fa-f]{6}$' THEN p.settings->>'text_color' ELSE '#ffffff' END
		FROM live_sessions ls JOIN presentations p ON p.id=ls.presentation_id
		WHERE ls.join_code=$1 AND ls.state<>'ended' LIMIT 1`, code).Scan(
		&out.SessionID, &out.PresentationID, &out.Presentation.Title,
		&out.Presentation.BackgroundColor, &out.Presentation.BackgroundImageURL,
		&out.Presentation.MusicURL, &out.Presentation.TextColor)
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
	// Rejoin restore: within the same session, a participant whose last SSE
	// stream closed (disconnected_at is set) can reclaim their existing record
	// and score by rejoining with the same display name, even with a new
	// credential. The credential is rotated so the rejoined device remains
	// authorized, and participant_count is unchanged because no new row commits.
	// A display name still held by an actively connected participant is never
	// taken over; that join falls through to the INSERT and conflicts on name.
	e = tx.QueryRow(c, `UPDATE participants
		SET request_id=$3, token_hash=$4, avatar=$5, disconnected_at=NULL
		WHERE session_id=$1 AND display_name=$2 AND disconnected_at IS NOT NULL
		RETURNING id::text, display_name, COALESCE(avatar,'')`, session, name, request, hash, avatar).Scan(&p.ID, &p.DisplayName, &p.Avatar)
	if e == nil {
		if err := tx.Commit(c); err != nil {
			return p, false, err
		}
		return p, true, nil
	} else if !errors.Is(e, pgx.ErrNoRows) {
		return p, false, mapPG(e)
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
func (s *PostgresStore) SetParticipantPresence(c context.Context, session string, hash []byte, disconnected bool) error {
	_, e := s.pool.Exec(c, `UPDATE participants SET disconnected_at=CASE WHEN $3 THEN clock_timestamp() ELSE NULL END WHERE session_id=$1 AND token_hash=$2`, session, hash, disconnected)
	return e
}
func (s *PostgresStore) ApplyAction(c context.Context, session, host, request string, expected int64, action, item string) (Session, bool, error) {
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

	e = scanSession(tx.QueryRow(c, `SELECT id::text,presentation_id::text,host_id::text,join_code,state,state_version,active_item_id::text,activity_phase,stage_view,ends_at FROM live_sessions WHERE id=$1 AND host_id=$2 FOR UPDATE`, session, host), &out)
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

	to := out.State
	active := any(out.ActiveItemID)
	phase := any(out.ActivityPhase)
	stageView := any(out.StageView)
	var ends any = out.EndsAt

	switch action {
	case "start":
		if out.State != Draft || !CanTransition(out.State, Lobby) {
			return out, false, ErrInvalidTransition
		}
		to = Lobby
		active = nil
		phase = nil
		stageView = StageItem
		ends = nil

	case "present_item":
		if item == "" || (out.State != Lobby && out.State != Presenting) ||
			(out.ActivityPhase != nil && *out.ActivityPhase == ActivityAccepting) {
			return out, false, ErrInvalidTransition
		}
		var kind string
		var content json.RawMessage
		e = tx.QueryRow(c, `SELECT kind,content FROM live_session_slides WHERE session_id=$1 AND slide_id=$2`, session, item).Scan(&kind, &content)
		if errors.Is(e, pgx.ErrNoRows) {
			return out, false, ErrNotFound
		}
		if e != nil {
			return out, false, e
		}

		to = Presenting
		active = item
		stageView = StageItem
		ends = nil

		switch kind {
		case "content":
			phase = nil
		case presentations.ItemKindActivity:
			definition, decodeErr := presentations.DecodeActivityDefinition(content)
			if decodeErr != nil {
				return out, false, ErrInvalid
			}
			phase = ActivityAccepting
			var deadline time.Time
			if e = tx.QueryRow(c, `SELECT clock_timestamp()+make_interval(secs=>$1)`, definition.Timing.DurationSeconds).Scan(&deadline); e != nil {
				return out, false, e
			}
			ends = deadline
		default:
			return out, false, ErrInvalid
		}

	case "close_activity":
		if out.State != Presenting || out.ActiveItemID == nil || out.ActivityPhase == nil || *out.ActivityPhase != ActivityAccepting {
			return out, false, ErrInvalidTransition
		}
		phase = ActivityClosed
		stageView = StageItem
		ends = nil

	case "reveal_activity":
		if out.State != Presenting || out.ActiveItemID == nil || out.ActivityPhase == nil || *out.ActivityPhase != ActivityClosed {
			return out, false, ErrInvalidTransition
		}
		phase = ActivityRevealed
		stageView = StageItem
		ends = nil

	case "show_overall_ranking":
		if out.State != Presenting || out.ActiveItemID == nil || out.ActivityPhase == nil || *out.ActivityPhase != ActivityRevealed {
			return out, false, ErrInvalidTransition
		}
		stageView = StageOverallRanking
		ends = nil

	case "end":
		if (out.State != Lobby && out.State != Presenting) ||
			(out.ActivityPhase != nil && *out.ActivityPhase == ActivityAccepting) ||
			!CanTransition(out.State, Ended) {
			return out, false, ErrInvalidTransition
		}
		to = Ended
		active = nil
		phase = nil
		stageView = StageItem
		ends = nil

	default:
		return out, false, ErrInvalid
	}

	if to == Presenting && !CanTransition(out.State, Presenting) && out.State != Presenting {
		return out, false, ErrInvalidTransition
	}

	e = scanSession(tx.QueryRow(c, `UPDATE live_sessions
		SET state=$2,
			state_version=state_version+1,
			active_item_id=$3,
			activity_phase=$4,
			stage_view=$5,
			ends_at=$6,
			ended_at=CASE WHEN $2='ended' THEN now() ELSE ended_at END,
			updated_at=clock_timestamp()
		WHERE id=$1
		RETURNING id::text,presentation_id::text,host_id::text,join_code,state,state_version,active_item_id::text,activity_phase,stage_view,ends_at`,
		session, to, active, phase, stageView, ends), &out)
	if e != nil {
		return out, false, mapPG(e)
	}

	resultJSON, marshalErr := json.Marshal(out)
	if marshalErr != nil {
		return out, false, marshalErr
	}
	_, e = tx.Exec(c, `INSERT INTO live_commands(session_id,request_id,action,result_state,result_state_version,result) VALUES($1,$2,$3,$4,$5,$6)`,
		session, request, action, out.State, out.StateVersion, resultJSON)
	if e != nil {
		return out, false, mapPG(e)
	}

	if e = insertEvent(c, tx, session, out.StateVersion, "session.state_changed", sessionEventPayload(out, "")); e != nil {
		return out, false, e
	}

	if action == "close_activity" && out.ActiveItemID != nil {
		result, resultErr := activityResult(c, tx, session, *out.ActiveItemID)
		if resultErr != nil {
			return out, false, resultErr
		}
		if e = insertEvent(c, tx, session, out.StateVersion, "activity.result_updated", result); e != nil {
			return out, false, e
		}
	}

	if action == "show_overall_ranking" {
		ranking, rankingErr := rankingSummary(c, tx, session)
		if rankingErr != nil {
			return out, false, rankingErr
		}
		if e = insertEvent(c, tx, session, out.StateVersion, "ranking.updated", ranking); e != nil {
			return out, false, e
		}
	}

	if e = tx.Commit(c); e != nil {
		return out, false, e
	}
	return out, false, nil
}

// ReconcileDeadline makes Activity expiry a durable phase transition. The UPDATE
// takes an exclusive row lock, so it waits for responses already admitted under
// the shared session lock and prevents responses admitted after the PostgreSQL
// clock deadline from slipping through.
func (s *PostgresStore) ReconcileDeadline(c context.Context, session string) (bool, error) {
	var expired bool
	if e := s.pool.QueryRow(c, `SELECT state='presenting' AND activity_phase='accepting' AND ends_at<=clock_timestamp() FROM live_sessions WHERE id=$1`, session).Scan(&expired); errors.Is(e, pgx.ErrNoRows) {
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
		SET activity_phase='closed',state_version=state_version+1,stage_view='item',ends_at=NULL,updated_at=clock_timestamp()
		WHERE id=$1 AND state='presenting' AND activity_phase='accepting' AND ends_at<=clock_timestamp()
		RETURNING id::text,presentation_id::text,host_id::text,join_code,state,state_version,active_item_id::text,activity_phase,stage_view,ends_at`, session), &out)
	if errors.Is(e, pgx.ErrNoRows) {
		return false, nil
	}
	if e != nil {
		return false, mapPG(e)
	}

	if e = insertEvent(c, tx, session, out.StateVersion, "session.state_changed", sessionEventPayload(out, "deadline_elapsed")); e != nil {
		return false, e
	}
	if out.ActiveItemID != nil {
		result, resultErr := activityResult(c, tx, session, *out.ActiveItemID)
		if resultErr != nil {
			return false, resultErr
		}
		if e = insertEvent(c, tx, session, out.StateVersion, "activity.result_updated", result); e != nil {
			return false, e
		}
	}
	return true, nil
}

func (s *PostgresStore) SubmitAnswer(c context.Context, session string, hash []byte, request, item string, selected []int, policy ScoringPolicy) (AnswerResult, error) {
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

	var active, state, phase, kind string
	var remainingSeconds float64
	var content json.RawMessage
	e = tx.QueryRow(c, `SELECT l.active_item_id::text,l.state,COALESCE(l.activity_phase,''),sl.kind,sl.content,
		COALESCE(GREATEST(0,EXTRACT(EPOCH FROM l.ends_at-clock_timestamp())),0)::float8
		FROM live_sessions l
		JOIN live_session_slides sl ON sl.session_id=l.id AND sl.slide_id=l.active_item_id
		WHERE l.id=$1 FOR SHARE OF l`, session).Scan(&active, &state, &phase, &kind, &content, &remainingSeconds)
	if errors.Is(e, pgx.ErrNoRows) {
		return result, ErrConflict
	}
	if e != nil {
		return result, e
	}
	if state != string(Presenting) || phase != string(ActivityAccepting) || active != item || kind != presentations.ItemKindActivity || remainingSeconds <= 0 {
		return result, ErrConflict
	}

	definition, decodeErr := presentations.DecodeActivityDefinition(content)
	if decodeErr != nil || definition.ActivityKind != presentations.ActivityKindChoice {
		return result, ErrInvalid
	}

	seen := map[int]bool{}
	for _, index := range selected {
		if index < 0 || index >= len(definition.Response.Options) || seen[index] {
			return result, ErrInvalid
		}
		seen[index] = true
	}
	if definition.Response.Selection == presentations.ChoiceSelectionSingle && len(selected) != 1 {
		return result, ErrInvalid
	}

	score := 0
	if definition.Scoring.Mode == presentations.ScoringModePoints {
		correctIDs := make(map[string]struct{}, len(definition.Evaluation.CorrectOptionIDs))
		for _, id := range definition.Evaluation.CorrectOptionIDs {
			correctIDs[id] = struct{}{}
		}
		correct := make([]int, 0, len(correctIDs))
		for index, option := range definition.Response.Options {
			if _, ok := correctIDs[option.ID]; ok {
				correct = append(correct, index)
			}
		}
		score = policy.Score(Question{
			Type: definition.Response.Selection,
			Correct: correct,
			MaxPoints: definition.Scoring.MaxPoints,
			MinPoints: definition.Scoring.MinPoints,
			PartialScoring: definition.Scoring.PartialCredit,
			FasterAnswers: definition.Scoring.SpeedBonus,
			Duration: time.Duration(definition.Timing.DurationSeconds) * time.Second,
			Remaining: time.Duration(remainingSeconds * float64(time.Second)),
		}, selected)
	}

	answer, marshalErr := json.Marshal(map[string]any{"selected_option_indexes": selected})
	if marshalErr != nil {
		return result, marshalErr
	}
	e = tx.QueryRow(c, `WITH inserted AS (
			INSERT INTO answers(session_id,participant_id,question_slide_id,request_id,answer,score_delta)
			VALUES($1,$2,$3,$4,$5,$6)
			RETURNING id,score_delta
		), updated AS (
			UPDATE participants p SET score=p.score+inserted.score_delta
			FROM inserted WHERE p.id=$2 RETURNING p.id
		)
		SELECT inserted.id::text,inserted.score_delta FROM inserted JOIN updated ON true`,
		session, participant, item, request, answer, score).Scan(&result.AnswerID, &result.ScoreDelta)
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
	e = tx.QueryRow(c, `SELECT l.id::text,l.presentation_id::text,l.host_id::text,l.join_code,l.state,l.state_version,l.active_item_id::text,l.activity_phase,l.stage_view,l.ends_at,
		CASE WHEN l.activity_phase='accepting' AND l.ends_at IS NOT NULL THEN GREATEST(0,ROUND(EXTRACT(EPOCH FROM l.ends_at-clock_timestamp())))::int ELSE NULL END,
		p.id::text,p.display_name,COALESCE(p.avatar,''),p.score,
		CASE WHEN l.stage_view='overall_ranking' OR l.state='ended'
			THEN 1+(SELECT count(*)::int FROM participants ranked WHERE ranked.session_id=p.session_id AND ranked.score>p.score)
		END,
		(SELECT count(*)::int FROM participants counted WHERE counted.session_id=l.id),
		COALESCE((SELECT max(event_id) FROM live_events WHERE session_id=l.id),0),
		(SELECT jsonb_build_object('id',slide_id,'position',position,'kind',kind,'content',content)
		 FROM live_session_slides WHERE session_id=l.id AND slide_id=l.active_item_id)
		FROM live_sessions l JOIN participants p ON p.session_id=l.id
		WHERE l.id=$1 AND p.token_hash=$2`, session, hash).Scan(
		&full.ID, &full.PresentationID, &full.HostID, &full.JoinCode, &full.State, &full.StateVersion, &full.ActiveItemID, &full.ActivityPhase, &full.StageView, &full.EndsAt, &full.RemainingSeconds,
		&x.Participant.ID, &x.Participant.DisplayName, &x.Participant.Avatar, &x.Participant.Score, &x.Participant.Rank,
		&x.ParticipantCount, &x.LastEventID, &x.ActiveItem,
	)
	if errors.Is(e, pgx.ErrNoRows) {
		return x, ErrUnauthorized
	}
	if e != nil {
		return x, e
	}

	x.Role = "participant"
	x.Session = publicSession(full)
	if full.ActiveItemID != nil && full.ActivityPhase != nil && *full.ActivityPhase == ActivityRevealed {
		result, resultErr := activityResult(c, tx, session, *full.ActiveItemID)
		if resultErr != nil {
			return x, resultErr
		}
		x.ActivityResult = &result
	}
	if full.ActivityPhase == nil || *full.ActivityPhase != ActivityRevealed {
		if x.ActiveItem, e = sanitizeParticipantActiveItem(x.ActiveItem); e != nil {
			return x, e
		}
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

	e = tx.QueryRow(c, `SELECT id::text,presentation_id::text,host_id::text,join_code,state,state_version,active_item_id::text,activity_phase,stage_view,ends_at,
		CASE WHEN activity_phase='accepting' AND ends_at IS NOT NULL THEN GREATEST(0,ROUND(EXTRACT(EPOCH FROM ends_at-clock_timestamp())))::int ELSE NULL END,
		(SELECT count(*)::int FROM participants WHERE session_id=live_sessions.id),
		COALESCE((SELECT max(event_id) FROM live_events WHERE session_id=live_sessions.id),0),
		(SELECT jsonb_build_object('id',slide_id,'position',position,'kind',kind,'content',content)
		 FROM live_session_slides WHERE session_id=live_sessions.id AND slide_id=live_sessions.active_item_id)
		FROM live_sessions WHERE id=$1 AND host_id=$2`, session, manager).Scan(
		&x.Session.ID, &x.Session.PresentationID, &x.Session.HostID, &x.Session.JoinCode, &x.Session.State, &x.Session.StateVersion, &x.Session.ActiveItemID, &x.Session.ActivityPhase, &x.Session.StageView, &x.Session.EndsAt, &x.Session.RemainingSeconds,
		&x.ParticipantCount, &x.LastEventID, &x.ActiveItem,
	)
	if errors.Is(e, pgx.ErrNoRows) {
		return x, ErrNotFound
	}
	if e != nil {
		return x, e
	}

	x.Role = "manager"
	if x.Session.ActiveItemID != nil && x.Session.ActivityPhase != nil &&
		(*x.Session.ActivityPhase == ActivityClosed || *x.Session.ActivityPhase == ActivityRevealed) {
		result, resultErr := activityResult(c, tx, session, *x.Session.ActiveItemID)
		if resultErr != nil {
			return x, resultErr
		}
		x.ActivityResult = &result
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
			rows, e = s.pool.Query(c, `WITH ranked AS (
				SELECT id,display_name,avatar,score,joined_at,
					RANK() OVER (ORDER BY score DESC)::int AS rank
				FROM participants WHERE session_id=$1
			)
			SELECT id::text,display_name,COALESCE(avatar,''),score,rank,joined_at
			FROM ranked ORDER BY score DESC,joined_at,id LIMIT $2`, session, query.Limit+1)
		} else {
			rows, e = s.pool.Query(c, `WITH ranked AS (
				SELECT id,display_name,avatar,score,joined_at,
					RANK() OVER (ORDER BY score DESC)::int AS rank
				FROM participants WHERE session_id=$1
			)
			SELECT id::text,display_name,COALESCE(avatar,''),score,rank,joined_at
			FROM ranked
			WHERE score<$2 OR (score=$2 AND (joined_at,id)>($3,$4::uuid))
			ORDER BY score DESC,joined_at,id LIMIT $5`,
				session, query.Cursor.Score, query.Cursor.JoinedAt, query.Cursor.ID, query.Limit+1)
		}
	} else if query.Cursor == nil {
		rows, e = s.pool.Query(c, `SELECT id::text,display_name,COALESCE(avatar,''),score,NULL::int,joined_at FROM participants WHERE session_id=$1 ORDER BY joined_at,id LIMIT $2`, session, query.Limit+1)
	} else {
		rows, e = s.pool.Query(c, `SELECT id::text,display_name,COALESCE(avatar,''),score,NULL::int,joined_at FROM participants WHERE session_id=$1 AND (joined_at,id)>($2,$3::uuid) ORDER BY joined_at,id LIMIT $4`, session, query.Cursor.JoinedAt, query.Cursor.ID, query.Limit+1)
	}
	if e != nil {
		return page, mapPG(e)
	}
	defer rows.Close()

	for rows.Next() {
		var item RosterEntry
		if e = rows.Scan(&item.ParticipantID, &item.DisplayName, &item.Avatar, &item.Score, &item.Rank, &item.JoinedAt); e != nil {
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

func sanitizeParticipantActiveItem(raw json.RawMessage) (json.RawMessage, error) {
	if len(raw) == 0 {
		return raw, nil
	}
	var item any
	if err := json.Unmarshal(raw, &item); err != nil {
		return nil, err
	}
	stripCorrectnessMetadata(item)
	return json.Marshal(item)
}

func stripCorrectnessMetadata(value any) {
	switch typed := value.(type) {
	case map[string]any:
		delete(typed, "is_correct")
		delete(typed, "correct_answer")
		delete(typed, "correct_option_indexes")
		delete(typed, "correct_option_ids")
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
	return PublicSession{
		ID: session.ID,
		PresentationID: session.PresentationID,
		State: session.State,
		StateVersion: session.StateVersion,
		ActiveItemID: session.ActiveItemID,
		ActivityPhase: session.ActivityPhase,
		StageView: session.StageView,
		EndsAt: session.EndsAt,
		RemainingSeconds: session.RemainingSeconds,
	}
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
	return row.Scan(&x.ID, &x.PresentationID, &x.HostID, &x.JoinCode, &x.State, &x.StateVersion, &x.ActiveItemID, &x.ActivityPhase, &x.StageView, &x.EndsAt)
}

func insertEvent(c context.Context, tx pgx.Tx, session string, version int64, name string, payload any) error {
	b, _ := json.Marshal(payload)
	schemaVersion := 1
	if name == "ranking.updated" {
		schemaVersion = 2
	}
	_, e := tx.Exec(c, `INSERT INTO live_events(schema_version,session_id,state_version,name,payload)VALUES($1,$2,$3,$4,$5)`, schemaVersion, session, version, name, b)
	return e
}

func sanitizeReplayedEvent(event *Event) error {
	if event.Name != "ranking.updated" {
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

func activityResult(c context.Context, tx pgx.Tx, session, item string) (ActivityResult, error) {
	counts := map[string]int{}
	rows, e := tx.Query(c, `SELECT selected.value, count(*)::int
		FROM answers a
		CROSS JOIN LATERAL jsonb_array_elements_text(a.answer->'selected_option_indexes') selected(value)
		WHERE a.session_id=$1 AND a.question_slide_id=$2
		GROUP BY selected.value`, session, item)
	if e != nil {
		return ActivityResult{}, e
	}
	defer rows.Close()
	for rows.Next() {
		var option string
		var count int
		if e = rows.Scan(&option, &count); e != nil {
			return ActivityResult{}, e
		}
		counts[option] = count
	}
	if e = rows.Err(); e != nil {
		return ActivityResult{}, e
	}

	var responseCount int
	if e = tx.QueryRow(c, `SELECT count(*)::int FROM answers WHERE session_id=$1 AND question_slide_id=$2`, session, item).Scan(&responseCount); e != nil {
		return ActivityResult{}, e
	}
	return ActivityResult{ActivityItemID: item, ResponseCount: responseCount, OptionCounts: counts}, nil
}

func rankingSummary(c context.Context, tx pgx.Tx, session string) (map[string]any, error) {
	var participantCount int
	if e := tx.QueryRow(c, `SELECT count(*)::int FROM participants WHERE session_id=$1`, session).Scan(&participantCount); e != nil {
		return nil, e
	}
	return map[string]any{"participant_count": participantCount}, nil
}

func sessionEventPayload(session Session, reason string) map[string]any {
	payload := map[string]any{
		"state": session.State,
		"active_item_id": session.ActiveItemID,
		"activity_phase": session.ActivityPhase,
		"stage_view": session.StageView,
		"ends_at": session.EndsAt,
	}
	if reason != "" {
		payload["reason"] = reason
	}
	return payload
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
