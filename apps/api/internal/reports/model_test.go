package reports

import (
	"encoding/json"
	"testing"

	"github.com/proslides/proslides/internal/presentations"
)

func frozenChoiceDefinition(evaluationMode string, correctIDs []string) json.RawMessage {
	activity := presentations.ActivityDefinition{
		SchemaVersion: presentations.ActivitySchemaVersion1,
		ActivityKind:  presentations.ActivityKindChoice,
		Prompt: presentations.ActivityPrompt{
			Text: "Choose",
		},
		Response: presentations.ActivityResponsePolicy{
			Selection: presentations.ChoiceSelectionMultiple,
			Options: []presentations.ChoiceOptionDefinition{
				{ID: "a", Text: "A", Order: 1},
				{ID: "b", Text: "B", Order: 2},
				{ID: "c", Text: "C", Order: 3},
			},
		},
		Evaluation: presentations.ActivityEvaluationPolicy{
			Mode:             evaluationMode,
			CorrectOptionIDs: correctIDs,
		},
		Scoring: presentations.ActivityScoringPolicy{
			Mode: presentations.ScoringModeNone,
		},
		Timing: presentations.ActivityTimingPolicy{
			DurationSeconds: 30,
		},
		Results: presentations.ActivityResultPolicy{},
	}
	raw, err := json.Marshal(activity)
	if err != nil {
		panic(err)
	}
	return raw
}

func TestEvaluateChoiceResponseUsesFrozenDefinition(t *testing.T) {
	definition := presentations.ActivityDefinition{
		SchemaVersion: presentations.ActivitySchemaVersion1,
		ActivityKind:  presentations.ActivityKindChoice,
		Prompt:        presentations.ActivityPrompt{Text: "Choose"},
		Response: presentations.ActivityResponsePolicy{
			Selection: presentations.ChoiceSelectionMultiple,
			Options: []presentations.ChoiceOptionDefinition{
				{ID: "a", Text: "A", Order: 1},
				{ID: "b", Text: "B", Order: 2},
				{ID: "c", Text: "C", Order: 3},
			},
		},
		Evaluation: presentations.ActivityEvaluationPolicy{
			Mode:             presentations.EvaluationModeCorrectness,
			CorrectOptionIDs: []string{"a", "c"},
		},
		Scoring: presentations.ActivityScoringPolicy{
			Mode:      presentations.ScoringModePoints,
			MaxPoints: 100,
		},
		Timing:  presentations.ActivityTimingPolicy{DurationSeconds: 30},
		Results: presentations.ActivityResultPolicy{},
	}
	raw, err := json.Marshal(definition)
	if err != nil {
		t.Fatal(err)
	}

	evaluation, err := evaluateResponse(
		raw,
		json.RawMessage(`{"selected_option_indexes":[0,2]}`),
		87,
	)
	if err != nil {
		t.Fatal(err)
	}
	if evaluation.Mode != "correctness" ||
		evaluation.Correct == nil ||
		!*evaluation.Correct {
		t.Fatalf("expected an exact correct evaluation, got %#v", evaluation)
	}
	if evaluation.ScoreDelta != 87 {
		t.Fatalf("expected persisted score delta 87, got %d", evaluation.ScoreDelta)
	}

	evaluation, err = evaluateResponse(
		raw,
		json.RawMessage(`{"selected_option_indexes":[0,1]}`),
		12,
	)
	if err != nil {
		t.Fatal(err)
	}
	if evaluation.Correct == nil || *evaluation.Correct {
		t.Fatalf("expected an incorrect evaluation, got %#v", evaluation)
	}
}

func TestEvaluateUnscoredChoiceDoesNotInventCorrectness(t *testing.T) {
	definition := presentations.ActivityDefinition{
		SchemaVersion: presentations.ActivitySchemaVersion1,
		ActivityKind:  presentations.ActivityKindChoice,
		Prompt:        presentations.ActivityPrompt{Text: "Poll"},
		Response: presentations.ActivityResponsePolicy{
			Selection: presentations.ChoiceSelectionSingle,
			Options: []presentations.ChoiceOptionDefinition{
				{ID: "a", Text: "A", Order: 1},
				{ID: "b", Text: "B", Order: 2},
			},
		},
		Evaluation: presentations.ActivityEvaluationPolicy{
			Mode: presentations.EvaluationModeNone,
		},
		Scoring: presentations.ActivityScoringPolicy{
			Mode: presentations.ScoringModeNone,
		},
		Timing:  presentations.ActivityTimingPolicy{DurationSeconds: 30},
		Results: presentations.ActivityResultPolicy{},
	}
	raw, err := json.Marshal(definition)
	if err != nil {
		t.Fatal(err)
	}

	evaluation, err := evaluateResponse(
		raw,
		json.RawMessage(`{"selected_option_indexes":[1]}`),
		0,
	)
	if err != nil {
		t.Fatal(err)
	}
	if evaluation.Mode != "none" || evaluation.Correct != nil {
		t.Fatalf("expected no correctness judgment, got %#v", evaluation)
	}
}

func TestChoiceResultPayloadUsesFrozenOptionIDs(t *testing.T) {
	definition := presentations.ActivityDefinition{
		SchemaVersion: presentations.ActivitySchemaVersion1,
		ActivityKind:  presentations.ActivityKindChoice,
		Prompt:        presentations.ActivityPrompt{Text: "Poll"},
		Response: presentations.ActivityResponsePolicy{
			Selection: presentations.ChoiceSelectionMultiple,
			Options: []presentations.ChoiceOptionDefinition{
				{ID: "alpha", Text: "Alpha", Order: 1},
				{ID: "beta", Text: "Beta", Order: 2},
				{ID: "gamma", Text: "Gamma", Order: 3},
			},
		},
		Evaluation: presentations.ActivityEvaluationPolicy{
			Mode: presentations.EvaluationModeNone,
		},
		Scoring: presentations.ActivityScoringPolicy{
			Mode: presentations.ScoringModeNone,
		},
		Timing:  presentations.ActivityTimingPolicy{DurationSeconds: 30},
		Results: presentations.ActivityResultPolicy{},
	}

	payload, err := choiceResultPayload(
		definition,
		map[int]int{0: 2, 2: 5},
	)
	if err != nil {
		t.Fatal(err)
	}
	var decoded struct {
		OptionCounts map[string]int `json:"option_counts"`
	}
	if err := json.Unmarshal(payload, &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded.OptionCounts["alpha"] != 2 ||
		decoded.OptionCounts["beta"] != 0 ||
		decoded.OptionCounts["gamma"] != 5 {
		t.Fatalf("unexpected option counts: %#v", decoded.OptionCounts)
	}
}
