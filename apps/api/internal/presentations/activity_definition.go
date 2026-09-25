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
	ActivityKindText        = "text"

	ChoiceSelectionSingle   = "single"
	ChoiceSelectionMultiple = "multiple"

	EvaluationModeNone        = "none"
	EvaluationModeCorrectness = "correctness"

	ScoringModeNone   = "none"
	ScoringModePoints = "points"

	TextAggregationWordFrequency = "word_frequency"
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

// ActivityResponsePolicy is intentionally concrete rather than a free-form bag.
// Choice uses selection/options. Text uses max_length/max_words. Validation
// rejects fields that do not belong to the selected Activity kind.
type ActivityResponsePolicy struct {
	Selection string                   `json:"selection,omitempty"`
	Options   []ChoiceOptionDefinition `json:"options,omitempty"`
	MaxLength int                      `json:"max_length,omitempty"`
	MaxWords  int                      `json:"max_words,omitempty"`
}

type ActivityEvaluationPolicy struct {
	Mode             string   `json:"mode"`
	CorrectOptionIDs []string `json:"correct_option_ids,omitempty"`
}

type ActivityScoringPolicy struct {
	Mode          string `json:"mode"`
	MinPoints     int    `json:"min_points,omitempty"`
	MaxPoints     int    `json:"max_points,omitempty"`
	SpeedBonus    bool   `json:"speed_bonus,omitempty"`
	PartialCredit bool   `json:"partial_credit,omitempty"`
}

type ActivityTimingPolicy struct {
	DurationSeconds int `json:"duration_seconds"`
}

type ActivityResultPolicy struct {
	Aggregation                  string `json:"aggregation,omitempty"`
	ShowOverallLeaderboardAfter bool   `json:"show_overall_leaderboard_after"`
}

type ActivityDefinition struct {
	SchemaVersion int                      `json:"schema_version"`
	ActivityKind  string                   `json:"activity_kind"`
	Prompt        ActivityPrompt           `json:"prompt"`
	Response      ActivityResponsePolicy   `json:"response"`
	Evaluation    ActivityEvaluationPolicy `json:"evaluation"`
	Scoring       ActivityScoringPolicy    `json:"scoring"`
	Timing        ActivityTimingPolicy     `json:"timing"`
	Results       ActivityResultPolicy     `json:"results"`
}

func DecodeActivityDefinition(raw json.RawMessage) (ActivityDefinition, error) {
	var value ActivityDefinition
	if err := decodeStrictObject(raw, &value); err != nil {
		return ActivityDefinition{}, err
	}
	if err := validateActivityDefinition(value); err != nil {
		return ActivityDefinition{}, err
	}
	return value, nil
}

func validateActivityDefinition(value ActivityDefinition) error {
	if value.SchemaVersion != ActivitySchemaVersion1 {
		return errInvalidSlideDefinition
	}
	if strings.TrimSpace(value.Prompt.Text) == "" ||
		utf8.RuneCountInString(value.Prompt.Text) > 10000 ||
		utf8.RuneCountInString(value.Prompt.Title) > 500 ||
		utf8.RuneCountInString(value.Prompt.ImageURL) > 4096 {
		return errInvalidSlideDefinition
	}
	if value.Timing.DurationSeconds < 1 || value.Timing.DurationSeconds > 86400 {
		return errInvalidSlideDefinition
	}

	switch value.ActivityKind {
	case ActivityKindChoice:
		return validateChoiceActivityDefinition(value)
	case ActivityKindText:
		return validateTextActivityDefinition(value)
	default:
		return errInvalidSlideDefinition
	}
}

func validateChoiceActivityDefinition(value ActivityDefinition) error {
	if value.Response.MaxLength != 0 ||
		value.Response.MaxWords != 0 ||
		value.Results.Aggregation != "" {
		return errInvalidSlideDefinition
	}
	if value.Response.Selection != ChoiceSelectionSingle &&
		value.Response.Selection != ChoiceSelectionMultiple {
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
			(value.Response.Selection == ChoiceSelectionSingle &&
				value.Scoring.PartialCredit) {
			return errInvalidSlideDefinition
		}
	default:
		return errInvalidSlideDefinition
	}

	if value.Results.ShowOverallLeaderboardAfter &&
		value.Scoring.Mode != ScoringModePoints {
		return errInvalidSlideDefinition
	}
	return nil
}

func validateTextActivityDefinition(value ActivityDefinition) error {
	if value.Response.Selection != "" ||
		len(value.Response.Options) != 0 ||
		value.Response.MaxLength < 1 ||
		value.Response.MaxLength > 500 ||
		value.Response.MaxWords < 1 ||
		value.Response.MaxWords > 10 {
		return errInvalidSlideDefinition
	}
	if value.Evaluation.Mode != EvaluationModeNone ||
		len(value.Evaluation.CorrectOptionIDs) != 0 {
		return errInvalidSlideDefinition
	}
	if value.Scoring.Mode != ScoringModeNone ||
		value.Scoring.MinPoints != 0 ||
		value.Scoring.MaxPoints != 0 ||
		value.Scoring.SpeedBonus ||
		value.Scoring.PartialCredit {
		return errInvalidSlideDefinition
	}
	if value.Results.Aggregation != TextAggregationWordFrequency ||
		value.Results.ShowOverallLeaderboardAfter {
		return errInvalidSlideDefinition
	}
	return nil
}
