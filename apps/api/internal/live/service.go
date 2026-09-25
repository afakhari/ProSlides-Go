package live

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"
	"sync/atomic"
	"time"
)

type Service struct {
	store              Store
	scoring            ScoringPolicy
	answerAccepted     atomic.Uint64
	answerDuplicate    atomic.Uint64
	answerConflict     atomic.Uint64
	answerInvalid      atomic.Uint64
	answerUnauthorized atomic.Uint64
	answerInternal     atomic.Uint64
	answerNanos        atomic.Uint64
	joinNew            atomic.Uint64
	joinRestored       atomic.Uint64
}

func NewService(store Store, scoring ScoringPolicy) *Service {
	return &Service{store: store, scoring: scoring}
}

func (s *Service) CreateSession(c context.Context, host, presentation, request string) (Session, bool, error) {
	if !validUUID(host) || !validUUID(presentation) || !validUUID(request) {
		return Session{}, false, ErrInvalid
	}
	code, e := joinCode()
	if e != nil {
		return Session{}, false, e
	}
	return s.store.CreateSession(c, host, presentation, request, code)
}
func (s *Service) ResolveSession(c context.Context, code string) (SessionLocator, error) {
	code = strings.ToUpper(strings.TrimSpace(code))
	if len(code) < 5 || len(code) > 12 {
		return SessionLocator{}, ErrInvalid
	}
	return s.store.ResolveSession(c, code)
}
func (s *Service) Join(c context.Context, session, request, name, avatar string) (Participant, bool, error) {
	name = strings.TrimSpace(name)
	if !validUUID(session) || !validUUID(request) || name == "" || len([]rune(name)) > 100 || len([]rune(avatar)) > 100 {
		return Participant{}, false, ErrInvalid
	}
	participant, restored, err := s.store.Join(c, session, request, name, avatar, tokenHash(request))
	if restored {
		s.joinRestored.Add(1)
	} else if err == nil {
		s.joinNew.Add(1)
	}
	return participant, restored, err
}
func (s *Service) Action(c context.Context, session, host, request string, version int64, action, item string) (Session, bool, error) {
	if !validUUID(session) || !validUUID(host) || !validUUID(request) || version < 1 || (item != "" && !validUUID(item)) {
		return Session{}, false, ErrInvalid
	}
	return s.store.ApplyAction(c, session, host, request, version, action, item)
}
func (s *Service) Submit(c context.Context, session, participantToken, request, item string, selected []int) (AnswerResult, error) {
	if !validUUID(session) || !validUUID(participantToken) || !validUUID(request) || !validUUID(item) || len(selected) == 0 || len(selected) > 100 {
		return AnswerResult{}, ErrInvalid
	}
	for _, v := range selected {
		if v < 0 {
			return AnswerResult{}, ErrInvalid
		}
	}
	started := time.Now()
	result, err := s.store.SubmitAnswer(c, session, tokenHash(participantToken), request, item, selected, s.scoring)
	s.answerNanos.Add(uint64(time.Since(started)))
	switch {
	case err == nil && result.Duplicate:
		s.answerDuplicate.Add(1)
	case err == nil:
		s.answerAccepted.Add(1)
	case errors.Is(err, ErrConflict), errors.Is(err, ErrInvalidTransition):
		s.answerConflict.Add(1)
	case errors.Is(err, ErrInvalid):
		s.answerInvalid.Add(1)
	case errors.Is(err, ErrUnauthorized):
		s.answerUnauthorized.Add(1)
	default:
		s.answerInternal.Add(1)
	}
	return result, err
}
func (s *Service) ParticipantSnapshot(c context.Context, session, participantToken string) (ParticipantSnapshot, error) {
	if !validUUID(session) || !validUUID(participantToken) {
		return ParticipantSnapshot{}, ErrUnauthorized
	}
	return s.store.ParticipantSnapshot(c, session, tokenHash(participantToken))
}
func (s *Service) ManagerSnapshot(c context.Context, session, manager string) (ManagerSnapshot, error) {
	if !validUUID(session) || !validUUID(manager) {
		return ManagerSnapshot{}, ErrUnauthorized
	}
	return s.store.ManagerSnapshot(c, session, manager)
}
func (s *Service) StageSnapshot(c context.Context, session, manager string) (StageSnapshot, error) {
	if !validUUID(session) || !validUUID(manager) {
		return StageSnapshot{}, ErrUnauthorized
	}
	return s.store.StageSnapshot(c, session, manager)
}
func (s *Service) Roster(c context.Context, session, manager, order string, limit int, encodedCursor string) (RosterPage, error) {
	if !validUUID(session) || !validUUID(manager) || limit < 1 || limit > 100 || (order != "joined" && order != "score") {
		return RosterPage{}, ErrInvalid
	}
	query := RosterQuery{Order: order, Limit: limit}
	if encodedCursor != "" {
		decoded, err := base64.RawURLEncoding.DecodeString(encodedCursor)
		if err != nil || json.Unmarshal(decoded, &query.Cursor) != nil || query.Cursor == nil || query.Cursor.Order != order || query.Cursor.ID == "" || query.Cursor.JoinedAt.IsZero() {
			return RosterPage{}, ErrInvalid
		}
	}
	page, err := s.store.Roster(c, session, manager, query)
	if err != nil || !page.HasMore || len(page.Items) == 0 {
		return page, err
	}
	last := page.Items[len(page.Items)-1]
	cursor, err := json.Marshal(RosterCursor{Order: order, JoinedAt: last.JoinedAt, ID: last.ParticipantID, Score: last.Score})
	if err != nil {
		return RosterPage{}, err
	}
	next := base64.RawURLEncoding.EncodeToString(cursor)
	page.NextCursor = &next
	return page, nil
}
func (s *Service) Events(c context.Context, session string, after int64) ([]Event, error) {
	return s.store.Events(c, session, after, 200)
}
func (s *Service) AuthorizeViewer(c context.Context, session, manager, participantToken string) error {
	if !validUUID(session) || (manager != "" && !validUUID(manager)) || (participantToken != "" && !validUUID(participantToken)) {
		return ErrUnauthorized
	}
	var hash []byte
	if participantToken != "" {
		hash = tokenHash(participantToken)
	}
	return s.store.AuthorizeViewer(c, session, manager, hash)
}
func (s *Service) SetParticipantPresence(c context.Context, session, participantToken string, disconnected bool) error {
	if !validUUID(session) || (participantToken != "" && !validUUID(participantToken)) {
		return ErrUnauthorized
	}
	var hash []byte
	if participantToken != "" {
		hash = tokenHash(participantToken)
	}
	return s.store.SetParticipantPresence(c, session, hash, disconnected)
}
func tokenHash(v string) []byte { x := sha256.Sum256([]byte(v)); return x[:] }
func joinCode() (string, error) {
	b := make([]byte, 4)
	if _, e := rand.Read(b); e != nil {
		return "", e
	}
	return strings.ToUpper(hex.EncodeToString(b)), nil
}

