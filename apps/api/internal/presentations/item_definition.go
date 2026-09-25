package presentations

import (
	"encoding/json"
	"strings"
	"unicode/utf8"
)

const (
	ItemKindActivity = "activity"

	ActivitySchemaVersion1 = 1
	ActivityKindChoice      = "choice"

	ChoiceSelectionSingle   = "single"
	ChoiceSelectionMultiple = "multiple"

	EvaluationModeNone        = "none"
	EvaluationModeCorrectness = "correctness"

	ScoringModeNone   = "none"
	ScoringModePoints = "points"
)

type ActivityPrompt struct {
	Title    string `json:"title"`
	Text     string `json:"text"`
	ImageURL string `json:"image_url"`
}

type ChoiceOptionDefinition struct {
	ID       string `json:"id"`
	Text     string `json:"text"`
	ImageURL string `json:"image_url"`
	Order    int    `json:"order"`
}

type ChoiceResponsePolicy struct {
	Selection string                   `json:"selection"`
	Options   []ChoiceOptionDefinition `json:"options"`
}

type ChoiceEvaluationPolicy struct {
	Mode             string   `json:"mode"`
	CorrectOptionIDs []string `json:"correct_option_ids"`
}

type ChoiceScoringPolicy struct {
	Mode          string `json:"mode"`
	MinPoints     int    `json:"min_points"`
	MaxPoints     int    `json:"max_points"`
	SpeedBonus    bool   `json:"speed_bonus"`
	PartialCredit bool   `json:"partial_credit"`
}

type ActivityTimingPolicy struct {
	DurationSeconds int `json:"duration_seconds"`
}

type ActivityResultPolicy struct {
	ShowOverallLeaderboardAfter bool `json:"show_overall_leaderboard_after"`
}

type ActivityDefinition struct {
	SchemaVersion int                    `json:"schema_version"`
	ActivityKind  string                 `json:"activity_kind"`
	Prompt        ActivityPrompt         `json:"prompt"`
	Response      ChoiceResponsePolicy   `json:"response"`
	Evaluation    ChoiceEvaluationPolicy `json:"evaluation"`
	Scoring       ChoiceScoringPolicy    `json:"scoring"`
	Timing        ActivityTimingPolicy   `json:"timing"`
	Results       ActivityResultPolicy   `json:"results"`
}

// legacyQuestionDefinition is intentionally confined to the migration boundary.
// Authored Choice Activities are persisted in ActivityDefinition form; this
// shape remains only for legacy request compatibility and the pre-V2.2 live
// snapshot projection.
type legacyQuestionDefinition struct {
	Title                string                       `json:"title"`
	Text                 string                       `json:"text"`
	QuestionType         string                       `json:"question_type"`
	QuestionTime         int                          `json:"question_time"`
	MinPoint             int                          `json:"min_point"`
	MaxPoint             int                          `json:"max_point"`
	ImageURL             string                       `json:"image_url"`
	FasterAnswers        bool                         `json:"faster_answers_more_points"`
	PartialScoring       bool                         `json:"partial_scoring"`
	ShowLeaderboardAfter bool                         `json:"show_leaderboard_after"`
	Options              []legacyQuestionOption       `json:"options"`
}

type legacyQuestionOption struct {
	ID        string `json:"id"`
	Text      string `json:"text"`
	IsCorrect bool   `json:"is_correct"`
	ImageURL  string `json:"image_url"`
	Order     int    `json:"order"`
}

