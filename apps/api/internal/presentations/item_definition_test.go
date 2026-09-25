package presentations

import (
	"encoding/json"
	"testing"
)

func TestLegacyQuestionDefinitionIsRejected(t *testing.T) {
	raw := json.RawMessage(`{"text":"Choose"}`)
	if _, _, err := normalizeSlideDefinition("question", raw); err == nil {
		t.Fatal("legacy question definition should be rejected")
	}
}

func TestLegacyLeaderboardDefinitionIsRejected(t *testing.T) {
	raw := json.RawMessage(`{"title":"Leaderboard"}`)
	if _, _, err := normalizeSlideDefinition("leaderboard", raw); err == nil {
		t.Fatal("legacy leaderboard definition should be rejected")
	}
}

func TestChoiceActivityRemainsCanonicalForLive(t *testing.T) {
	activity := ActivityDefinition{
		SchemaVersion: 1,
		ActivityKind:  ActivityKindChoice,
		Prompt: ActivityPrompt{
			Title: "Quiz",
			Text:  "Pick two",
		},
		Response: ChoiceResponsePolicy{
			Selection: ChoiceSelectionMultiple,
			Options: []ChoiceOptionDefinition{
				{ID: "a", Text: "A", Order: 1},
				{ID: "b", Text: "B", Order: 2},
				{ID: "c", Text: "C", Order: 3},
			},
		},
		Evaluation: ChoiceEvaluationPolicy{
			Mode:             EvaluationModeCorrectness,
			CorrectOptionIDs: []string{"a", "c"},
		},
		Scoring: ChoiceScoringPolicy{
			Mode:          ScoringModePoints,
			MinPoints:     10,
			MaxPoints:     100,
			PartialCredit: true,
		},
		Timing:  ActivityTimingPolicy{DurationSeconds: 45},
		Results: ActivityResultPolicy{ShowOverallLeaderboardAfter: true},
	}
	raw, err := json.Marshal(activity)
	if err != nil {
		t.Fatal(err)
	}

	kind, normalized, err := normalizeSlideDefinition(ItemKindActivity, raw)
	if err != nil {
		t.Fatalf("normalize activity definition: %v", err)
	}
	if kind != ItemKindActivity {
		t.Fatalf("kind = %q, want %q", kind, ItemKindActivity)
	}

	decoded, err := DecodeActivityDefinition(normalized)
	if err != nil {
		t.Fatalf("decode normalized activity: %v", err)
	}
	if decoded.ActivityKind != ActivityKindChoice ||
		decoded.Response.Selection != ChoiceSelectionMultiple ||
		decoded.Timing.DurationSeconds != 45 ||
		decoded.Scoring.MinPoints != 10 ||
		decoded.Scoring.MaxPoints != 100 ||
		!decoded.Scoring.PartialCredit ||
		!decoded.Results.ShowOverallLeaderboardAfter {
		t.Fatalf("canonical Activity semantics changed: %#v", decoded)
	}
}

func TestChoiceActivityModelSupportsUnscoredChoiceWithoutQuizFields(t *testing.T) {
	activity := ActivityDefinition{
		SchemaVersion: 1,
		ActivityKind:  ActivityKindChoice,
		Prompt:        ActivityPrompt{Text: "Which direction?"},
		Response: ChoiceResponsePolicy{
			Selection: ChoiceSelectionSingle,
			Options: []ChoiceOptionDefinition{
				{ID: "a", Text: "North", Order: 1},
				{ID: "b", Text: "South", Order: 2},
			},
		},
		Evaluation: ChoiceEvaluationPolicy{
			Mode:             EvaluationModeNone,
			CorrectOptionIDs: []string{},
		},
		Scoring: ChoiceScoringPolicy{
			Mode: ScoringModeNone,
		},
		Timing: ActivityTimingPolicy{DurationSeconds: 30},
		Results: ActivityResultPolicy{
			ShowOverallLeaderboardAfter: false,
		},
	}
	if err := validateActivityDefinition(activity); err != nil {
		t.Fatalf("unscored choice definition should be valid: %v", err)
	}
}

