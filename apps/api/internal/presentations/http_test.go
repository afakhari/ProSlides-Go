package presentations

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/proslides/proslides/internal/identity"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type fakeSessions struct{ err error }

func (f fakeSessions) Current(context.Context, string) (identity.StoredSession, error) {
	if f.err != nil {
		return identity.StoredSession{}, f.err
	}
	return identity.StoredSession{User: identity.User{ID: "owner"}}, nil
}
func (f fakeSessions) Authorize(context.Context, string, string) (identity.User, error) {
	if f.err != nil {
		return identity.User{}, f.err
	}
	return identity.User{ID: "owner"}, nil
}

type fakeStore struct {
	p                Presentation
	err              error
	owner            string
	accessCode       string
	expectedRevision *int64
	slideKind         string
	slideContent      json.RawMessage
}

func (f *fakeStore) FindOwned(_ context.Context, _ string, owner string) (Presentation, error) {
	f.owner = owner
	return f.p, f.err
}
func (f *fakeStore) ListOwned(_ context.Context, owner string) ([]PresentationSummary, error) {
	f.owner = owner
	return []PresentationSummary{}, f.err
}
func (f *fakeStore) Create(_ context.Context, owner, title string, _ json.RawMessage) (Presentation, error) {
	f.owner = owner
	return Presentation{ID: "new", Title: title, Slides: []Slide{}}, f.err
}
func (f *fakeStore) Update(_ context.Context, _, owner string, patch PresentationPatch) (Presentation, error) {
	f.owner = owner
	f.expectedRevision = patch.ExpectedRevision
	title := f.p.Title
	if patch.Title != nil {
		title = *patch.Title
	}
	return Presentation{ID: "p", Title: title, Settings: patch.Settings, Slides: []Slide{}}, f.err
}
func (f *fakeStore) SetAccessCode(_ context.Context, _, owner, code string) (AccessCodeResult, error) {
	f.owner = owner
	f.accessCode = code
	return AccessCodeResult{AccessCode: code}, f.err
}
func (f *fakeStore) Delete(_ context.Context, _, owner string) error { f.owner = owner; return f.err }
func (f *fakeStore) Duplicate(_ context.Context, _, owner, title string) (Presentation, error) {
	f.owner = owner
	return Presentation{ID: "copy", Title: title, Slides: []Slide{}}, f.err
}
func (f *fakeStore) LatestSession(_ context.Context, _, owner string) (SessionLocator, error) {
	f.owner = owner
	return SessionLocator{SessionID: "session", PresentationID: "p"}, f.err
}
func (f *fakeStore) DeleteResults(_ context.Context, _, owner string) error {
	f.owner = owner
	return f.err
}
func (f *fakeStore) QuestionResults(_ context.Context, _, sessionID, slideID, owner string, query QuestionResultsQuery) (QuestionResultsPage, error) {
	f.owner = owner
	return QuestionResultsPage{SessionID: sessionID, QuestionSlideID: slideID, Options: []QuestionOptionResult{}, Leaderboard: []QuestionLeaderboardEntry{}, Limit: query.Limit}, f.err
}
func (f *fakeStore) CreateSlide(_ context.Context, _ string, owner string, position int, kind string, content json.RawMessage, expected *int64) (Slide, error) {
	f.owner = owner
	f.expectedRevision = expected
	f.slideKind = kind
	f.slideContent = append(json.RawMessage(nil), content...)
	return Slide{ID: "slide", Position: position, Kind: kind, Content: content}, f.err
}
func (f *fakeStore) ReplaceSlide(_ context.Context, _, _, owner string, position int, kind string, content json.RawMessage, expected *int64) (Slide, error) {
	f.owner = owner
	f.expectedRevision = expected
	f.slideKind = kind
	f.slideContent = append(json.RawMessage(nil), content...)
	return Slide{ID: "slide", Position: position, Kind: kind, Content: content}, f.err
}
func (f *fakeStore) DeleteSlide(_ context.Context, _, _, owner string, _ *int64) error {
	f.owner = owner
	return f.err
}
func (f *fakeStore) ReorderSlides(_ context.Context, _, owner string, _ []string, _ *int64) error {
	f.owner = owner
	return f.err
}
func TestGetPresentationRequiresSession(t *testing.T) {
	m := http.NewServeMux()
	NewHTTP(fakeSessions{}, &fakeStore{}).Register(m)
	r := httptest.NewRecorder()
	m.ServeHTTP(r, httptest.NewRequest(http.MethodGet, "/api/v1/presentations/x", nil))
	if r.Code != 401 {
		t.Fatalf("status=%d", r.Code)
	}
}
func TestGetPresentationReturnsOwnedSlides(t *testing.T) {
	m := http.NewServeMux()
	s := &fakeStore{p: Presentation{ID: "p", Title: "Demo", Slides: []Slide{{ID: "s", Position: 0, Kind: "content", Content: []byte(`{"text":"hello"}`)}}}}
	NewHTTP(fakeSessions{}, s).Register(m)
	q := httptest.NewRequest(http.MethodGet, "/api/v1/presentations/p", nil)
	q.AddCookie(&http.Cookie{Name: "proslides_session", Value: "token"})
	r := httptest.NewRecorder()
	m.ServeHTTP(r, q)
	if r.Code != 200 || s.owner != "owner" {
		t.Fatalf("status=%d owner=%s", r.Code, s.owner)
	}
}
func TestGetPresentationHidesMissingAndUnauthorized(t *testing.T) {
	m := http.NewServeMux()
	NewHTTP(fakeSessions{}, &fakeStore{err: ErrNotFound}).Register(m)
	q := httptest.NewRequest(http.MethodGet, "/api/v1/presentations/p", nil)
	q.AddCookie(&http.Cookie{Name: "proslides_session", Value: "token"})
	r := httptest.NewRecorder()
	m.ServeHTTP(r, q)
	if r.Code != 404 {
		t.Fatalf("status=%d", r.Code)
	}
	_ = errors.New
}