func normalizeSlideDefinition(kind string, raw json.RawMessage) (string, json.RawMessage, error) {
	if !validJSONObject(raw) {
		return "", nil, errInvalidSlideDefinition
	}

	switch kind {
	case "question":
		var legacy legacyQuestionDefinition
		if err := decodeStrictObject(raw, &legacy); err != nil {
			return "", nil, err
		}
		if err := validateLegacyQuestionDefinition(legacy); err != nil {
			return "", nil, err
		}
		activity := activityFromLegacyQuestion(legacy)
		normalized, err := json.Marshal(activity)
		if err != nil {
			return "", nil, errInvalidSlideDefinition
		}
		return ItemKindActivity, normalized, nil
	case ItemKindActivity:
		var activity ActivityDefinition
		if err := decodeStrictObject(raw, &activity); err != nil {
			return "", nil, err
		}
		if err := validateActivityDefinition(activity); err != nil {
			return "", nil, err
		}
		normalized, err := json.Marshal(activity)
		if err != nil {
			return "", nil, errInvalidSlideDefinition
		}
		return ItemKindActivity, normalized, nil
	case "question_draft":
		var value struct {
			ShowLeaderboardAfter bool `json:"show_leaderboard_after"`
		}
		if err := decodeStrictObject(raw, &value); err != nil {
			return "", nil, err
		}
		return kind, raw, nil
	case "content":
		var value struct {
			Title    string `json:"title"`
			Text     string `json:"text"`
			ImageURL string `json:"image_url"`
		}
		if err := decodeStrictObject(raw, &value); err != nil {
			return "", nil, err
		}
		if (strings.TrimSpace(value.Title) == "" && strings.TrimSpace(value.Text) == "" && strings.TrimSpace(value.ImageURL) == "") ||
			utf8.RuneCountInString(value.Title) > 500 ||
			utf8.RuneCountInString(value.Text) > 20000 ||
			utf8.RuneCountInString(value.ImageURL) > 4096 {
			return "", nil, errInvalidSlideDefinition
		}
		return kind, raw, nil
	case "leaderboard":
		var value struct {
			Title string `json:"title"`
		}
		if err := decodeStrictObject(raw, &value); err != nil || utf8.RuneCountInString(value.Title) > 500 {
			return "", nil, errInvalidSlideDefinition
		}
		return kind, raw, nil
	default:
		return "", nil, errInvalidSlideDefinition
	}
}

func validateActivityDefinition(value ActivityDefinition) error {
	if value.SchemaVersion != ActivitySchemaVersion1 || value.ActivityKind != ActivityKindChoice {
		return errInvalidSlideDefinition
	}
	if strings.TrimSpace(value.Prompt.Text) == "" ||
		utf8.RuneCountInString(value.Prompt.Text) > 10000 ||
		utf8.RuneCountInString(value.Prompt.Title) > 500 ||
		utf8.RuneCountInString(value.Prompt.ImageURL) > 4096 {
		return errInvalidSlideDefinition
	}
	if value.Response.Selection != ChoiceSelectionSingle && value.Response.Selection != ChoiceSelectionMultiple {
		return errInvalidSlideDefinition
	}
	if len(value.Response.Options) < 2 || len(value.Response.Options) > 100 {
		return errInvalidSlideDefinition
	}
	ids := make(map[string]struct{}, len(value.Response.Options))
	orders := make(map[int]struct{}, len(value.Response.Options))
	for _, option := range value.Response.Options {
		id := strings.TrimSpace(option.ID)
		if id == "" ||
			utf8.RuneCountInString(id) > 128 ||
			strings.TrimSpace(option.Text) == "" ||
			utf8.RuneCountInString(option.Text) > 2000 ||
			utf8.RuneCountInString(option.ImageURL) > 4096 ||
			option.Order < 1 ||
			option.Order > len(value.Response.Options) {
			return errInvalidSlideDefinition
		}
		if _, exists := ids[id]; exists {
			return errInvalidSlideDefinition
		}
		if _, exists := orders[option.Order]; exists {
			return errInvalidSlideDefinition
		}
		ids[id] = struct{}{}
		orders[option.Order] = struct{}{}
	}

	switch value.Evaluation.Mode {
	case EvaluationModeNone:
		if len(value.Evaluation.CorrectOptionIDs) != 0 {
			return errInvalidSlideDefinition
		}
	case EvaluationModeCorrectness:
		if len(value.Evaluation.CorrectOptionIDs) == 0 {
			return errInvalidSlideDefinition
		}
		correct := make(map[string]struct{}, len(value.Evaluation.CorrectOptionIDs))
		for _, id := range value.Evaluation.CorrectOptionIDs {
			if _, exists := ids[id]; !exists {
				return errInvalidSlideDefinition
			}
			if _, duplicate := correct[id]; duplicate {
				return errInvalidSlideDefinition
			}
			correct[id] = struct{}{}
		}
		if value.Response.Selection == ChoiceSelectionSingle && len(correct) != 1 {
			return errInvalidSlideDefinition
		}
	default:
		return errInvalidSlideDefinition
	}

	switch value.Scoring.Mode {
	case ScoringModeNone:
		if value.Scoring.MinPoints != 0 ||
			value.Scoring.MaxPoints != 0 ||
			value.Scoring.SpeedBonus ||
			value.Scoring.PartialCredit {
			return errInvalidSlideDefinition
		}
	case ScoringModePoints:
		if value.Evaluation.Mode != EvaluationModeCorrectness ||
			value.Scoring.MinPoints < 0 ||
			value.Scoring.MaxPoints < 1 ||
			value.Scoring.MinPoints > value.Scoring.MaxPoints ||
			(value.Response.Selection == ChoiceSelectionSingle && value.Scoring.PartialCredit) {
			return errInvalidSlideDefinition
		}
	default:
		return errInvalidSlideDefinition
	}

	if value.Timing.DurationSeconds < 1 || value.Timing.DurationSeconds > 86400 {
		return errInvalidSlideDefinition
	}
	if value.Results.ShowOverallLeaderboardAfter && value.Scoring.Mode != ScoringModePoints {
		return errInvalidSlideDefinition
	}
	return nil
}