func TestPollNormalizesAsCanonicalUnscoredChoice(t *testing.T) {
	activity := ActivityDefinition{
		SchemaVersion: ActivitySchemaVersion1,
		ActivityKind:  ActivityKindChoice,
		Prompt:        ActivityPrompt{Text: "Which topic next?"},
		Response: ChoiceResponsePolicy{
			Selection: ChoiceSelectionSingle,
			Options: []ChoiceOptionDefinition{
				{ID: "architecture", Text: "Architecture", Order: 1},
				{ID: "testing", Text: "Testing", Order: 2},
			},
		},
		Evaluation: ChoiceEvaluationPolicy{
			Mode:             EvaluationModeNone,
			CorrectOptionIDs: []string{},
		},
		Scoring: ChoiceScoringPolicy{Mode: ScoringModeNone},
		Timing:  ActivityTimingPolicy{DurationSeconds: 20},
		Results: ActivityResultPolicy{ShowOverallLeaderboardAfter: false},
	}
	raw, err := json.Marshal(activity)
	if err != nil {
		t.Fatal(err)
	}

	kind, normalized, err := normalizeSlideDefinition(ItemKindActivity, raw)
	if err != nil {
		t.Fatalf("normalize Poll: %v", err)
	}
	if kind != ItemKindActivity {
		t.Fatalf("kind = %q, want %q", kind, ItemKindActivity)
	}

	decoded, err := DecodeActivityDefinition(normalized)
	if err != nil {
		t.Fatalf("decode normalized Poll: %v", err)
	}
	if decoded.ActivityKind != ActivityKindChoice ||
		decoded.Response.Selection != ChoiceSelectionSingle ||
		decoded.Evaluation.Mode != EvaluationModeNone ||
		decoded.Scoring.Mode != ScoringModeNone ||
		decoded.Results.ShowOverallLeaderboardAfter {
		t.Fatalf("Poll policy changed during normalization: %#v", decoded)
	}
	var pollJSON map[string]any
	if err := json.Unmarshal(normalized, &pollJSON); err != nil {
		t.Fatal(err)
	}
	evaluationJSON := pollJSON["evaluation"].(map[string]any)
	scoringJSON := pollJSON["scoring"].(map[string]any)
	if _, ok := evaluationJSON["correct_option_ids"]; !ok {
		t.Fatal("normalized Choice must retain required correct_option_ids")
	}
	for _, key := range []string{"min_points", "max_points", "speed_bonus", "partial_credit"} {
		if _, ok := scoringJSON[key]; !ok {
			t.Fatalf("normalized Choice scoring missing required %s", key)
		}
	}
	for _, option := range decoded.Response.Options {
		for _, correctID := range decoded.Evaluation.CorrectOptionIDs {
			if option.ID == correctID {
				t.Fatalf("Poll unexpectedly gained a correct option: %s", option.ID)
			}
		}
	}
}

func TestWordCloudTextActivityNormalizesAsCanonicalText(t *testing.T) {
	activity := ActivityDefinition{
		SchemaVersion: ActivitySchemaVersion1,
		ActivityKind:  ActivityKindText,
		Prompt: ActivityPrompt{
			Title: "نظر جمع",
			Text:  "این جلسه را با چه واژه‌هایی توصیف می‌کنید؟",
		},
		Response: ActivityResponsePolicy{
			MaxLength: 80,
			MaxWords:  3,
		},
		Evaluation: ActivityEvaluationPolicy{Mode: EvaluationModeNone},
		Scoring:    ActivityScoringPolicy{Mode: ScoringModeNone},
		Timing:     ActivityTimingPolicy{DurationSeconds: 30},
		Results: ActivityResultPolicy{
			Aggregation: TextAggregationWordFrequency,
		},
	}
	raw, err := json.Marshal(activity)
	if err != nil {
		t.Fatal(err)
	}

	kind, normalized, err := normalizeSlideDefinition(ItemKindActivity, raw)
	if err != nil {
		t.Fatalf("normalize Word Cloud: %v", err)
	}
	if kind != ItemKindActivity {
		t.Fatalf("kind = %q, want %q", kind, ItemKindActivity)
	}
	decoded, err := DecodeActivityDefinition(normalized)
	if err != nil {
		t.Fatalf("decode normalized Word Cloud: %v", err)
	}
	if decoded.ActivityKind != ActivityKindText ||
		decoded.Response.MaxLength != 80 ||
		decoded.Response.MaxWords != 3 ||
		decoded.Results.Aggregation != TextAggregationWordFrequency ||
		decoded.Evaluation.Mode != EvaluationModeNone ||
		decoded.Scoring.Mode != ScoringModeNone ||
		decoded.Results.ShowOverallLeaderboardAfter {
		t.Fatalf("Word Cloud policy changed during normalization: %#v", decoded)
	}
	var textJSON map[string]any
	if err := json.Unmarshal(normalized, &textJSON); err != nil {
		t.Fatal(err)
	}
	if _, ok := textJSON["evaluation"].(map[string]any)["correct_option_ids"]; ok {
		t.Fatal("normalized Text evaluation leaked Choice-only fields")
	}
	if _, ok := textJSON["scoring"].(map[string]any)["max_points"]; ok {
		t.Fatal("normalized Text scoring leaked Choice-only fields")
	}
	responseJSON := textJSON["response"].(map[string]any)
	if responseJSON["max_length"] != float64(80) || responseJSON["max_words"] != float64(3) {
		t.Fatalf("normalized Text response = %#v", responseJSON)
	}
}

