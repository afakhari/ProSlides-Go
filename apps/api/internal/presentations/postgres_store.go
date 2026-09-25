package presentations

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresStore struct{ pool *pgxpool.Pool }

func NewPostgresStore(pool *pgxpool.Pool) *PostgresStore { return &PostgresStore{pool: pool} }

func (s *PostgresStore) ListOwned(c context.Context, owner string) ([]PresentationSummary, error) {
	rows, err := s.pool.Query(c, `SELECT p.id::text,p.revision,p.title,p.access_code,p.settings::text,
		(SELECT count(*) FROM slides sl WHERE sl.presentation_id=p.id),
		(SELECT count(*) FROM participants pa JOIN live_sessions ls ON ls.id=pa.session_id WHERE ls.presentation_id=p.id),
		p.created_at,p.updated_at FROM presentations p WHERE p.owner_id=$1
		ORDER BY p.updated_at DESC,p.id DESC LIMIT 200`, owner)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]PresentationSummary, 0)
	for rows.Next() {
		var item PresentationSummary
		if err = rows.Scan(&item.ID, &item.Revision, &item.Title, &item.AccessCode, &item.Settings, &item.SlideCount, &item.ParticipantCount, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *PostgresStore) Create(c context.Context, owner, title string, settings json.RawMessage) (Presentation, error) {
	if len(settings) == 0 {
		settings = json.RawMessage(`{}`)
	}
	var p Presentation
	err := s.pool.QueryRow(c, `INSERT INTO presentations(owner_id,title,settings) VALUES($1,$2,$3) RETURNING id::text,revision,title,access_code,settings::text,created_at,updated_at`, owner, title, settings).
		Scan(&p.ID, &p.Revision, &p.Title, &p.AccessCode, &p.Settings, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return Presentation{}, err
	}
	p.Slides = []Slide{}
	return p, nil
}

func (s *PostgresStore) Update(c context.Context, id, owner string, patch PresentationPatch) (Presentation, error) {
	var ignored string
	err := s.pool.QueryRow(c, `UPDATE presentations SET title=COALESCE($3,title),settings=CASE WHEN $4::jsonb IS NULL THEN settings ELSE settings || $4::jsonb END,revision=revision+1,updated_at=now() WHERE id=$1 AND owner_id=$2 AND ($5::bigint IS NULL OR revision=$5) RETURNING id::text`, id, owner, patch.Title, nullableJSON(patch.Settings), patch.ExpectedRevision).Scan(&ignored)
	if errors.Is(err, pgx.ErrNoRows) {
		return Presentation{}, s.revisionMiss(c, id, owner)
	}
	if err != nil {
		return Presentation{}, err
	}
	return s.FindOwned(c, id, owner)
}

func nullableJSON(raw json.RawMessage) any {
	if len(raw) == 0 {
		return nil
	}
	return raw
}

func (s *PostgresStore) SetAccessCode(c context.Context, id, owner, code string) (AccessCodeResult, error) {
	tx, err := s.pool.Begin(c)
	if err != nil {
		return AccessCodeResult{}, err
	}
	defer tx.Rollback(c) //nolint:errcheck
	var lockedID string
	if err = tx.QueryRow(c, `SELECT id::text FROM presentations WHERE id=$1 AND owner_id=$2 FOR UPDATE`, id, owner).Scan(&lockedID); errors.Is(err, pgx.ErrNoRows) {
		return AccessCodeResult{}, ErrNotFound
	} else if err != nil {
		return AccessCodeResult{}, err
	}
	if _, err = tx.Exec(c, `SELECT pg_advisory_xact_lock(hashtextextended('access-code:' || $1, 0))`, code); err != nil {
		return AccessCodeResult{}, err
	}
	var usedByOtherActiveSession bool
	if err = tx.QueryRow(c, `SELECT EXISTS(SELECT 1 FROM live_sessions WHERE state<>'ended' AND upper(join_code)=upper($2) AND presentation_id<>$1)`, id, code).Scan(&usedByOtherActiveSession); err != nil {
		return AccessCodeResult{}, err
	}
	if usedByOtherActiveSession {
		return AccessCodeResult{}, ErrAccessCodeTaken
	}
	if _, err = tx.Exec(c, `UPDATE presentations SET access_code=$2,updated_at=now() WHERE id=$1`, id, code); err != nil {
		return AccessCodeResult{}, mapAccessCodeError(err)
	}
	if _, err = tx.Exec(c, `UPDATE live_sessions SET join_code=$2,updated_at=now()
		WHERE id=(SELECT id FROM live_sessions WHERE presentation_id=$1 AND state<>'ended' ORDER BY created_at DESC,id DESC LIMIT 1)`, id, code); err != nil {
		return AccessCodeResult{}, mapAccessCodeError(err)
	}
	if err = tx.Commit(c); err != nil {
		return AccessCodeResult{}, mapAccessCodeError(err)
	}
	return AccessCodeResult{AccessCode: code}, nil
}

func mapAccessCodeError(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return ErrAccessCodeTaken
	}
	return err
}

