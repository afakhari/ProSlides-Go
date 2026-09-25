package presentations

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestValidateSlideContentAcceptsCompleteChoiceActivity(t *testing.T) {
	raw := json.RawMessage(`{
		"schema_version":1,
		"activity_kind":"choice",
		"prompt":{"title":"","text":"Choose","image_url":""},
		"response":{"selection":"multiple","options":[
			{"id":"a","text":"A","image_url":"","order":1},
			{"id":"b","text":"B","image_url":"","order":2}
		]},
		"evaluation":{"mode":"correctness","correct_option_ids":["a"]},
		"scoring":{"mode":"points","min_points":0,"max_points":100,"speed_bonus":true,"partial_credit":true},
		"timing":{"duration_seconds":30},
		"results":{"show_overall_leaderboard_after":true}
	}`)
	if err := validateSlideContent(ItemKindActivity, raw); err != nil {
		t.Fatalf("complete Choice Activity rejected: %v", err)
	}
}

func TestValidateSlideContentRejectsInvalidChoiceActivity(t *testing.T) {
	base := ActivityDefinition{
		SchemaVersion: ActivitySchemaVersion1,
		ActivityKind:  ActivityKindChoice,
		Prompt:        ActivityPrompt{Text: "Choose"},
		Response: ChoiceResponsePolicy{
			Selection: ChoiceSelectionSingle,
			Options: []ChoiceOptionDefinition{
				{ID: "a", Text: "A", Order: 1},
				{ID: "b", Text: "B", Order: 2},
			},
		},
		Evaluation: ChoiceEvaluationPolicy{
			Mode:             EvaluationModeCorrectness,
			CorrectOptionIDs: []string{"a"},
		},
		Scoring: ChoiceScoringPolicy{
			Mode:      ScoringModePoints,
			MaxPoints: 100,
		},
		Timing:  ActivityTimingPolicy{DurationSeconds: 30},
		Results: ActivityResultPolicy{},
	}

	invalid := base
	invalid.Response.Options[1].ID = "a"
	raw, err := json.Marshal(invalid)
	if err != nil {
		t.Fatal(err)
	}
	if err := validateSlideContent(ItemKindActivity, raw); err == nil {
		t.Fatal("Choice Activity with duplicate option ids accepted")
	}
}

func TestValidateContentSlideRequiresVisibleContent(t *testing.T) {
	if err := validateSlideContent("content", json.RawMessage(`{"title":"","text":"","image_url":""}`)); err == nil {
		t.Fatal("empty content slide accepted")
	}
	if err := validateSlideContent("content", json.RawMessage(`{"title":"Introduction","text":"","image_url":""}`)); err != nil {
		t.Fatalf("visible content slide rejected: %v", err)
	}
}

func TestReplaceSlideRejectsInvalidActivityBeforeStore(t *testing.T) {
	m := http.NewServeMux()
	NewHTTP(fakeSessions{}, &fakeStore{}).Register(m)
	req := httptest.NewRequest(http.MethodPut, "/api/v1/presentations/p/slides/s", strings.NewReader(`{
		"position":0,
		"kind":"activity",
		"content":{"schema_version":1,"activity_kind":"choice"}
	}`))
	req.AddCookie(&http.Cookie{Name: "proslides_session", Value: "token"})
	req.Header.Set("X-CSRF-Token", "csrf")
	result := httptest.NewRecorder()
	m.ServeHTTP(result, req)
	if result.Code != http.StatusBadRequest {
		t.Fatalf("status=%d", result.Code)
	}
}


func TestValidateChoiceActivityLengthsCountUnicodeCharacters(t *testing.T) {
	makeActivity := func(text, optionText string) json.RawMessage {
		value := ActivityDefinition{
			SchemaVersion: ActivitySchemaVersion1,
			ActivityKind:  ActivityKindChoice,
			Prompt:        ActivityPrompt{Text: text},
			Response: ChoiceResponsePolicy{
				Selection: ChoiceSelectionSingle,
				Options: []ChoiceOptionDefinition{
					{ID: "a", Text: optionText, Order: 1},
					{ID: "b", Text: "گزینه دوم", Order: 2},
				},
			},
			Evaluation: ChoiceEvaluationPolicy{
				Mode:             EvaluationModeCorrectness,
				CorrectOptionIDs: []string{"a"},
			},
			Scoring: ChoiceScoringPolicy{
				Mode:      ScoringModePoints,
				MaxPoints: 100,
			},
			Timing: ActivityTimingPolicy{DurationSeconds: 30},
		}
		raw, err := json.Marshal(value)
		if err != nil {
			t.Fatal(err)
		}
		return raw
	}

	if err := validateSlideContent(ItemKindActivity, makeActivity(strings.Repeat("س", 10000), strings.Repeat("گ", 2000))); err != nil {
		t.Fatalf("unicode Choice Activity at documented limits rejected: %v", err)
	}
	if err := validateSlideContent(ItemKindActivity, makeActivity(strings.Repeat("س", 10001), "گزینه")); err == nil {
		t.Fatal("Choice prompt over documented character limit accepted")
	}
	if err := validateSlideContent(ItemKindActivity, makeActivity("پرسش", strings.Repeat("گ", 2001))); err == nil {
		t.Fatal("Choice option over documented character limit accepted")
	}
}


func TestValidateContentSlideLengthsCountUnicodeCharacters(t *testing.T) {
	makeContent := func(title, text, imageURL string) json.RawMessage {
		value := map[string]any{
			"title":     title,
			"text":      text,
			"image_url": imageURL,
		}
		raw, err := json.Marshal(value)
		if err != nil {
			t.Fatal(err)
		}
		return raw
	}

	if err := validateSlideContent("content", makeContent(strings.Repeat("ع", 500), strings.Repeat("م", 20000), "")); err != nil {
		t.Fatalf("unicode content at documented limits rejected: %v", err)
	}
	if err := validateSlideContent("content", makeContent(strings.Repeat("ع", 501), "متن", "")); err == nil {
		t.Fatal("content title over documented character limit accepted")
	}
	if err := validateSlideContent("content", makeContent("عنوان", strings.Repeat("م", 20001), "")); err == nil {
		t.Fatal("content text over documented character limit accepted")
	}
}
