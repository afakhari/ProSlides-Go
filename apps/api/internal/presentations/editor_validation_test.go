package presentations

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestValidateSlideContentAcceptsCompleteQuestion(t *testing.T) {
	raw := json.RawMessage(`{"text":"Choose","question_type":"multiple","question_time":30,"min_point":0,"max_point":100,"faster_answers_more_points":true,"partial_scoring":true,"show_leaderboard_after":true,"image_url":"","options":[{"id":"a","text":"A","is_correct":true,"image_url":"","order":1},{"id":"b","text":"B","is_correct":false,"image_url":"","order":2}]}`)
	if err := validateSlideContent("question", raw); err != nil {
		t.Fatalf("complete question rejected: %v", err)
	}
}

func TestValidateSlideContentRejectsInvalidQuestionInvariants(t *testing.T) {
	valid := `{"text":"Choose","question_type":"single","question_time":30,"min_point":0,"max_point":100,"faster_answers_more_points":false,"partial_scoring":false,"show_leaderboard_after":false,"image_url":"","options":[{"id":"a","text":"A","is_correct":true,"image_url":"","order":1},{"id":"b","text":"B","is_correct":false,"image_url":"","order":2}]}`
	tests := []struct {
		name string
		raw  string
	}{
		{"unknown field", valid[:len(valid)-1] + `,"legacy":true}`},
		{"duplicate option id", `{"text":"Choose","question_type":"multiple","question_time":30,"min_point":0,"max_point":100,"faster_answers_more_points":false,"partial_scoring":false,"show_leaderboard_after":false,"options":[{"id":"same","text":"A","is_correct":true,"image_url":"","order":1},{"id":"same","text":"B","is_correct":false,"image_url":"","order":2}]}`},
		{"single partial scoring", `{"text":"Choose","question_type":"single","question_time":30,"min_point":0,"max_point":100,"faster_answers_more_points":false,"partial_scoring":true,"show_leaderboard_after":false,"options":[{"id":"a","text":"A","is_correct":true,"image_url":"","order":1},{"id":"b","text":"B","is_correct":false,"image_url":"","order":2}]}`},
		{"duplicate order", `{"text":"Choose","question_type":"multiple","question_time":30,"min_point":0,"max_point":100,"faster_answers_more_points":false,"partial_scoring":false,"show_leaderboard_after":false,"options":[{"id":"a","text":"A","is_correct":true,"image_url":"","order":1},{"id":"b","text":"B","is_correct":false,"image_url":"","order":1}]}`},
		{"no correct option", `{"text":"Choose","question_type":"multiple","question_time":30,"min_point":0,"max_point":100,"faster_answers_more_points":false,"partial_scoring":false,"show_leaderboard_after":false,"options":[{"id":"a","text":"A","is_correct":false,"image_url":"","order":1},{"id":"b","text":"B","is_correct":false,"image_url":"","order":2}]}`},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if err := validateSlideContent("question", json.RawMessage(test.raw)); err == nil {
				t.Fatal("invalid question accepted")
			}
		})
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

func TestReplaceSlideRejectsInvalidQuestionBeforeStore(t *testing.T) {
	m := http.NewServeMux()
	NewHTTP(fakeSessions{}, &fakeStore{}).Register(m)
	req := httptest.NewRequest(http.MethodPut, "/api/v1/presentations/p/slides/s", strings.NewReader(`{"position":0,"kind":"question","content":{"text":"incomplete"}}`))
	req.AddCookie(&http.Cookie{Name: "proslides_session", Value: "token"})
	req.Header.Set("X-CSRF-Token", "csrf")
	result := httptest.NewRecorder()
	m.ServeHTTP(result, req)
	if result.Code != 400 {
		t.Fatalf("status=%d", result.Code)
	}
}


func TestValidateQuestionLengthsCountUnicodeCharacters(t *testing.T) {
	makeQuestion := func(text, optionText string) json.RawMessage {
		value := map[string]any{
			"text":                         text,
			"question_type":                "single",
			"question_time":                30,
			"min_point":                    0,
			"max_point":                    100,
			"faster_answers_more_points":   false,
			"partial_scoring":              false,
			"show_leaderboard_after":       false,
			"image_url":                    "",
			"options": []map[string]any{
				{"id": "a", "text": optionText, "is_correct": true, "image_url": "", "order": 1},
				{"id": "b", "text": "گزینه دوم", "is_correct": false, "image_url": "", "order": 2},
			},
		}
		raw, err := json.Marshal(value)
		if err != nil {
			t.Fatal(err)
		}
		return raw
	}

	if err := validateSlideContent("question", makeQuestion(strings.Repeat("س", 10000), strings.Repeat("گ", 2000))); err != nil {
		t.Fatalf("unicode content at documented limits rejected: %v", err)
	}
	if err := validateSlideContent("question", makeQuestion(strings.Repeat("س", 10001), "گزینه")); err == nil {
		t.Fatal("question over documented character limit accepted")
	}
	if err := validateSlideContent("question", makeQuestion("پرسش", strings.Repeat("گ", 2001))); err == nil {
		t.Fatal("option over documented character limit accepted")
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