func (s *Service) WritePrometheus(w io.Writer) {
	accepted := s.answerAccepted.Load()
	duplicate := s.answerDuplicate.Load()
	conflict := s.answerConflict.Load()
	invalid := s.answerInvalid.Load()
	unauthorized := s.answerUnauthorized.Load()
	internal := s.answerInternal.Load()
	fmt.Fprintln(w, "# TYPE proslides_live_answers_total counter")
	for outcome, value := range map[string]uint64{"accepted": accepted, "duplicate": duplicate, "conflict": conflict, "invalid": invalid, "unauthorized": unauthorized, "internal": internal} {
		fmt.Fprintf(w, "proslides_live_answers_total{outcome=%q} %d\n", outcome, value)
	}
	total := accepted + duplicate + conflict + invalid + unauthorized + internal
	fmt.Fprintln(w, "# TYPE proslides_live_answer_duration_seconds_sum counter")
	fmt.Fprintf(w, "proslides_live_answer_duration_seconds_sum %.9f\n", float64(s.answerNanos.Load())/float64(time.Second))
	fmt.Fprintln(w, "# TYPE proslides_live_answer_duration_seconds_count counter")
	fmt.Fprintf(w, "proslides_live_answer_duration_seconds_count %d\n", total)
	joined := s.joinNew.Load()
	restored := s.joinRestored.Load()
	fmt.Fprintln(w, "# TYPE proslides_live_joins_total counter")
	for outcome, value := range map[string]uint64{"joined": joined, "restored": restored} {
		fmt.Fprintf(w, "proslides_live_joins_total{outcome=%q} %d\n", outcome, value)
	}
}

func validUUID(value string) bool {
	if len(value) != 36 || value[8] != '-' || value[13] != '-' || value[18] != '-' || value[23] != '-' {
		return false
	}
	compact := strings.ReplaceAll(value, "-", "")
	decoded, err := hex.DecodeString(compact)
	return err == nil && len(decoded) == 16
}
