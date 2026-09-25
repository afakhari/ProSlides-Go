package presentations

import (
	"encoding/json"
	"testing"
)

func TestNormalizeLegacyQuestionToChoiceActivity(t *testing.T) {
	legacy := json.RawMessage(`{
		"title":"Geography",
		"text":"Capital?",
		"question_type":"single",
		"question_time":30,
		"min_point":0,
		"max_point":100,
		"image_url":"",
		"faster_answers_more_points":true,
		"partial_scoring":false,
		"show_leaderboard_after":true,
		"options":[
			{"id":"a","text":"Tehran","is_correct":true,"image_url":"","order":1},
			{"id":"b","text":"Shiraz","is_correct":false,"image_url":"","order":2}
		]
	}`)

	kind, normalized, err := normalizeSlideDefinition("question", legacy)
	if err != nil {
		t.Fatalf("normalize legacy question: %v", err)
	}
	if kind != ItemKindActivity {
		t.Fatalf("kind = %q, want %q", kind, ItemKindActivity)
	}

	var activity ActivityDefinition
	if err := json.Unmarshal(normalized, &activity); err != nil {
		t.Fatalf("decode activity: %v", err)
	}
	if activity.SchemaVersion != 1 || activity.ActivityKind != ActivityKindChoice {
		t.Fatalf("unexpected activity identity: %#v", activity)
	}
	if activity.Response.Selection != ChoiceSelectionSingle {
		t.Fatalf("selection = %q", activity.Response.Selection)
	}
	if activity.Evaluation.Mode != EvaluationModeCorrectness ||
		len(activity.Evaluation.CorrectOptionIDs) != 1 ||
		activity.Evaluation.CorrectOptionIDs[0] != "a" {
		t.Fatalf("unexpected evaluation: %#v", activity.Evaluation)
	}
	if activity.Scoring.Mode != ScoringModePoints ||
		!activity.Scoring.SpeedBonus ||
		activity.Scoring.PartialCredit {
		t.Fatalf("unexpected scoring: %#v", activity.Scoring)
	}
	if !activity.Results.ShowOverallLeaderboardAfter {
		t.Fatal("legacy show_leaderboard_after was not preserved")
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
