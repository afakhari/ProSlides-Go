package presentations

import (
	"encoding/json"
	"strings"
	"unicode/utf8"
)

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