func (s *PostgresStore) Delete(c context.Context, id, owner string) error {
	tx, err := s.pool.BeginTx(c, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(c) //nolint:errcheck
	var exists bool
	if err = tx.QueryRow(c, `SELECT EXISTS(SELECT 1 FROM presentations WHERE id=$1 AND owner_id=$2)`, id, owner).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		return ErrNotFound
	}
	if _, err = tx.Exec(c, `SELECT pg_advisory_xact_lock(hashtextextended('live-session:' || $1::text || ':' || $2::text, 0))`, owner, id); err != nil {
		return err
	}
	var active bool
	if err = tx.QueryRow(c, `SELECT EXISTS(SELECT 1 FROM live_sessions WHERE presentation_id=$1 AND state<>'ended')`, id).Scan(&active); err != nil {
		return err
	}
	if active {
		return ErrSessionActive
	}
	if _, err = tx.Exec(c, `DELETE FROM live_sessions WHERE presentation_id=$1`, id); err != nil {
		return err
	}
	if _, err = tx.Exec(c, `DELETE FROM presentations WHERE id=$1 AND owner_id=$2`, id, owner); err != nil {
		return err
	}
	return tx.Commit(c)
}

func (s *PostgresStore) Duplicate(c context.Context, id, owner, title string) (Presentation, error) {
	tx, err := s.pool.BeginTx(c, pgx.TxOptions{})
	if err != nil {
		return Presentation{}, err
	}
	defer tx.Rollback(c) //nolint:errcheck
	var newID string
	err = tx.QueryRow(c, `INSERT INTO presentations(owner_id,title,settings) SELECT owner_id,$3,settings FROM presentations WHERE id=$1 AND owner_id=$2 RETURNING id::text`, id, owner, title).Scan(&newID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Presentation{}, ErrNotFound
	}
	if err != nil {
		return Presentation{}, err
	}
	if _, err = tx.Exec(c, `INSERT INTO slides(presentation_id,position,kind,content) SELECT $2,position,kind,content FROM slides WHERE presentation_id=$1 ORDER BY position`, id, newID); err != nil {
		return Presentation{}, err
	}
	if err = tx.Commit(c); err != nil {
		return Presentation{}, err
	}
	return s.FindOwned(c, newID, owner)
}

func (s *PostgresStore) DeleteResults(c context.Context, id, owner string) error {
	tx, err := s.pool.BeginTx(c, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(c) //nolint:errcheck
	var exists bool
	if err = tx.QueryRow(c, `SELECT EXISTS(SELECT 1 FROM presentations WHERE id=$1 AND owner_id=$2)`, id, owner).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		return ErrNotFound
	}
	if _, err = tx.Exec(c, `SELECT pg_advisory_xact_lock(hashtextextended('live-session:' || $1::text || ':' || $2::text, 0))`, owner, id); err != nil {
		return err
	}
	var active bool
	if err = tx.QueryRow(c, `SELECT EXISTS(SELECT 1 FROM live_sessions WHERE presentation_id=$1 AND state<>'ended')`, id).Scan(&active); err != nil {
		return err
	}
	if active {
		return ErrSessionActive
	}
	if _, err = tx.Exec(c, `DELETE FROM live_sessions WHERE presentation_id=$1`, id); err != nil {
		return err
	}
	return tx.Commit(c)
}

func (s *PostgresStore) CreateSlide(c context.Context, presentationID, owner string, position int, kind string, content json.RawMessage, expectedRevision *int64) (Slide, error) {
	tx, err := s.pool.BeginTx(c, pgx.TxOptions{})
	if err != nil {
		return Slide{}, err
	}
	defer tx.Rollback(c) //nolint:errcheck
	var lockedID string
	var presentationRevision int64
	if err = tx.QueryRow(c, `SELECT id::text,revision FROM presentations WHERE id=$1 AND owner_id=$2 FOR UPDATE`, presentationID, owner).Scan(&lockedID, &presentationRevision); errors.Is(err, pgx.ErrNoRows) {
		return Slide{}, ErrNotFound
	} else if err != nil {
		return Slide{}, err
	}
	if expectedRevision != nil && presentationRevision != *expectedRevision {
		return Slide{}, ErrEditConflict
	}
	var count int
	if err = tx.QueryRow(c, `SELECT count(*) FROM slides WHERE presentation_id=$1`, presentationID).Scan(&count); err != nil {
		return Slide{}, err
	}
	if position < 0 || position > count {
		return Slide{}, ErrInvalidPosition
	}
	if _, err = tx.Exec(c, `UPDATE slides SET position=position+1000000 WHERE presentation_id=$1 AND position>=$2`, presentationID, position); err != nil {
		return Slide{}, err
	}
	var slide Slide
	if err = tx.QueryRow(c, `INSERT INTO slides(presentation_id,position,kind,content) VALUES($1,$2,$3,$4) RETURNING id::text,revision,position,kind,content::text`, presentationID, position, kind, content).Scan(&slide.ID, &slide.Revision, &slide.Position, &slide.Kind, &slide.Content); err != nil {
		return Slide{}, err
	}
	if _, err = tx.Exec(c, `UPDATE slides SET position=position-999999,revision=revision+1,updated_at=now() WHERE presentation_id=$1 AND position>=1000000`, presentationID); err != nil {
		return Slide{}, err
	}
	if _, err = tx.Exec(c, `UPDATE presentations SET revision=revision+1,updated_at=now() WHERE id=$1`, presentationID); err != nil {
		return Slide{}, err
	}
	if err = tx.Commit(c); err != nil {
		return Slide{}, err
	}
	return slide, nil
}