func validateLegacyQuestionDefinition(value legacyQuestionDefinition) error {
	if strings.TrimSpace(value.Text) == "" ||
		utf8.RuneCountInString(value.Text) > 10000 ||
		utf8.RuneCountInString(value.Title) > 500 ||
		utf8.RuneCountInString(value.ImageURL) > 4096 {
		return errInvalidSlideDefinition
	}
	if value.QuestionType != ChoiceSelectionSingle && value.QuestionType != ChoiceSelectionMultiple {
		return errInvalidSlideDefinition
	}
	if value.QuestionTime < 1 || value.QuestionTime > 86400 ||
		value.MinPoint < 0 ||
		value.MaxPoint < 1 ||
		value.MinPoint > value.MaxPoint ||
		(value.QuestionType == ChoiceSelectionSingle && value.PartialScoring) {
		return errInvalidSlideDefinition
	}
	if len(value.Options) < 2 || len(value.Options) > 100 {
		return errInvalidSlideDefinition
	}
	ids := make(map[string]struct{}, len(value.Options))
	orders := make(map[int]struct{}, len(value.Options))
	correct := 0
	for _, option := range value.Options {
		id := strings.TrimSpace(option.ID)
		if id == "" ||
			utf8.RuneCountInString(id) > 128 ||
			strings.TrimSpace(option.Text) == "" ||
			utf8.RuneCountInString(option.Text) > 2000 ||
			utf8.RuneCountInString(option.ImageURL) > 4096 ||
			option.Order < 1 ||
			option.Order > len(value.Options) {
			return errInvalidSlideDefinition
		}
		if _, exists := ids[id]; exists {
			return errInvalidSlideDefinition
		}
		if _, exists := orders[option.Order]; exists {
			return errInvalidSlideDefinition
		}
		ids[id] = struct{}{}
		orders[option.Order] = struct{}{}
		if option.IsCorrect {
			correct++
		}
	}
	if correct == 0 || (value.QuestionType == ChoiceSelectionSingle && correct != 1) {
		return errInvalidSlideDefinition
	}
	return nil
}