func TestSetAccessCodeNormalizesAndValidates(t *testing.T) {
	store := &fakeStore{}
	mux := http.NewServeMux()
	NewHTTP(fakeSessions{}, store).Register(mux)

	request := httptest.NewRequest(http.MethodPut, "/api/v1/presentations/p/access-code", strings.NewReader(`{"access_code":" quiz42 "}`))
	request.AddCookie(&http.Cookie{Name: "proslides_session", Value: "token"})
	request.Header.Set("X-CSRF-Token", "csrf")
	response := httptest.NewRecorder()
	mux.ServeHTTP(response, request)
	if response.Code != http.StatusOK || store.owner != "owner" || store.accessCode != "QUIZ42" || !strings.Contains(response.Body.String(), `"access_code":"QUIZ42"`) {
		t.Fatalf("response=%d %s owner=%s code=%s", response.Code, response.Body.String(), store.owner, store.accessCode)
	}

	invalid := httptest.NewRequest(http.MethodPut, "/api/v1/presentations/p/access-code", strings.NewReader(`{"access_code":"bad-code"}`))
	invalid.AddCookie(&http.Cookie{Name: "proslides_session", Value: "token"})
	invalid.Header.Set("X-CSRF-Token", "csrf")
	invalidResponse := httptest.NewRecorder()
	mux.ServeHTTP(invalidResponse, invalid)
	if invalidResponse.Code != http.StatusBadRequest {
		t.Fatalf("invalid status=%d body=%s", invalidResponse.Code, invalidResponse.Body.String())
	}

	store.err = ErrAccessCodeTaken
	conflict := httptest.NewRequest(http.MethodPut, "/api/v1/presentations/p/access-code", strings.NewReader(`{"access_code":"TAKEN1"}`))
	conflict.AddCookie(&http.Cookie{Name: "proslides_session", Value: "token"})
	conflict.Header.Set("X-CSRF-Token", "csrf")
	conflictResponse := httptest.NewRecorder()
	mux.ServeHTTP(conflictResponse, conflict)
	if conflictResponse.Code != http.StatusConflict || !strings.Contains(conflictResponse.Body.String(), "access_code_taken") {
		t.Fatalf("conflict=%d %s", conflictResponse.Code, conflictResponse.Body.String())
	}
}

