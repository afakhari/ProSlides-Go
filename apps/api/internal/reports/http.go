package reports

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/proslides/proslides/internal/identity"
)

type SessionReader interface {
	Current(context.Context, string) (identity.StoredSession, error)
}

type HTTP struct {
	sessions SessionReader
	store    Store
}

func NewHTTP(sessions SessionReader, store Store) *HTTP {
	return &HTTP{sessions: sessions, store: store}
}

func (h *HTTP) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/presentations/{presentationId}/sessions", h.listSessions)
	mux.HandleFunc("GET /api/v1/presentations/{presentationId}/sessions/{sessionId}/report", h.sessionReport)
	mux.HandleFunc("GET /api/v1/presentations/{presentationId}/sessions/{sessionId}/activities/{activityItemId}/results", h.activityReport)
	mux.HandleFunc("GET /api/v1/presentations/{presentationId}/sessions/{sessionId}/ranking", h.ranking)
}

func (h *HTTP) current(r *http.Request) (identity.User, error) {
	cookie, err := r.Cookie("proslides_session")
	if err != nil {
		return identity.User{}, err
	}
	session, err := h.sessions.Current(r.Context(), cookie.Value)
	if err != nil {
		return identity.User{}, err
	}
	return session.User, nil
}

func (h *HTTP) listSessions(w http.ResponseWriter, r *http.Request) {
	user, err := h.current(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	presentationID := r.PathValue("presentationId")
	if !validUUID(presentationID) {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	limit, ok := reportLimit(w, r, 20)
	if !ok {
		return
	}

	var cursor *SessionCursor
	if raw := r.URL.Query().Get("cursor"); raw != "" {
		var value SessionCursor
		if !decodeCursor(raw, &value) || value.CreatedAt.IsZero() || !validUUID(value.SessionID) {
			writeError(w, http.StatusBadRequest, "invalid_cursor")
			return
		}
		cursor = &value
	}

	page, err := h.store.ListSessions(
		r.Context(),
		presentationID,
		user.ID,
		SessionQuery{Limit: limit, Cursor: cursor},
	)
	if handleStoreError(w, err) {
		return
	}
	if page.HasMore && len(page.Items) > 0 {
		last := page.Items[len(page.Items)-1]
		next := encodeCursor(SessionCursor{CreatedAt: last.CreatedAt, SessionID: last.SessionID})
		page.NextCursor = &next
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, page)
}

func (h *HTTP) sessionReport(w http.ResponseWriter, r *http.Request) {
	user, err := h.current(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	presentationID := r.PathValue("presentationId")
	sessionID := r.PathValue("sessionId")
	if !validUUID(presentationID) || !validUUID(sessionID) {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	report, err := h.store.SessionReport(
		r.Context(),
		presentationID,
		sessionID,
		user.ID,
	)
	if handleStoreError(w, err) {
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, report)
}

func (h *HTTP) activityReport(w http.ResponseWriter, r *http.Request) {
	user, err := h.current(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	presentationID := r.PathValue("presentationId")
	sessionID := r.PathValue("sessionId")
	activityItemID := r.PathValue("activityItemId")
	if !validUUID(presentationID) || !validUUID(sessionID) || !validUUID(activityItemID) {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	limit, ok := reportLimit(w, r, 50)
	if !ok {
		return
	}

	var cursor *ResponseCursor
	if raw := r.URL.Query().Get("cursor"); raw != "" {
		var value ResponseCursor
		if !decodeCursor(raw, &value) || value.SubmittedAt.IsZero() || !validUUID(value.AnswerID) {
			writeError(w, http.StatusBadRequest, "invalid_cursor")
			return
		}
		cursor = &value
	}

	page, err := h.store.ActivityReport(
		r.Context(),
		presentationID,
		sessionID,
		activityItemID,
		user.ID,
		ResponseQuery{Limit: limit, Cursor: cursor},
	)
	if handleStoreError(w, err) {
		return
	}
	if page.HasMore && len(page.Responses) > 0 {
		last := page.Responses[len(page.Responses)-1]
		next := encodeCursor(ResponseCursor{SubmittedAt: last.SubmittedAt, AnswerID: last.AnswerID})
		page.NextCursor = &next
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, page)
}

func (h *HTTP) ranking(w http.ResponseWriter, r *http.Request) {
	user, err := h.current(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	presentationID := r.PathValue("presentationId")
	sessionID := r.PathValue("sessionId")
	if !validUUID(presentationID) || !validUUID(sessionID) {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	limit, ok := reportLimit(w, r, 50)
	if !ok {
		return
	}

	var cursor *RankingCursor
	if raw := r.URL.Query().Get("cursor"); raw != "" {
		var value RankingCursor
		if !decodeCursor(raw, &value) || value.JoinedAt.IsZero() || !validUUID(value.ParticipantID) || value.Score < 0 {
			writeError(w, http.StatusBadRequest, "invalid_cursor")
			return
		}
		cursor = &value
	}

	page, err := h.store.Ranking(
		r.Context(),
		presentationID,
		sessionID,
		user.ID,
		RankingQuery{Limit: limit, Cursor: cursor},
	)
	if handleStoreError(w, err) {
		return
	}
	if page.HasMore && len(page.Items) > 0 {
		last := page.Items[len(page.Items)-1]
		next := encodeCursor(RankingCursor{
			Score:         last.Score,
			JoinedAt:      last.JoinedAt,
			ParticipantID: last.ParticipantID,
		})
		page.NextCursor = &next
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, page)
}

func reportLimit(w http.ResponseWriter, r *http.Request, fallback int) (int, bool) {
	raw := r.URL.Query().Get("limit")
	if raw == "" {
		return fallback, true
	}
	limit, err := strconv.Atoi(raw)
	if err != nil || limit < 1 || limit > 100 {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return 0, false
	}
	return limit, true
}

func encodeCursor(value any) string {
	raw, _ := json.Marshal(value)
	return base64.RawURLEncoding.EncodeToString(raw)
}

func decodeCursor(raw string, target any) bool {
	decoded, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return false
	}
	return json.Unmarshal(decoded, target) == nil
}

func validUUID(value string) bool {
	if len(value) != 36 {
		return false
	}
	for index, r := range value {
		switch index {
		case 8, 13, 18, 23:
			if r != '-' {
				return false
			}
		default:
			if !((r >= '0' && r <= '9') || (r >= 'a' && r <= 'f') || (r >= 'A' && r <= 'F')) {
				return false
			}
		}
	}
	return true
}

func handleStoreError(w http.ResponseWriter, err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, ErrNotFound) {
		writeError(w, http.StatusNotFound, "not_found")
		return true
	}
	writeError(w, http.StatusInternalServerError, "internal_error")
	return true
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, code string) {
	writeJSON(w, status, map[string]string{"error": code})
}

