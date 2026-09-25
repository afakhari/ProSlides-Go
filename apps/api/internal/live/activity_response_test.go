package live

import (
	"encoding/json"
	"errors"
	"reflect"
	"testing"

	"github.com/proslides/proslides/internal/presentations"
)

func wordCloudDefinition(maxWords int) presentations.ActivityDefinition {
	return presentations.ActivityDefinition{
		SchemaVersion: presentations.ActivitySchemaVersion1,
		ActivityKind:  presentations.ActivityKindText,
		Prompt: presentations.ActivityPrompt{
			Text: "سه واژه درباره این جلسه بنویسید",
		},
		Response: presentations.ActivityResponsePolicy{
			MaxLength: 80,
			MaxWords:  maxWords,
		},
		Evaluation: presentations.ActivityEvaluationPolicy{
			Mode: presentations.EvaluationModeNone,
		},
		Scoring: presentations.ActivityScoringPolicy{
			Mode: presentations.ScoringModeNone,
		},
		Timing: presentations.ActivityTimingPolicy{
			DurationSeconds: 30,
		},
		Results: presentations.ActivityResultPolicy{
			Aggregation: presentations.TextAggregationWordFrequency,
		},
	}
}

func TestNormalizeTextActivityResponseFreezesUnicodeTerms(t *testing.T) {
	raw := json.RawMessage(`{"text":"  داده، داده AI هوش‌مصنوعی  "}`)
	normalized, selected, err := normalizeActivityResponse(
		wordCloudDefinition(4),
		raw,
	)
	if err != nil {
		t.Fatalf("normalize Text response: %v", err)
	}
	if selected != nil {
		t.Fatalf("Text Activity unexpectedly returned Choice indexes: %#v", selected)
	}

	var stored storedTextActivityResponse
	if err := json.Unmarshal(normalized, &stored); err != nil {
		t.Fatal(err)
	}
	if stored.Text != "داده، داده AI هوش‌مصنوعی" {
		t.Fatalf("stored text = %q", stored.Text)
	}
	wantTerms := []string{"داده", "ai", "هوش‌مصنوعی"}
	if !reflect.DeepEqual(stored.Terms, wantTerms) {
		t.Fatalf("terms = %#v, want %#v", stored.Terms, wantTerms)
	}
}

func TestNormalizeTextActivityResponseCountsRepeatedWordsTowardLimit(t *testing.T) {
	_, _, err := normalizeActivityResponse(
		wordCloudDefinition(3),
		json.RawMessage(`{"text":"داده داده AI هوش‌مصنوعی"}`),
	)
	if !errors.Is(err, ErrInvalid) {
		t.Fatalf("error = %v, want ErrInvalid", err)
	}
}

func TestNormalizeTextActivityResponseRejectsUnknownShape(t *testing.T) {
	_, _, err := normalizeActivityResponse(
		wordCloudDefinition(3),
		json.RawMessage(`{"text":"داده","selected_option_indexes":[0]}`),
	)
	if !errors.Is(err, ErrInvalid) {
		t.Fatalf("error = %v, want ErrInvalid", err)
	}
}

func TestNormalizeChoiceActivityResponseStillUsesFrozenOptionIndexes(t *testing.T) {
	definition := presentations.ActivityDefinition{
		SchemaVersion: presentations.ActivitySchemaVersion1,
		ActivityKind:  presentations.ActivityKindChoice,
		Prompt: presentations.ActivityPrompt{
			Text: "انتخاب کنید",
		},
		Response: presentations.ActivityResponsePolicy{
			Selection: presentations.ChoiceSelectionMultiple,
			Options: []presentations.ChoiceOptionDefinition{
				{ID: "first", Text: "اول", Order: 1},
				{ID: "second", Text: "دوم", Order: 2},
			},
		},
		Evaluation: presentations.ActivityEvaluationPolicy{
			Mode:             presentations.EvaluationModeCorrectness,
			CorrectOptionIDs: []string{"first"},
		},
		Scoring: presentations.ActivityScoringPolicy{
			Mode:      presentations.ScoringModePoints,
			MaxPoints: 100,
		},
		Timing: presentations.ActivityTimingPolicy{DurationSeconds: 30},
		Results: presentations.ActivityResultPolicy{},
	}

	normalized, selected, err := normalizeActivityResponse(
		definition,
		json.RawMessage(`{"selected_option_indexes":[1,0]}`),
	)
	if err != nil {
		t.Fatalf("normalize Choice response: %v", err)
	}
	if !reflect.DeepEqual(selected, []int{1, 0}) {
		t.Fatalf("selected = %#v", selected)
	}
	if string(normalized) != `{"selected_option_indexes":[1,0]}` {
		t.Fatalf("normalized = %s", normalized)
	}
}
