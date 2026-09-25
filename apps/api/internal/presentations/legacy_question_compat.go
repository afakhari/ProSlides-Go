package presentations

import (
	"strings"
	"unicode/utf8"
)

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