func TestCreateSlideRequiresCSRFAndCreatesForOwner(t *testing.T) {
	m := http.NewServeMux()
	store := &fakeStore{}
	NewHTTP(fakeSessions{}, store).Register(m)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/presentations/p/slides", strings.NewReader(`{"position":0,"kind":"content","content":{"text":"hello"}}`))
	req.AddCookie(&http.Cookie{Name: "proslides_session", Value: "token"})
	req.Header.Set("X-CSRF-Token", "csrf")
	res := httptest.NewRecorder()
	m.ServeHTTP(res, req)
	if res.Code != http.StatusCreated || store.owner != "owner" {
		t.Fatalf("status=%d owner=%s", res.Code, store.owner)
	}
}
func TestCreateMultipleQuestionStoresV2ChoiceActivity(t *testing.T) {
	m := http.NewServeMux()
	store := &fakeStore{}
	NewHTTP(fakeSessions{}, store).Register(m)
	q := httptest.NewRequest(http.MethodPost, "/api/v1/presentations/p/questions", strings.NewReader(`{"position":1,"text":"Choose","question_type":"multiple","options":[{"text":"A","is_correct":true},{"text":"B","is_correct":true}]}`))
	q.AddCookie(&http.Cookie{Name: "proslides_session", Value: "t"})
	q.Header.Set("X-CSRF-Token", "c")
	r := httptest.NewRecorder()
	m.ServeHTTP(r, q)
	if r.Code != http.StatusCreated {
		t.Fatalf("status=%d body=%s", r.Code, r.Body.String())
	}
	if store.slideKind != ItemKindActivity {
		t.Fatalf("kind=%q, want %q", store.slideKind, ItemKindActivity)
	}
	var activity ActivityDefinition
	if err := json.Unmarshal(store.slideContent, &activity); err != nil {
		t.Fatalf("decode stored activity: %v", err)
	}
	if activity.ActivityKind != ActivityKindChoice ||
		activity.Response.Selection != ChoiceSelectionMultiple ||
		activity.Evaluation.Mode != EvaluationModeCorrectness ||
		activity.Scoring.Mode != ScoringModePoints {
		t.Fatalf("unexpected stored activity: %#v", activity)
	}
	if len(activity.Response.Options) != 2 ||
		activity.Response.Options[0].ID != "option-1" ||
		activity.Response.Options[1].ID != "option-2" {
		t.Fatalf("legacy endpoint did not assign stable option ids: %#v", activity.Response.Options)
	}
}

func TestGenericSlideEndpointNormalizesLegacyQuestionToV2Activity(t *testing.T) {
	m := http.NewServeMux()
	store := &fakeStore{}
	NewHTTP(fakeSessions{}, store).Register(m)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/presentations/p/slides", strings.NewReader(`{
		"position":0,
		"kind":"question",
		"content":{
			"title":"",
			"text":"Choose",
			"question_type":"single",
			"question_time":30,
			"min_point":0,
			"max_point":100,
			"image_url":"",
			"faster_answers_more_points":false,
			"partial_scoring":false,
			"show_leaderboard_after":true,
			"options":[
				{"id":"a","text":"A","is_correct":true,"image_url":"","order":1},
				{"id":"b","text":"B","is_correct":false,"image_url":"","order":2}
			]
		}
	}`))
	req.AddCookie(&http.Cookie{Name: "proslides_session", Value: "token"})
	req.Header.Set("X-CSRF-Token", "csrf")
	result := httptest.NewRecorder()
	m.ServeHTTP(result, req)
	if result.Code != http.StatusCreated {
		t.Fatalf("status=%d body=%s", result.Code, result.Body.String())
	}
	if store.slideKind != ItemKindActivity {
		t.Fatalf("legacy question persisted as %q", store.slideKind)
	}
	var activity ActivityDefinition
	if err := json.Unmarshal(store.slideContent, &activity); err != nil {
		t.Fatal(err)
	}
	if !activity.Results.ShowOverallLeaderboardAfter {
		t.Fatal("leaderboard behavior was not migrated")
	}
}

func TestGenericSlideEndpointAcceptsCanonicalChoiceActivity(t *testing.T) {
	m := http.NewServeMux()
	store := &fakeStore{}
	NewHTTP(fakeSessions{}, store).Register(m)
	body := `{
		"position":0,
		"kind":"activity",
		"content":{
			"schema_version":1,
			"activity_kind":"choice",
			"prompt":{"title":"","text":"Choose","image_url":""},
			"response":{"selection":"single","options":[
				{"id":"a","text":"A","image_url":"","order":1},
				{"id":"b","text":"B","image_url":"","order":2}
			]},
			"evaluation":{"mode":"correctness","correct_option_ids":["a"]},
			"scoring":{"mode":"points","min_points":0,"max_points":100,"speed_bonus":false,"partial_credit":false},
			"timing":{"duration_seconds":30},
			"results":{"show_overall_leaderboard_after":false}
		}
	}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/presentations/p/slides", strings.NewReader(body))
	req.AddCookie(&http.Cookie{Name: "proslides_session", Value: "token"})
	req.Header.Set("X-CSRF-Token", "csrf")
	result := httptest.NewRecorder()
	m.ServeHTTP(result, req)
	if result.Code != http.StatusCreated {
		t.Fatalf("status=%d body=%s", result.Code, result.Body.String())
	}
	if store.slideKind != ItemKindActivity {
		t.Fatalf("kind=%q", store.slideKind)
	}
}