func (s *PostgresStore) ReplaceSlide(c context.Context, presentationID, slideID, owner string, position int, kind string, content json.RawMessage, expectedRevision *int64) (Slide, error) {
	tx, err := s.pool.BeginTx(c, pgx.TxOptions{})
	if err != nil {
		return Slide{}, err
	}
	defer tx.Rollback(c) //nolint:errcheck
	var lockedID string
	if err = tx.QueryRow(c, `SELECT id::text FROM presentations WHERE id=$1 AND owner_id=$2 FOR UPDATE`, presentationID, owner).Scan(&lockedID); errors.Is(err, pgx.ErrNoRows) {
		return Slide{}, ErrNotFound
	} else if err != nil {
		return Slide{}, err
	}
	rows, err := tx.Query(c, `SELECT id::text,revision,position FROM slides WHERE presentation_id=$1 ORDER BY position FOR UPDATE`, presentationID)
	if err != nil {
		return Slide{}, err
	}
	ids := []string{}
	originalPositions := make(map[string]int)
	found := false
	var currentRevision int64
	for rows.Next() {
		var id string
		var revision int64
		var originalPosition int
		if err = rows.Scan(&id, &revision, &originalPosition); err != nil {
			rows.Close()
			return Slide{}, err
		}
		originalPositions[id] = originalPosition
		if id != slideID {
			ids = append(ids, id)
		} else {
			found = true
			currentRevision = revision
		}
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return Slide{}, err
	}
	if !found {
		return Slide{}, ErrNotFound
	}
	if expectedRevision != nil && currentRevision != *expectedRevision {
		return Slide{}, ErrEditConflict
	}
	var changesAnsweredQuestion bool
	if err = tx.QueryRow(c, `SELECT EXISTS(SELECT 1 FROM answers WHERE question_slide_id=$1) AND EXISTS(SELECT 1 FROM slides WHERE id=$1 AND (kind<>$2 OR content<>$3::jsonb))`, slideID, kind, content).Scan(&changesAnsweredQuestion); err != nil {
		return Slide{}, err
	}
	if changesAnsweredQuestion {
		return Slide{}, ErrSlideHasResults
	}
	if position < 0 || position > len(ids) {
		return Slide{}, ErrInvalidPosition
	}
	ordered := append(ids, "")
	copy(ordered[position+1:], ordered[position:])
	ordered[position] = slideID
	if _, err = tx.Exec(c, `UPDATE slides SET position=position+1000000 WHERE presentation_id=$1`, presentationID); err != nil {
		return Slide{}, err
	}
	var savedRevision int64
	for index, id := range ordered {
		if id == slideID {
			err = tx.QueryRow(c, `UPDATE slides SET position=$2,kind=$3,content=$4,revision=revision+1,updated_at=now() WHERE id=$1 RETURNING revision`, id, index, kind, content).Scan(&savedRevision)
		} else if originalPositions[id] != index {
			_, err = tx.Exec(c, `UPDATE slides SET position=$2,revision=revision+1,updated_at=now() WHERE id=$1`, id, index)
		} else {
			_, err = tx.Exec(c, `UPDATE slides SET position=$2 WHERE id=$1`, id, index)
		}
		if err != nil {
			return Slide{}, err
		}
	}
	if _, err = tx.Exec(c, `UPDATE presentations SET revision=revision+1,updated_at=now() WHERE id=$1`, presentationID); err != nil {
		return Slide{}, err
	}
	if err = tx.Commit(c); err != nil {
		return Slide{}, err
	}
	return Slide{ID: slideID, Revision: savedRevision, Position: position, Kind: kind, Content: content}, nil
}

