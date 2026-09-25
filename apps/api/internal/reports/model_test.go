package reports

import (
	"encoding/json"
	"testing"
)

func TestEvaluateChoiceResponseUsesFrozenDefinition(t *testing.T) {
	definition := json.RawMessage(`{
		"activity_kind":"choice",
		"response":{"options":[{"id":"a"},{"id":"b"},{"id":"c"}]},
		"evaluation":{"mode":"correctness","correct_option_ids":["a","c"]}
	}`)

	evaluation, err := evaluateResponse(
		definition,
		json.RawMessage(`{"selected_option_indexes":[0,2]}`),
		87,
	)
	if err != nil {
		t.Fatal(err)
	}
	if evaluation.Mode != "correctness" || evaluation.Correct == nil || !*evaluation.Correct {
		t.Fatalf("expected an exact correct evaluation, got %#v", evaluation)
	}
	if evaluation.ScoreDelta != 87 {
		t.Fatalf("expected persisted score delta 87, got %d", evaluation.ScoreDelta)
	}

	evaluation, err = evaluateResponse(
		definition,
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
	definition := json.RawMessage(`{
		"activity_kind":"choice",
		"response":{"options":[{"id":"a"},{"id":"b"}]},
		"evaluation":{"mode":"none","correct_option_ids":[]}
	}`)

	evaluation, err := evaluateResponse(
		definition,
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

func TestAggregateChoiceCountsUsesFrozenOptionIDs(t *testing.T) {
	definition := json.RawMessage(`{
		"activity_kind":"choice",
		"response":{"options":[{"id":"alpha"},{"id":"beta"},{"id":"gamma"}]},
		"evaluation":{"mode":"none","correct_option_ids":[]}
	}`)

	counts, err := aggregateChoiceCounts(definition, map[int]int{0: 2, 2: 5})
	if err != nil {
		t.Fatal(err)
	}
	if counts["alpha"] != 2 || counts["beta"] != 0 || counts["gamma"] != 5 {
		t.Fatalf("unexpected option counts: %#v", counts)
	}
}
