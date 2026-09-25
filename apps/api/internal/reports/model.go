package reports

import (
	"context"
	"encoding/json"
	"errors"
	"time"
)

var ErrNotFound = errors.New("report resource not found")

type SessionCursor struct {
	CreatedAt time.Time `json:"t"`
	SessionID string    `json:"i"`
}

type ResponseCursor struct {
	SubmittedAt time.Time `json:"t"`
	AnswerID    string    `json:"i"`
}

type RankingCursor struct {
	Score         int       `json:"s"`
	JoinedAt      time.Time `json:"j"`
	ParticipantID string    `json:"i"`
}

type SessionQuery struct {
	Limit  int
	Cursor *SessionCursor
}

type ResponseQuery struct {
	Limit  int
	Cursor *ResponseCursor
}

type RankingQuery struct {
	Limit  int
	Cursor *RankingCursor
}

type SessionSummary struct {
	SessionID         string     `json:"session_id"`
	PresentationID    string     `json:"presentation_id"`
	PresentationTitle *string    `json:"presentation_title"`
	State             string     `json:"state"`
	CreatedAt         time.Time  `json:"created_at"`
	EndedAt           *time.Time `json:"ended_at,omitempty"`
	ParticipantCount  int        `json:"participant_count"`
	ActivityCount     int        `json:"activity_count"`
	ResponseCount     int        `json:"response_count"`
	HasScoring        bool       `json:"has_scoring"`
}

type SessionPage struct {
	Items      []SessionSummary `json:"items"`
	Limit      int              `json:"limit"`
	HasMore    bool             `json:"has_more"`
	NextCursor *string          `json:"next_cursor,omitempty"`
}

type ActivitySummary struct {
	ActivityItemID string          `json:"activity_item_id"`
	Position       int             `json:"position"`
	Definition     json.RawMessage `json:"definition"`
	ResponseCount  int             `json:"response_count"`
	Scored         bool            `json:"scored"`
}

type SessionReport struct {
	Session    SessionSummary    `json:"session"`
	Activities []ActivitySummary `json:"activities"`
}

type ActivityResult struct {
	ActivityItemID string          `json:"activity_item_id"`
	ActivityKind   string          `json:"activity_kind"`
	SchemaVersion  int             `json:"schema_version"`
	ResponseCount  int             `json:"response_count"`
	Payload        json.RawMessage `json:"payload"`
}

type ActivityTopPerformer struct {
	ParticipantID string `json:"participant_id"`
	DisplayName   string `json:"display_name"`
	Avatar        string `json:"avatar,omitempty"`
	ScoreDelta    int    `json:"score_delta"`
	Rank          int    `json:"rank"`
}

type ResponseEvaluation struct {
	Mode       string `json:"mode"`
	Correct    *bool  `json:"correct,omitempty"`
	ScoreDelta int    `json:"score_delta"`
}

type ActivityResponse struct {
	AnswerID      string             `json:"answer_id"`
	ParticipantID string             `json:"participant_id"`
	DisplayName   string             `json:"display_name"`
	Avatar        string             `json:"avatar,omitempty"`
	Response      json.RawMessage    `json:"response"`
	Evaluation    ResponseEvaluation `json:"evaluation"`
	SubmittedAt   time.Time          `json:"submitted_at"`
}

type ActivityReportPage struct {
	Activity      ActivitySummary        `json:"activity"`
	Result        ActivityResult         `json:"result"`
	TopPerformers []ActivityTopPerformer `json:"top_performers"`
	Responses     []ActivityResponse     `json:"responses"`
	Limit         int                    `json:"limit"`
	HasMore       bool                   `json:"has_more"`
	NextCursor    *string                `json:"next_cursor,omitempty"`
}

type RankingEntry struct {
	ParticipantID string    `json:"participant_id"`
	DisplayName   string    `json:"display_name"`
	Avatar        string    `json:"avatar,omitempty"`
	Score         int       `json:"score"`
	Rank          int       `json:"rank"`
	JoinedAt      time.Time `json:"joined_at"`
}

