package presentations

import (
	"encoding/json"
	"errors"
	"net/url"
	"strings"
	"unicode/utf8"
)

var errInvalidPresentationSettings = errors.New("invalid presentation settings")

func validatePresentationSettings(raw json.RawMessage) error {
	if len(raw) == 0 {
		return nil
	}

	var values map[string]json.RawMessage
	if err := json.Unmarshal(raw, &values); err != nil {
		return errInvalidPresentationSettings
	}

	for _, key := range []string{"background_color", "text_color"} {
		value, ok := values[key]
		if !ok {
			continue
		}
		var color string
		if json.Unmarshal(value, &color) != nil || !validHexColor(color) {
			return errInvalidPresentationSettings
		}
	}

	if value, ok := values["background_image_url"]; ok {
		var imageURL string
		if json.Unmarshal(value, &imageURL) != nil || utf8.RuneCountInString(imageURL) > 4096 {
			return errInvalidPresentationSettings
		}
		imageURL = strings.TrimSpace(imageURL)
		if imageURL != "" {
			parsed, err := url.ParseRequestURI(imageURL)
			if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
				return errInvalidPresentationSettings
			}
		}
	}

	return nil
}

func validHexColor(value string) bool {
	if len(value) != 7 || value[0] != '#' {
		return false
	}
	for _, r := range value[1:] {
		switch {
		case r >= '0' && r <= '9':
		case r >= 'a' && r <= 'f':
		case r >= 'A' && r <= 'F':
		default:
			return false
		}
	}
	return true
}
