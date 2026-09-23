package presentations

import (
	"encoding/json"
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

func TestValidatePresentationSettingsRejectsOversizedBackgroundImageURL(t *testing.T) {
	longURL := "https://example.com/" + string(make([]rune, 4096))
	raw, err := json.Marshal(map[string]any{
		"background_image_url": longURL,
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := validatePresentationSettings(raw); err == nil {
		t.Fatal("oversized background image URL accepted")
	}
}