func TestListPresentationsRequiresSession(t *testing.T) {
	m := http.NewServeMux()
	NewHTTP(fakeSessions{}, &fakeStore{}).Register(m)
	r := httptest.NewRecorder()
	m.ServeHTTP(r, httptest.NewRequest(http.MethodGet, "/api/v1/presentations", nil))
	if r.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d", r.Code)
	}
}

func TestUpdatePresentationAndReplaceSlideAreOwnerScoped(t *testing.T) {
	m := http.NewServeMux()
	store := &fakeStore{}
	NewHTTP(fakeSessions{}, store).Register(m)

	update := httptest.NewRequest(http.MethodPatch, "/api/v1/presentations/p", strings.NewReader(`{"title":"Renamed","settings":{"background_color":"#112233"}}`))
	update.AddCookie(&http.Cookie{Name: "proslides_session", Value: "token"})
	update.Header.Set("X-CSRF-Token", "csrf")
	update.Header.Set("If-Match", "7")
	updateResult := httptest.NewRecorder()
	m.ServeHTTP(updateResult, update)
	if updateResult.Code != http.StatusOK || store.owner != "owner" || store.expectedRevision == nil || *store.expectedRevision != 7 {
		t.Fatalf("status=%d owner=%s", updateResult.Code, store.owner)
	}

	replace := httptest.NewRequest(http.MethodPut, "/api/v1/presentations/p/slides/s", strings.NewReader(`{"position":0,"kind":"content","content":{"text":"updated"}}`))
	replace.AddCookie(&http.Cookie{Name: "proslides_session", Value: "token"})
	replace.Header.Set("X-CSRF-Token", "csrf")
	replace.Header.Set("If-Match", "3")
	replaceResult := httptest.NewRecorder()
	m.ServeHTTP(replaceResult, replace)
	if replaceResult.Code != http.StatusOK || store.owner != "owner" || store.expectedRevision == nil || *store.expectedRevision != 3 {
		t.Fatalf("status=%d owner=%s", replaceResult.Code, store.owner)
	}
}

func TestEditConflictAndInvalidRevisionHaveStableErrors(t *testing.T) {
	for _, testCase := range []struct {
		name     string
		header   string
		storeErr error
		status   int
		body     string
	}{
		{"stale", "4", ErrEditConflict, http.StatusConflict, `"edit_conflict"`},
		{"malformed", "not-a-number", nil, http.StatusBadRequest, `"invalid_revision"`},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			m := http.NewServeMux()
			NewHTTP(fakeSessions{}, &fakeStore{err: testCase.storeErr}).Register(m)
			req := httptest.NewRequest(http.MethodPatch, "/api/v1/presentations/p", strings.NewReader(`{"title":"Renamed"}`))
			req.AddCookie(&http.Cookie{Name: "proslides_session", Value: "token"})
			req.Header.Set("X-CSRF-Token", "csrf")
			req.Header.Set("If-Match", testCase.header)
			result := httptest.NewRecorder()
			m.ServeHTTP(result, req)
			if result.Code != testCase.status || !strings.Contains(result.Body.String(), testCase.body) {
				t.Fatalf("status=%d body=%s", result.Code, result.Body.String())
			}
		})
	}
}

