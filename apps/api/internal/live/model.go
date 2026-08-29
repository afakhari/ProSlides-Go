package live

import (
	"context"
	"encoding/json"
	"errors"
	"time"
)

var (
	ErrNotFound     = errors.New("live resource not found")
	ErrConflict     = errors.New("live state conflict")
	ErrUnauthorized = errors.New("participant unauthorized")
	ErrInvalid      = errors.New("invalid live request")
	ErrNameTaken    = errors.New("participant display name is already in use")
	ErrCSRF         = errors.New("csrf validation failed")
)

type Session struct {
	ID             string     `json:"id"`
	PresentationID string     `json:"presentation_id"`
	HostID         string     `json:"host_id"`
	JoinCode       string     `json:"join_code"`
	State          State      `json:"state"`
	StateVersion   int64      `json:"state_version"`
	ActiveSlideID  *string    `json:"active_slide_id"`
	EndsAt         *time.Time `json:"ends_at"`
}
type Participant struct {
	ID          string `json:"id"`
	DisplayName string `json:"display_name"`
	Avatar      string `json:"avatar,omitempty"`
}
type PublicSession struct {
	ID             string     `json:"id"`
	PresentationID string     `json:"presentation_id"`
	State          State      `json:"state"`
	StateVersion   int64      `json:"state_version"`
	ActiveSlideID  *string    `json:"active_slide_id"`
	EndsAt         *time.Time `json:"ends_at"`
}
type ParticipantWithScore struct {
	Participant
	Score int  `json:"score"`
	Rank  *int `json:"rank,omitempty"`
}
type SessionLocator struct {
	SessionID      string                 `json:"session_id"`
	PresentationID string                 `json:"presentation_id"`
	Presentation   PublicLivePresentation `json:"presentation"`
}
type PublicLivePresentation struct {
	Title              string `json:"title"`
	BackgroundColor    string `json:"background_color"`
	BackgroundImageURL string `json:"background_image_url"`
	TextColor          string `json:"text_color"`
}
type AnswerResult struct {
	AnswerID   string `json:"answer_id"`
	ScoreDelta int    `json:"score_delta"`
	Duplicate  bool   `json:"duplicate"`
}
type Event struct {
	EventID       int64           `json:"event_id"`
	SchemaVersion int             `json:"schema_version"`
	SessionID     string          `json:"session_id"`
	StateVersion  int64           `json:"state_version"`
	Name          string          `json:"name"`
	Payload       json.RawMessage `json:"payload"`
	OccurredAt    time.Time       `json:"occurred_at"`
}
type ParticipantSnapshot struct {
	Role             string               `json:"role"`
	Session          PublicSession        `json:"session"`
	ActiveSlide      json.RawMessage      `json:"active_slide,omitempty"`
	Participant      ParticipantWithScore `json:"participant"`
	ParticipantCount int                  `json:"participant_count"`
	LastEventID      int64                `json:"last_event_id"`
	QuestionStats    *QuestionStats       `json:"question_stats,omitempty"`
}
type ManagerSnapshot struct {
	Role             string          `json:"role"`
	Session          Session         `json:"session"`
	ActiveSlide      json.RawMessage `json:"active_slide,omitempty"`
	ParticipantCount int             `json:"participant_count"`
	LastEventID      int64           `json:"last_event_id"`
	QuestionStats    *QuestionStats  `json:"question_stats,omitempty"`
}
type QuestionStats struct {
	QuestionSlideID string         `json:"question_slide_id"`
	ResponseCount   int            `json:"response_count"`
	OptionCounts    map[string]int `json:"option_counts"`
}
type RosterEntry struct {
	ParticipantID string    `json:"participant_id"`
	DisplayName   string    `json:"display_name"`
	Avatar        string    `json:"avatar,omitempty"`
	Score         int       `json:"score"`
	JoinedAt      time.Time `json:"joined_at"`
}
type RosterCursor struct {
	Order    string    `json:"o"`
	JoinedAt time.Time `json:"j"`
	ID       string    `json:"i"`
	Score    int       `json:"s,omitempty"`
}
type RosterQuery struct {
	Order  string
	Limit  int
	Cursor *RosterCursor
}
type RosterPage struct {
	Items      []RosterEntry `json:"items"`
	Order      string        `json:"order"`
	Limit      int           `json:"limit"`
	HasMore    bool          `json:"has_more"`
	NextCursor *string       `json:"next_cursor,omitempty"`
}

type Store interface {
	CreateSession(context.Context, string, string, string, string) (Session, bool, error)
	ResolveSession(context.Context, string) (SessionLocator, error)
	Join(context.Context, string, string, string, string, []byte) (Participant, bool, error)
	ApplyAction(context.Context, string, string, string, int64, string, string, int) (Session, bool, error)
	SubmitAnswer(context.Context, string, []byte, string, string, []int, ScoringPolicy) (AnswerResult, error)
	ParticipantSnapshot(context.Context, string, []byte) (ParticipantSnapshot, error)
	ManagerSnapshot(context.Context, string, string) (ManagerSnapshot, error)
	Roster(context.Context, string, string, RosterQuery) (RosterPage, error)
	Events(context.Context, string, int64, int) ([]Event, error)
	LatestEventID(context.Context, string) (int64, error)
	AuthorizeViewer(context.Context, string, string, []byte) error
	ReconcileDeadline(context.Context, string) (bool, error)
}

type EventStore interface {
	Events(context.Context, string, int64, int) ([]Event, error)
	LatestEventID(context.Context, string) (int64, error)
}
