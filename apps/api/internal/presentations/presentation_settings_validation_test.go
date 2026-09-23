package presentations

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestValidatePresentationSettingsAcceptsKnownDesignValues(t *testing.T) {
	raw := json.RawMessage(`{
		"background_color":"#312e81",
		"background_image_url":"https://example.com/background.jpg",
		"text_color":"#ffffff",
		"music_url":"https://example.com/music.mp3"
	}`)

	if err := validatePresentationSettings(raw); err != nil {
		t.Fatalf("valid design settings rejected: %v", err)
	}
}

func TestValidatePresentationSettingsRejectsInvalidKnownDesignValues(t *testing.T) {
	cases := []string{
		`{"background_color":"banana"}`,
		`{"text_color":"#fff"}`,
		`{"background_image_url":"javascript:alert(1)"}`,
		`{"background_image_url":123}`,
		`{"background_color":null}`,
	}

	for _, raw := range cases {
		if err := validatePresentationSettings(json.RawMessage(raw)); err == nil {
			t.Fatalf("invalid design settings accepted: %s", raw)
		}
	}
}

func TestValidatePresentationSettingsAcceptsEmptyImageAndAdditionalSettings(t *testing.T) {
	raw := json.RawMessage(`{
		"background_image_url":"",
		"custom_future_setting":{"enabled":true}
	}`)

	if err := validatePresentationSettings(raw); err != nil {
		t.Fatalf("compatible additional settings rejected: %v", err)
	}
}

func TestPresentationTitleLengthUsesUnicodeCharacters(t *testing.T) {
	title := strings.Repeat("ع", 500)
	if utf8Count := len([]rune(title)); utf8Count != 500 {
		t.Fatalf("unexpected rune count: %d", utf8Count)
	}
}