func TestReorderRejectsDuplicateSlideIDs(t *testing.T) {
	m := http.NewServeMux()
	NewHTTP(fakeSessions{}, &fakeStore{}).Register(m)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/presentations/p/slides/reorder", strings.NewReader(`{"slide_ids":["same","same"]}`))
	req.AddCookie(&http.Cookie{Name: "proslides_session", Value: "token"})
	req.Header.Set("X-CSRF-Token", "csrf")
	result := httptest.NewRecorder()
	m.ServeHTTP(result, req)
	if result.Code != http.StatusBadRequest {
		t.Fatalf("status=%d", result.Code)
	}
}

func TestPresentationAndSlideJSONFieldsRejectNull(t *testing.T) {
	m := http.NewServeMux()
	NewHTTP(fakeSessions{}, &fakeStore{}).Register(m)
	for _, testCase := range []struct {
		method string
		path   string
		body   string
	}{
		{http.MethodPatch, "/api/v1/presentations/p", `{"settings":null}`},
		{http.MethodPost, "/api/v1/presentations/p/slides", `{"position":0,"kind":"content","content":null}`},
	} {
		req := httptest.NewRequest(testCase.method, testCase.path, strings.NewReader(testCase.body))
		req.AddCookie(&http.Cookie{Name: "proslides_session", Value: "token"})
		req.Header.Set("X-CSRF-Token", "csrf")
		result := httptest.NewRecorder()
		m.ServeHTTP(result, req)
		if result.Code != http.StatusBadRequest {
			t.Fatalf("%s %s status=%d", testCase.method, testCase.path, result.Code)
		}
	}
}

func TestQuestionResultsAreOwnerScopedAndBounded(t *testing.T) {
	m := http.NewServeMux()
	store := &fakeStore{}
	NewHTTP(fakeSessions{}, store).Register(m)
	unauthorized := httptest.NewRecorder()
	m.ServeHTTP(unauthorized, httptest.NewRequest(http.MethodGet, "/api/v1/presentations/p/sessions/s/questions/q/results", nil))
	if unauthorized.Code != http.StatusUnauthorized {
		t.Fatalf("unauthorized status=%d", unauthorized.Code)
	}
	req := httptest.NewRequest(http.MethodGet, "/api/v1/presentations/p/sessions/s/questions/q/results?limit=100", nil)
	req.AddCookie(&http.Cookie{Name: "proslides_session", Value: "token"})
	result := httptest.NewRecorder()
	m.ServeHTTP(result, req)
	if result.Code != http.StatusOK || store.owner != "owner" || strings.Contains(result.Body.String(), "password") || strings.Contains(result.Body.String(), "token") {
		t.Fatalf("status=%d owner=%q body=%s", result.Code, store.owner, result.Body.String())
	}
	bad := httptest.NewRequest(http.MethodGet, "/api/v1/presentations/p/sessions/s/questions/q/results?limit=101", nil)
	bad.AddCookie(&http.Cookie{Name: "proslides_session", Value: "token"})
	badResult := httptest.NewRecorder()
	m.ServeHTTP(badResult, bad)
	if badResult.Code != http.StatusBadRequest {
		t.Fatalf("bad limit status=%d", badResult.Code)
	}
}


func TestUpdatePresentationRejectsInvalidKnownSettings(t *testing.T) {
	m := http.NewServeMux()
	store := &fakeStore{}
	NewHTTP(fakeSessions{}, store).Register(m)

	for _, body := range []string{
		`{"settings":{"background_color":"#fff"}}`,
		`{"settings":{"text_color":"white"}}`,
		`{"settings":{"background_image_url":"javascript:alert(1)"}}`,
		`{"settings":{"music_url":"javascript:alert(1)"}}`,
	} {
		request := httptest.NewRequest(http.MethodPatch, "/api/v1/presentations/p", strings.NewReader(body))
		request.AddCookie(&http.Cookie{Name: "proslides_session", Value: "token"})
		request.Header.Set("X-CSRF-Token", "csrf")
		request.Header.Set("If-Match", "7")

		result := httptest.NewRecorder()
		m.ServeHTTP(result, request)

		if result.Code != http.StatusBadRequest {
			t.Fatalf("body=%s status=%d", body, result.Code)
		}
	}
}
