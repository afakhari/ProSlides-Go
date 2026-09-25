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
	default:
		return "", nil, errInvalidSlideDefinition
	}
}

