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

	for _, key := range []string{"background_image_url", "music_url"} {
		value, ok := values[key]
		if !ok {
			continue
		}
		var resourceURL string
		if json.Unmarshal(value, &resourceURL) != nil || utf8.RuneCountInString(resourceURL) > 4096 {
			return errInvalidPresentationSettings
		}
		resourceURL = strings.TrimSpace(resourceURL)
		if resourceURL == "" {
			continue
		}
		parsed, err := url.ParseRequestURI(resourceURL)
		if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
			return errInvalidPresentationSettings
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