func (s *PostgresStore) DeleteSlide(c context.Context, presentationID, slideID, owner string, expectedRevision *int64) error {
	tx, err := s.pool.BeginTx(c, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(c) //nolint:errcheck
	var position int
	var revision int64
	err = tx.QueryRow(c, `SELECT sl.position,sl.revision FROM slides sl JOIN presentations p ON p.id=sl.presentation_id WHERE sl.id=$2 AND sl.presentation_id=$1 AND p.owner_id=$3 FOR UPDATE OF sl`, presentationID, slideID, owner).Scan(&position, &revision)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if expectedRevision != nil && revision != *expectedRevision {
		return ErrEditConflict
	}
	var hasResults bool
	if err = tx.QueryRow(c, `SELECT EXISTS(SELECT 1 FROM answers WHERE question_slide_id=$1)`, slideID).Scan(&hasResults); err != nil {
		return err
	}
	if hasResults {
		return ErrSlideHasResults
	}
	if _, err = tx.Exec(c, `DELETE FROM slides WHERE id=$1`, slideID); err != nil {
		return err
	}
	if _, err = tx.Exec(c, `UPDATE slides SET position=position+1000000 WHERE presentation_id=$1 AND position>$2`, presentationID, position); err != nil {
		return err
	}
	if _, err = tx.Exec(c, `UPDATE slides SET position=position-1000001,revision=revision+1,updated_at=now() WHERE presentation_id=$1 AND position>1000000`, presentationID); err != nil {
		return err
	}
	if _, err = tx.Exec(c, `UPDATE presentations SET revision=revision+1,updated_at=now() WHERE id=$1`, presentationID); err != nil {
		return err
	}
	return tx.Commit(c)
}

func (s *PostgresStore) ReorderSlides(c context.Context, presentationID, owner string, ids []string, expectedRevision *int64) error {
	tx, err := s.pool.BeginTx(c, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(c) //nolint:errcheck
	var presentationRevision int64
	if err = tx.QueryRow(c, `SELECT revision FROM presentations WHERE id=$1 AND owner_id=$2 FOR UPDATE`, presentationID, owner).Scan(&presentationRevision); errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	} else if err != nil {
		return err
	}
	if expectedRevision != nil && presentationRevision != *expectedRevision {
		return ErrEditConflict
	}
	var count int
	if err = tx.QueryRow(c, `SELECT count(*) FROM slides WHERE presentation_id=$1`, presentationID).Scan(&count); err != nil {
		return err
	}
	if count != len(ids) {
		return ErrNotFound
	}
	if _, err = tx.Exec(c, `UPDATE slides SET position=position+1000000 WHERE presentation_id=$1`, presentationID); err != nil {
		return err
	}
	for position, id := range ids {
		tag, updateErr := tx.Exec(c, `UPDATE slides SET position=$4,revision=slides.revision+1,updated_at=now() FROM presentations p WHERE slides.id=$2 AND slides.presentation_id=$1 AND p.id=slides.presentation_id AND p.owner_id=$3`, presentationID, id, owner, position)
		if updateErr != nil {
			return updateErr
		}
		if tag.RowsAffected() != 1 {
			return ErrNotFound
		}
	}
	if _, err = tx.Exec(c, `UPDATE presentations SET revision=revision+1,updated_at=now() WHERE id=$1`, presentationID); err != nil {
		return err
	}
	return tx.Commit(c)
}

func (s *PostgresStore) FindOwned(c context.Context, id, owner string) (Presentation, error) {
	var p Presentation
	if err := s.pool.QueryRow(c, `SELECT id::text,revision,title,access_code,settings::text,created_at,updated_at FROM presentations WHERE id=$1 AND owner_id=$2`, id, owner).Scan(&p.ID, &p.Revision, &p.Title, &p.AccessCode, &p.Settings, &p.CreatedAt, &p.UpdatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Presentation{}, ErrNotFound
		}
		return Presentation{}, fmt.Errorf("find presentation: %w", err)
	}
	rows, err := s.pool.Query(c, `SELECT id::text,revision,position,kind,content::text FROM slides WHERE presentation_id=$1 ORDER BY position`, id)
	if err != nil {
		return Presentation{}, err
	}
	defer rows.Close()
	p.Slides = make([]Slide, 0)
	for rows.Next() {
		var slide Slide
		if err = rows.Scan(&slide.ID, &slide.Revision, &slide.Position, &slide.Kind, &slide.Content); err != nil {
			return Presentation{}, err
		}
		p.Slides = append(p.Slides, slide)
	}
	return p, rows.Err()
}

func (s *PostgresStore) revisionMiss(c context.Context, id, owner string) error {
	var exists bool
	if err := s.pool.QueryRow(c, `SELECT EXISTS(SELECT 1 FROM presentations WHERE id=$1 AND owner_id=$2)`, id, owner).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		return ErrNotFound
	}
	return ErrEditConflict
}