type RankingPage struct {
	HasScoring bool           `json:"has_scoring"`
	IsFinal    bool           `json:"is_final"`
	Items      []RankingEntry `json:"items"`
	Limit      int            `json:"limit"`
	HasMore    bool           `json:"has_more"`
	NextCursor *string        `json:"next_cursor,omitempty"`
}

type Store interface {
	ListSessions(context.Context, string, string, SessionQuery) (SessionPage, error)
	SessionReport(context.Context, string, string, string) (SessionReport, error)
	ActivityReport(context.Context, string, string, string, string, ResponseQuery) (ActivityReportPage, error)
	Ranking(context.Context, string, string, string, RankingQuery) (RankingPage, error)
}

type choiceDefinition struct {
	SchemaVersion int    `json:"schema_version"`
	ActivityKind  string `json:"activity_kind"`
	Response     struct {
		Options []struct {
			ID string `json:"id"`
		} `json:"options"`
	} `json:"response"`
	Evaluation struct {
		Mode             string   `json:"mode"`
		CorrectOptionIDs []string `json:"correct_option_ids"`
	} `json:"evaluation"`
}

type choiceResponse struct {
	SelectedOptionIndexes []int `json:"selected_option_indexes"`
}

func parseChoiceDefinition(raw json.RawMessage) (choiceDefinition, error) {
	var definition choiceDefinition
	if err := json.Unmarshal(raw, &definition); err != nil {
		return definition, err
	}
	if definition.ActivityKind != "choice" {
		return definition, nil
	}
	return definition, nil
}

func evaluateResponse(definitionRaw, responseRaw json.RawMessage, scoreDelta int) (ResponseEvaluation, error) {
	evaluation := ResponseEvaluation{Mode: "none", ScoreDelta: scoreDelta}
	definition, err := parseChoiceDefinition(definitionRaw)
	if err != nil {
		return evaluation, err
	}
	if definition.ActivityKind != "choice" || definition.Evaluation.Mode != "correctness" {
		return evaluation, nil
	}
	evaluation.Mode = "correctness"

	var response choiceResponse
	if err := json.Unmarshal(responseRaw, &response); err != nil {
		return evaluation, err
	}

	selectedIDs := make(map[string]struct{}, len(response.SelectedOptionIndexes))
	valid := true
	for _, index := range response.SelectedOptionIndexes {
		if index < 0 || index >= len(definition.Response.Options) {
			valid = false
			continue
		}
		selectedIDs[definition.Response.Options[index].ID] = struct{}{}
	}
	correctIDs := make(map[string]struct{}, len(definition.Evaluation.CorrectOptionIDs))
	for _, id := range definition.Evaluation.CorrectOptionIDs {
		correctIDs[id] = struct{}{}
	}
	isCorrect := valid && len(selectedIDs) == len(correctIDs)
	if isCorrect {
		for id := range correctIDs {
			if _, ok := selectedIDs[id]; !ok {
				isCorrect = false
				break
			}
		}
	}
	evaluation.Correct = &isCorrect
	return evaluation, nil
}

func choiceResultPayload(definitionRaw json.RawMessage, indexedCounts map[int]int) (json.RawMessage, error) {
	definition, err := parseChoiceDefinition(definitionRaw)
	if err != nil {
		return nil, err
	}
	counts := map[string]int{}
	if definition.ActivityKind != "choice" {
		return json.Marshal(map[string]any{})
	}
	for _, option := range definition.Response.Options {
		counts[option.ID] = 0
	}
	for index, count := range indexedCounts {
		if index < 0 || index >= len(definition.Response.Options) {
			continue
		}
		counts[definition.Response.Options[index].ID] += count
	}
	return json.Marshal(map[string]any{"option_counts": counts})
}
