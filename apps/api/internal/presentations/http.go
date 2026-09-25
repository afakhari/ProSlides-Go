package presentations

import (
	"context"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/proslides/proslides/internal/identity"
)

const maxContentBytes = 2 << 20

type SessionReader interface {
	Current(context.Context, string) (identity.StoredSession, error)
	Authorize(context.Context, string, string) (identity.User, error)
}

type HTTP struct {
	sessions SessionReader
	store    Store
}

func NewHTTP(s SessionReader, store Store) *HTTP { return &HTTP{sessions: s, store: store} }

func (h *HTTP) Register(m *http.ServeMux) {
	m.HandleFunc("GET /api/v1/presentations", h.list)
	m.HandleFunc("POST /api/v1/presentations", h.create)
	m.HandleFunc("GET /api/v1/presentations/{presentationId}", h.get)
	m.HandleFunc("PATCH /api/v1/presentations/{presentationId}", h.update)
	m.HandleFunc("PUT /api/v1/presentations/{presentationId}/access-code", h.setAccessCode)
	m.HandleFunc("DELETE /api/v1/presentations/{presentationId}", h.delete)
	m.HandleFunc("POST /api/v1/presentations/{presentationId}/duplicate", h.duplicate)
	m.HandleFunc("GET /api/v1/presentations/{presentationId}/latest-session", h.latestSession)
	m.HandleFunc("GET /api/v1/presentations/{presentationId}/sessions/{sessionId}/questions/{slideId}/results", h.questionResults)
	m.HandleFunc("DELETE /api/v1/presentations/{presentationId}/results", h.deleteResults)
	m.HandleFunc("POST /api/v1/presentations/{presentationId}/slides", h.createSlide)
	m.HandleFunc("POST /api/v1/presentations/{presentationId}/slides/reorder", h.reorderSlides)
	m.HandleFunc("PUT /api/v1/presentations/{presentationId}/slides/{slideId}", h.replaceSlide)
	m.HandleFunc("DELETE /api/v1/presentations/{presentationId}/slides/{slideId}", h.deleteSlide)
	m.HandleFunc("POST /api/v1/presentations/{presentationId}/questions", h.createQuestion)
}

func (h *HTTP) current(r *http.Request) (identity.User, error) {
	cookie, err := r.Cookie("proslides_session")
	if err != nil {
		return identity.User{}, err
	}
	session, err := h.sessions.Current(r.Context(), cookie.Value)
	return session.User, err
}

func (h *HTTP) mutating(w http.ResponseWriter, r *http.Request) (identity.User, bool) {
	cookie, err := r.Cookie("proslides_session")
	if err != nil {
		errJSON(w, 401, "unauthorized")
		return identity.User{}, false
	}
	user, err := h.sessions.Authorize(r.Context(), cookie.Value, r.Header.Get("X-CSRF-Token"))
	if err != nil {
		errJSON(w, 403, "csrf_failed")
		return identity.User{}, false
	}
	return user, true
}

func (h *HTTP) list(w http.ResponseWriter, r *http.Request) {
	user, err := h.current(r)
	if err != nil {
		errJSON(w, 401, "unauthorized")
		return
	}
	items, err := h.store.ListOwned(r.Context(), user.ID)
	if err != nil {
		errJSON(w, 500, "internal_error")
		return
	}
	writeJSON(w, 200, items)
}

func (h *HTTP) get(w http.ResponseWriter, r *http.Request) {
	user, err := h.current(r)
	if err != nil {
		errJSON(w, 401, "unauthorized")
		return
	}
	p, err := h.store.FindOwned(r.Context(), r.PathValue("presentationId"), user.ID)
	if handleStoreError(w, err) {
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, 200, p)
}

type presentationInput struct {
	Title    *string         `json:"title"`
	Settings json.RawMessage `json:"settings"`
}

func decodePresentationInput(w http.ResponseWriter, r *http.Request, requireTitle bool) (presentationInput, bool) {
	var body presentationInput
	r.Body = http.MaxBytesReader(w, r.Body, maxContentBytes)
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		errJSON(w, 400, "invalid_request")
		return body, false
	}
	if body.Title != nil {
		value := strings.TrimSpace(*body.Title)
		body.Title = &value
	}
	if requireTitle && (body.Title == nil || *body.Title == "") {
		errJSON(w, 400, "invalid_request")
		return body, false
	}
	if body.Title != nil && (*body.Title == "" || utf8.RuneCountInString(*body.Title) > 500) {
		errJSON(w, 400, "invalid_request")
		return body, false
	}
	if len(body.Settings) > 0 && (!validJSONObject(body.Settings) || validatePresentationSettings(body.Settings) != nil) {
		errJSON(w, 400, "invalid_request")
		return body, false
	}
	if !requireTitle && body.Title == nil && len(body.Settings) == 0 {
		errJSON(w, 400, "invalid_request")
		return body, false
	}
	return body, true
}