func TestTextActivityRejectsScoringAndLeaderboardPolicy(t *testing.T) {
	base := ActivityDefinition{
		SchemaVersion: ActivitySchemaVersion1,
		ActivityKind:  ActivityKindText,
		Prompt:        ActivityPrompt{Text: "یک واژه بنویسید"},
		Response: ActivityResponsePolicy{
			MaxLength: 80,
			MaxWords:  3,
		},
		Evaluation: ActivityEvaluationPolicy{Mode: EvaluationModeNone},
		Scoring:    ActivityScoringPolicy{Mode: ScoringModeNone},
		Timing:     ActivityTimingPolicy{DurationSeconds: 30},
		Results: ActivityResultPolicy{
			Aggregation: TextAggregationWordFrequency,
		},
	}

	scored := base
	scored.Scoring = ActivityScoringPolicy{Mode: ScoringModePoints, MaxPoints: 100}
	if err := validateActivityDefinition(scored); err == nil {
		t.Fatal("Text Activity unexpectedly accepted scoring")
	}

	ranked := base
	ranked.Results.ShowOverallLeaderboardAfter = true
	if err := validateActivityDefinition(ranked); err == nil {
		t.Fatal("Text Activity unexpectedly accepted overall leaderboard")
	}
}

func TestUnscoredChoiceCannotRequestOverallLeaderboard(t *testing.T) {
	activity := ActivityDefinition{
		SchemaVersion: 1,
		ActivityKind:  ActivityKindChoice,
		Prompt:        ActivityPrompt{Text: "Poll"},
		Response: ChoiceResponsePolicy{
			Selection: ChoiceSelectionSingle,
			Options: []ChoiceOptionDefinition{
				{ID: "a", Text: "A", Order: 1},
				{ID: "b", Text: "B", Order: 2},
			},
		},
		Evaluation: ChoiceEvaluationPolicy{
			Mode:             EvaluationModeNone,
			CorrectOptionIDs: []string{},
		},
		Scoring: ChoiceScoringPolicy{Mode: ScoringModeNone},
		Timing:  ActivityTimingPolicy{DurationSeconds: 30},
		Results: ActivityResultPolicy{ShowOverallLeaderboardAfter: true},
	}
	if err := validateActivityDefinition(activity); err == nil {
		t.Fatal("unscored activity requested an overall leaderboard")
	}
}

func TestChoiceActivityRejectsInvalidCrossPolicyCombinations(t *testing.T) {
	base := ActivityDefinition{
		SchemaVersion: 1,
		ActivityKind:  ActivityKindChoice,
		Prompt:        ActivityPrompt{Text: "Question"},
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
		Timing: ActivityTimingPolicy{DurationSeconds: 30},
	}

	cases := []ActivityDefinition{
		func() ActivityDefinition {
			value := base
			value.SchemaVersion = 2
			return value
		}(),
		func() ActivityDefinition {
			value := base
			value.Evaluation.CorrectOptionIDs = []string{"missing"}
			return value
		}(),
		func() ActivityDefinition {
			value := base
			value.Scoring.PartialCredit = true
			return value
		}(),
		func() ActivityDefinition {
			value := base
			value.Scoring.Mode = ScoringModeNone
			value.Scoring.MaxPoints = 100
			return value
		}(),
	}

	for index, value := range cases {
		if err := validateActivityDefinition(value); err == nil {
			t.Fatalf("case %d unexpectedly valid", index)
		}
	}
}

func TestActivityDefinitionRejectsUnknownFields(t *testing.T) {
	raw := json.RawMessage(`{
		"schema_version":1,
		"activity_kind":"choice",
		"prompt":{"title":"","text":"Question","image_url":""},
		"response":{"selection":"single","options":[{"id":"a","text":"A","image_url":"","order":1},{"id":"b","text":"B","image_url":"","order":2}]},
		"evaluation":{"mode":"correctness","correct_option_ids":["a"]},
		"scoring":{"mode":"points","min_points":0,"max_points":100,"speed_bonus":false,"partial_credit":false},
		"timing":{"duration_seconds":30},
		"results":{"show_overall_leaderboard_after":false},
		"surprise":true
	}`)
	if _, _, err := normalizeSlideDefinition(ItemKindActivity, raw); err == nil {
		t.Fatal("unknown top-level field should be rejected")
	}
}