func activityFromLegacyQuestion(value legacyQuestionDefinition) ActivityDefinition {
	options := make([]ChoiceOptionDefinition, 0, len(value.Options))
	correct := make([]string, 0, len(value.Options))
	for _, option := range value.Options {
		options = append(options, ChoiceOptionDefinition{
			ID:       option.ID,
			Text:     option.Text,
			ImageURL: option.ImageURL,
			Order:    option.Order,
		})
		if option.IsCorrect {
			correct = append(correct, option.ID)
		}
	}
	return ActivityDefinition{
		SchemaVersion: ActivitySchemaVersion1,
		ActivityKind:  ActivityKindChoice,
		Prompt: ActivityPrompt{
			Title:    value.Title,
			Text:     value.Text,
			ImageURL: value.ImageURL,
		},
		Response: ChoiceResponsePolicy{
			Selection: value.QuestionType,
			Options:   options,
		},
		Evaluation: ChoiceEvaluationPolicy{
			Mode:             EvaluationModeCorrectness,
			CorrectOptionIDs: correct,
		},
		Scoring: ChoiceScoringPolicy{
			Mode:          ScoringModePoints,
			MinPoints:     value.MinPoint,
			MaxPoints:     value.MaxPoint,
			SpeedBonus:    value.FasterAnswers,
			PartialCredit: value.PartialScoring,
		},
		Timing: ActivityTimingPolicy{DurationSeconds: value.QuestionTime},
		Results: ActivityResultPolicy{
			ShowOverallLeaderboardAfter: value.ShowLeaderboardAfter,
		},
	}
}

// LegacyLiveSlideDefinition projects one authored Item into the frozen shape
// consumed by the pre-V2.2 live engine. It does not mutate authoring storage.
func LegacyLiveSlideDefinition(kind string, raw json.RawMessage) (string, json.RawMessage, error) {
	if kind != ItemKindActivity {
		return kind, raw, nil
	}
	var activity ActivityDefinition
	if err := decodeStrictObject(raw, &activity); err != nil {
		return "", nil, err
	}
	if err := validateActivityDefinition(activity); err != nil {
		return "", nil, err
	}
	if activity.ActivityKind != ActivityKindChoice ||
		activity.Evaluation.Mode != EvaluationModeCorrectness ||
		activity.Scoring.Mode != ScoringModePoints {
		return "", nil, errInvalidSlideDefinition
	}

	correct := make(map[string]struct{}, len(activity.Evaluation.CorrectOptionIDs))
	for _, id := range activity.Evaluation.CorrectOptionIDs {
		correct[id] = struct{}{}
	}
	options := make([]legacyQuestionOption, 0, len(activity.Response.Options))
	for _, option := range activity.Response.Options {
		_, isCorrect := correct[option.ID]
		options = append(options, legacyQuestionOption{
			ID:        option.ID,
			Text:      option.Text,
			IsCorrect: isCorrect,
			ImageURL:  option.ImageURL,
			Order:     option.Order,
		})
	}
	legacy := legacyQuestionDefinition{
		Title:                activity.Prompt.Title,
		Text:                 activity.Prompt.Text,
		QuestionType:         activity.Response.Selection,
		QuestionTime:         activity.Timing.DurationSeconds,
		MinPoint:             activity.Scoring.MinPoints,
		MaxPoint:             activity.Scoring.MaxPoints,
		ImageURL:             activity.Prompt.ImageURL,
		FasterAnswers:        activity.Scoring.SpeedBonus,
		PartialScoring:       activity.Scoring.PartialCredit,
		ShowLeaderboardAfter: activity.Results.ShowOverallLeaderboardAfter,
		Options:              options,
	}
	encoded, err := json.Marshal(legacy)
	if err != nil {
		return "", nil, errInvalidSlideDefinition
	}
	return "question", encoded, nil
}