func (h *HTTP) create(w http.ResponseWriter, r *http.Request) {
	user, ok := h.mutating(w, r)
	if !ok {
		return
	}
	body, ok := decodePresentationInput(w, r, true)
	if !ok {
		return
	}
	p, err := h.store.Create(r.Context(), user.ID, *body.Title, body.Settings)
	if handleStoreError(w, err) {
		return
	}
	writeJSON(w, http.StatusCreated, p)
}

func (h *HTTP) update(w http.ResponseWriter, r *http.Request) {
	user, ok := h.mutating(w, r)
	if !ok {
		return
	}
	body, ok := decodePresentationInput(w, r, false)
	if !ok {
		return
	}
	expected, ok := decodeExpectedRevision(w, r)
	if !ok {
		return
	}
	p, err := h.store.Update(r.Context(), r.PathValue("presentationId"), user.ID, PresentationPatch{Title: body.Title, Settings: body.Settings, ExpectedRevision: expected})
	if handleStoreError(w, err) {
		return
	}
	writeJSON(w, 200, p)
}

func (h *HTTP) setAccessCode(w http.ResponseWriter, r *http.Request) {
	user, ok := h.mutating(w, r)
	if !ok {
		return
	}
	var body struct {
		AccessCode string `json:"access_code"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1024)
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		errJSON(w, http.StatusBadRequest, "invalid_request")
		return
	}
	code := strings.ToUpper(strings.TrimSpace(body.AccessCode))
	if len(code) < 5 || len(code) > 12 || !isASCIIAlphanumeric(code) {
		errJSON(w, http.StatusBadRequest, "invalid_access_code")
		return
	}
	result, err := h.store.SetAccessCode(r.Context(), r.PathValue("presentationId"), user.ID, code)
	if handleStoreError(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *HTTP) delete(w http.ResponseWriter, r *http.Request) {
	user, ok := h.mutating(w, r)
	if !ok {
		return
	}
	if handleStoreError(w, h.store.Delete(r.Context(), r.PathValue("presentationId"), user.ID)) {
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *HTTP) duplicate(w http.ResponseWriter, r *http.Request) {
	user, ok := h.mutating(w, r)
	if !ok {
		return
	}
	body, ok := decodePresentationInput(w, r, true)
	if !ok {
		return
	}
	p, err := h.store.Duplicate(r.Context(), r.PathValue("presentationId"), user.ID, *body.Title)
	if handleStoreError(w, err) {
		return
	}
	writeJSON(w, http.StatusCreated, p)
}

func (h *HTTP) latestSession(w http.ResponseWriter, r *http.Request) {
	user, err := h.current(r)
	if err != nil {
		errJSON(w, 401, "unauthorized")
		return
	}
	locator, err := h.store.LatestSession(r.Context(), r.PathValue("presentationId"), user.ID)
	if handleStoreError(w, err) {
		return
	}
	writeJSON(w, 200, locator)
}

func (h *HTTP) questionResults(w http.ResponseWriter, r *http.Request) {
	user, err := h.current(r)
	if err != nil {
		errJSON(w, 401, "unauthorized")
		return
	}
	limit := 50
	if raw := r.URL.Query().Get("limit"); raw != "" {
		limit, err = strconv.Atoi(raw)
		if err != nil || limit < 1 || limit > 100 {
			errJSON(w, 400, "invalid_request")
			return
		}
	}
	var cursor *QuestionResultCursor
	if raw := r.URL.Query().Get("cursor"); raw != "" {
		decoded, decodeErr := base64.RawURLEncoding.DecodeString(raw)
		var value QuestionResultCursor
		if decodeErr != nil || json.Unmarshal(decoded, &value) != nil || !validUUID(value.AnswerID) || value.SubmittedAt.IsZero() {
			errJSON(w, 400, "invalid_cursor")
			return
		}
		cursor = &value
	}
	page, err := h.store.QuestionResults(r.Context(), r.PathValue("presentationId"), r.PathValue("sessionId"), r.PathValue("slideId"), user.ID, QuestionResultsQuery{Limit: limit, Cursor: cursor})
	if handleStoreError(w, err) {
		return
	}
	if page.HasMore && len(page.Leaderboard) > 0 {
		last := page.Leaderboard[len(page.Leaderboard)-1]
		raw, _ := json.Marshal(QuestionResultCursor{Score: last.Score, SubmittedAt: last.SubmittedAt, AnswerID: last.answerID})
		next := base64.RawURLEncoding.EncodeToString(raw)
		page.NextCursor = &next
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, 200, page)
}

func (h *HTTP) deleteResults(w http.ResponseWriter, r *http.Request) {
	user, ok := h.mutating(w, r)
	if !ok {
		return
	}
	if handleStoreError(w, h.store.DeleteResults(r.Context(), r.PathValue("presentationId"), user.ID)) {
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type slideInput struct {
	Position int             `json:"position"`
	Kind     string          `json:"kind"`
	Content  json.RawMessage `json:"content"`
}

func decodeSlideInput(w http.ResponseWriter, r *http.Request) (slideInput, bool) {
	var body slideInput
	r.Body = http.MaxBytesReader(w, r.Body, maxContentBytes)
	if json.NewDecoder(r.Body).Decode(&body) != nil || body.Position < 0 {
		errJSON(w, 400, "invalid_request")
		return body, false
	}
	kind, content, err := normalizeSlideDefinition(body.Kind, body.Content)
	if err != nil {
		errJSON(w, 400, "invalid_request")
		return body, false
	}
	body.Kind = kind
	body.Content = content
	return body, true
}

func (h *HTTP) createSlide(w http.ResponseWriter, r *http.Request) {
	user, ok := h.mutating(w, r)
	if !ok {
		return
	}
	body, ok := decodeSlideInput(w, r)
	if !ok {
		return
	}
	expected, ok := decodeExpectedRevision(w, r)
	if !ok {
		return
	}
	slide, err := h.store.CreateSlide(r.Context(), r.PathValue("presentationId"), user.ID, body.Position, body.Kind, body.Content, expected)
	if handleStoreError(w, err) {
		return
	}
	writeJSON(w, http.StatusCreated, slide)
}

func (h *HTTP) replaceSlide(w http.ResponseWriter, r *http.Request) {
	user, ok := h.mutating(w, r)
	if !ok {
		return
	}
	body, ok := decodeSlideInput(w, r)
	if !ok {
		return
	}
	expected, ok := decodeExpectedRevision(w, r)
	if !ok {
		return
	}
	slide, err := h.store.ReplaceSlide(r.Context(), r.PathValue("presentationId"), r.PathValue("slideId"), user.ID, body.Position, body.Kind, body.Content, expected)
	if handleStoreError(w, err) {
		return
	}
	writeJSON(w, 200, slide)
}

func (h *HTTP) deleteSlide(w http.ResponseWriter, r *http.Request) {
	user, ok := h.mutating(w, r)
	if !ok {
		return
	}
	expected, ok := decodeExpectedRevision(w, r)
	if !ok {
		return
	}
	if handleStoreError(w, h.store.DeleteSlide(r.Context(), r.PathValue("presentationId"), r.PathValue("slideId"), user.ID, expected)) {
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *HTTP) reorderSlides(w http.ResponseWriter, r *http.Request) {
	user, ok := h.mutating(w, r)
	if !ok {
		return
	}
	var body struct {
		SlideIDs []string `json:"slide_ids"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxContentBytes)
	if json.NewDecoder(r.Body).Decode(&body) != nil || len(body.SlideIDs) > 1000 || hasEmptyOrDuplicate(body.SlideIDs) {
		errJSON(w, 400, "invalid_request")
		return
	}
	expected, ok := decodeExpectedRevision(w, r)
	if !ok {
		return
	}
	if handleStoreError(w, h.store.ReorderSlides(r.Context(), r.PathValue("presentationId"), user.ID, body.SlideIDs, expected)) {
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *HTTP) createQuestion(w http.ResponseWriter, r *http.Request) {
	user, ok := h.mutating(w, r)
	if !ok {
		return
	}
	var body struct {
		Position     int    `json:"position"`
		Text         string `json:"text"`
		QuestionType string `json:"question_type"`
		QuestionTime int    `json:"question_time"`
		MaxPoint     int    `json:"max_point"`
		MinPoint     int    `json:"min_point"`
		Faster       bool   `json:"faster_answers_more_points"`
		Partial      bool   `json:"partial_scoring"`
		Options      []struct {
			Text      string `json:"text"`
			IsCorrect bool   `json:"is_correct"`
		} `json:"options"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxContentBytes)
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		errJSON(w, 400, "invalid_request")
		return
	}
	if body.QuestionTime == 0 {
		body.QuestionTime = 30
	}
	if body.MaxPoint == 0 {
		body.MaxPoint = 100
	}
	if body.Position < 0 || strings.TrimSpace(body.Text) == "" || len(body.Options) < 2 || len(body.Options) > 100 ||
		(body.QuestionType != ChoiceSelectionSingle && body.QuestionType != ChoiceSelectionMultiple) ||
		body.QuestionTime < 1 || body.QuestionTime > 86400 || body.MinPoint < 0 || body.MaxPoint < body.MinPoint {
		errJSON(w, 400, "invalid_request")
		return
	}

	options := make([]ChoiceOptionDefinition, 0, len(body.Options))
	correctOptionIDs := make([]string, 0, len(body.Options))
	for index, option := range body.Options {
		if strings.TrimSpace(option.Text) == "" {
			errJSON(w, 400, "invalid_request")
			return
		}
		id := "option-" + strconv.Itoa(index+1)
		options = append(options, ChoiceOptionDefinition{
			ID:    id,
			Text:  strings.TrimSpace(option.Text),
			Order: index + 1,
		})
		if option.IsCorrect {
			correctOptionIDs = append(correctOptionIDs, id)
		}
	}
	if len(correctOptionIDs) == 0 ||
		(body.QuestionType == ChoiceSelectionSingle && (len(correctOptionIDs) != 1 || body.Partial)) {
		errJSON(w, 400, "invalid_request")
		return
	}

	activity := ActivityDefinition{
		SchemaVersion: ActivitySchemaVersion1,
		ActivityKind:  ActivityKindChoice,
		Prompt: ActivityPrompt{
			Text: strings.TrimSpace(body.Text),
		},
		Response: ChoiceResponsePolicy{
			Selection: body.QuestionType,
			Options:   options,
		},
		Evaluation: ChoiceEvaluationPolicy{
			Mode:             EvaluationModeCorrectness,
			CorrectOptionIDs: correctOptionIDs,
		},
		Scoring: ChoiceScoringPolicy{
			Mode:          ScoringModePoints,
			MinPoints:     body.MinPoint,
			MaxPoints:     body.MaxPoint,
			SpeedBonus:    body.Faster,
			PartialCredit: body.Partial,
		},
		Timing: ActivityTimingPolicy{DurationSeconds: body.QuestionTime},
		Results: ActivityResultPolicy{
			ShowOverallLeaderboardAfter: false,
		},
	}
	if err := validateActivityDefinition(activity); err != nil {
		errJSON(w, 400, "invalid_request")
		return
	}
	content, err := json.Marshal(activity)
	if err != nil {
		errJSON(w, 500, "internal_error")
		return
	}
	slide, err := h.store.CreateSlide(r.Context(), r.PathValue("presentationId"), user.ID, body.Position, ItemKindActivity, content, nil)
	if handleStoreError(w, err) {
		return
	}
	writeJSON(w, http.StatusCreated, slide)
}

func decodeExpectedRevision(w http.ResponseWriter, r *http.Request) (*int64, bool) {
	raw := strings.TrimSpace(r.Header.Get("If-Match"))
	if raw == "" {
		return nil, true
	}
	raw = strings.Trim(raw, `"`)
	value, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || value < 1 {
		errJSON(w, http.StatusBadRequest, "invalid_revision")
		return nil, false
	}
	return &value, true
}
func hasEmptyOrDuplicate(ids []string) bool {
	seen := map[string]struct{}{}
	for _, id := range ids {
		if id == "" {
			return true
		}
		if _, ok := seen[id]; ok {
			return true
		}
		seen[id] = struct{}{}
	}
	return false
}
func isASCIIAlphanumeric(value string) bool {
	for _, char := range value {
		if (char < 'A' || char > 'Z') && (char < '0' || char > '9') {
			return false
		}
	}
	return true
}
func handleStoreError(w http.ResponseWriter, err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, ErrNotFound) {
		errJSON(w, 404, "not_found")
	} else if errors.Is(err, ErrInvalidPosition) {
		errJSON(w, 400, "invalid_position")
	} else if errors.Is(err, ErrSlideHasResults) {
		errJSON(w, 409, "slide_has_results")
	} else if errors.Is(err, ErrEditConflict) {
		errJSON(w, 409, "edit_conflict")
	} else if errors.Is(err, ErrAccessCodeTaken) {
		errJSON(w, 409, "access_code_taken")
	} else if errors.Is(err, ErrSessionActive) {
		errJSON(w, 409, "live_session_active")
	} else {
		errJSON(w, 500, "internal_error")
	}
	return true
}
func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func errJSON(w http.ResponseWriter, status int, code string) {
	writeJSON(w, status, map[string]string{"error": code})
}

func validUUID(value string) bool {
	if len(value) != 36 || value[8] != '-' || value[13] != '-' || value[18] != '-' || value[23] != '-' {
		return false
	}
	_, err := hex.DecodeString(strings.ReplaceAll(value, "-", ""))
	return err == nil
}
