package presentations

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"strings"
	"unicode/utf8"
)

var errInvalidSlideDefinition = errors.New("invalid slide definition")

type questionOptionDefinition struct {
	ID        string `json:"id"`
	Text      string `json:"text"`
	IsCorrect bool   `json:"is_correct"`
	ImageURL  string `json:"image_url"`
	Order     int    `json:"order"`
}

type questionDefinition struct {
	Title                string                     `json:"title"`
	Text                 string                     `json:"text"`
	QuestionType         string                     `json:"question_type"`
	QuestionTime         int                        `json:"question_time"`
	MinPoint             int                        `json:"min_point"`
	MaxPoint             int                        `json:"max_point"`
	ImageURL             string                     `json:"image_url"`
	FasterAnswers        bool                       `json:"faster_answers_more_points"`
	PartialScoring       bool                       `json:"partial_scoring"`
	ShowLeaderboardAfter bool                       `json:"show_leaderboard_after"`
	Options              []questionOptionDefinition `json:"options"`
}

func validateSlideContent(kind string, raw json.RawMessage) error {
	if !validJSONObject(raw) {
		return errInvalidSlideDefinition
	}
	switch kind {
	case "question_draft":
		var value struct {
			ShowLeaderboardAfter bool `json:"show_leaderboard_after"`
		}
		return decodeStrictObject(raw, &value)
	case "question":
		var value questionDefinition
		if err := decodeStrictObject(raw, &value); err != nil {
			return err
		}
		return validateQuestionDefinition(value)
	case "content":
		var value struct {
			Title    string `json:"title"`
			Text     string `json:"text"`
			ImageURL string `json:"image_url"`
		}
		if err := decodeStrictObject(raw, &value); err != nil {
			return err
		}
		if (strings.TrimSpace(value.Title) == "" && strings.TrimSpace(value.Text) == "" && strings.TrimSpace(value.ImageURL) == "") || utf8.RuneCountInString(value.Title) > 500 || utf8.RuneCountInString(value.Text) > 20000 || utf8.RuneCountInString(value.ImageURL) > 4096 {
			return errInvalidSlideDefinition
		}
		return nil
	case "leaderboard":
		var value struct {
			Title string `json:"title"`
		}
		if err := decodeStrictObject(raw, &value); err != nil || len(value.Title) > 500 {
			return errInvalidSlideDefinition
		}
		return nil
	default:
		return errInvalidSlideDefinition
	}
}

func decodeStrictObject(raw json.RawMessage, target any) error {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return errInvalidSlideDefinition
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return errInvalidSlideDefinition
	}
	return nil
}

func validateQuestionDefinition(value questionDefinition) error {
	if strings.TrimSpace(value.Text) == "" || utf8.RuneCountInString(value.Text) > 10000 || utf8.RuneCountInString(value.Title) > 500 || utf8.RuneCountInString(value.ImageURL) > 4096 {
		return errInvalidSlideDefinition
	}
	if value.QuestionType != "single" && value.QuestionType != "multiple" {
		return errInvalidSlideDefinition
	}
	if value.QuestionTime < 1 || value.QuestionTime > 86400 || value.MinPoint < 0 || value.MaxPoint < 1 || value.MinPoint > value.MaxPoint {
		return errInvalidSlideDefinition
	}
	if value.QuestionType == "single" && value.PartialScoring {
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
		if id == "" || utf8.RuneCountInString(id) > 128 || strings.TrimSpace(option.Text) == "" || utf8.RuneCountInString(option.Text) > 2000 || utf8.RuneCountInString(option.ImageURL) > 4096 || option.Order < 1 || option.Order > len(value.Options) {
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
	if correct == 0 || (value.QuestionType == "single" && correct != 1) {
		return errInvalidSlideDefinition
	}
	return nil
}
