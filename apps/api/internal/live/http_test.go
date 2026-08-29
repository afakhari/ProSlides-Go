package live

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/proslides/proslides/internal/identity"
)

type snapshotStore struct {
	lastRosterQuery RosterQuery
}

const (
	testSessionID        = "11111111-1111-4111-8111-111111111111"
	testPresentationID   = "22222222-2222-4222-8222-222222222222"
	testParticipantToken = "33333333-3333-4333-8333-333333333333"
	testManagerID        = "44444444-4444-4444-8444-444444444444"
	testOtherManagerID   = "55555555-5555-4555-8555-555555555555"
)

func (s *snapshotStore) CreateSession(context.Context, string, string, string, string) (Session, bool, error) {
	return Session{}, false, errors.New("unexpected CreateSession")
}
func (s *snapshotStore) ResolveSession(_ context.Context, code string) (SessionLocator, error) {
	if code != "JOIN1" {
		return SessionLocator{}, ErrNotFound
	}
	return SessionLocator{
		SessionID: testSessionID, PresentationID: testPresentationID,
		Presentation: PublicLivePresentation{Title: "آزمون نمونه", BackgroundColor: "#123456", BackgroundImageURL: "https://example.test/theme.webp", TextColor: "#ffffff"},
	}, nil
}
func (s *snapshotStore) Join(context.Context, string, string, string, string, []byte) (Participant, bool, error) {
	return Participant{}, false, errors.New("unexpected Join")
}
func (s *snapshotStore) ApplyAction(context.Context, string, string, string, int64, string, string, int) (Session, bool, error) {
	return Session{}, false, errors.New("unexpected ApplyAction")
}
func (s *snapshotStore) SubmitAnswer(context.Context, string, []byte, string, string, []int, ScoringPolicy) (AnswerResult, error) {
	return AnswerResult{}, errors.New("unexpected SubmitAnswer")
}
func (s *snapshotStore) ParticipantSnapshot(_ context.Context, session string, hash []byte) (ParticipantSnapshot, error) {
	if session != testSessionID || string(hash) != string(tokenHash(testParticipantToken)) {
		return ParticipantSnapshot{}, ErrUnauthorized
	}
	return ParticipantSnapshot{
		Role:             "participant",
		Session:          PublicSession{ID: session, PresentationID: testPresentationID, State: Lobby, StateVersion: 2},
		Participant:      ParticipantWithScore{Participant: Participant{ID: "participant-1", DisplayName: "Current Player", Avatar: "P"}, Score: 70},
		ParticipantCount: 10_000,
		LastEventID:      42,
	}, nil
}
func (s *snapshotStore) ManagerSnapshot(_ context.Context, session, manager string) (ManagerSnapshot, error) {
	if session != testSessionID || manager != testManagerID {
		return ManagerSnapshot{}, ErrNotFound
	}
	return ManagerSnapshot{
		Role:             "manager",
		Session:          Session{ID: session, PresentationID: testPresentationID, HostID: manager, JoinCode: "JOIN1", State: Lobby, StateVersion: 2},
		ParticipantCount: 10_000,
		LastEventID:      42,
	}, nil
}
func (s *snapshotStore) Roster(_ context.Context, session, manager string, query RosterQuery) (RosterPage, error) {
	if session != testSessionID || manager != testManagerID {
		return RosterPage{}, ErrNotFound
	}
	s.lastRosterQuery = query
	joinedAt := time.Date(2026, 8, 19, 10, 0, 0, 0, time.UTC)
	return RosterPage{
		Items:   []RosterEntry{{ParticipantID: "00000000-0000-0000-0000-000000000001", DisplayName: "First", Score: 90, JoinedAt: joinedAt}},
		Order:   query.Order,
		Limit:   query.Limit,
		HasMore: query.Cursor == nil,
	}, nil
}
func (s *snapshotStore) Events(context.Context, string, int64, int) ([]Event, error) {
	return nil, nil
}
func (s *snapshotStore) LatestEventID(context.Context, string) (int64, error) { return 0, nil }
func (s *snapshotStore) ReconcileDeadline(context.Context, string) (bool, error) {
	return false, nil
}
func (s *snapshotStore) AuthorizeViewer(context.Context, string, string, []byte) error {
	return nil
}

type snapshotAuth struct{}

func (snapshotAuth) Current(_ context.Context, token string) (identity.StoredSession, error) {
	switch token {
	case "manager-token":
		return identity.StoredSession{User: identity.User{ID: testManagerID}}, nil
	case "other-manager-token":
		return identity.StoredSession{User: identity.User{ID: testOtherManagerID}}, nil
	default:
		return identity.StoredSession{}, identity.ErrInvalidCredentials
	}
}
func (snapshotAuth) Authorize(context.Context, string, string) (identity.User, error) {
	return identity.User{}, identity.ErrInvalidCredentials
}

func snapshotHandler(store *snapshotStore) http.Handler {
	mux := http.NewServeMux()
	service := NewService(store, DeductionPolicy{})
	NewHTTP(service, NewEventBroker(store, time.Hour, 1), snapshotAuth{}, false).Register(mux)
	return mux
}

func TestParticipantSnapshotDoesNotDiscloseRosterScoresOrManagerFields(t *testing.T) {
	store := &snapshotStore{}
	request := httptest.NewRequest(http.MethodGet, "/api/v1/live/sessions/"+testSessionID+"/snapshot", nil)
	request.AddCookie(&http.Cookie{Name: "proslides_participant", Value: testParticipantToken})
	response := httptest.NewRecorder()

	snapshotHandler(store).ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", response.Code, response.Body.String())
	}
	var payload map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	for _, forbidden := range []string{"participants", "scores"} {
		if _, exists := payload[forbidden]; exists {
			t.Fatalf("participant snapshot disclosed %q", forbidden)
		}
	}
	session := payload["session"].(map[string]any)
	for _, forbidden := range []string{"host_id", "join_code"} {
		if _, exists := session[forbidden]; exists {
			t.Fatalf("participant snapshot disclosed session field %q", forbidden)
		}
	}
	participant := payload["participant"].(map[string]any)
	if participant["id"] != "participant-1" || participant["score"] != float64(70) || payload["participant_count"] != float64(10_000) || payload["last_event_id"] != float64(42) {
		t.Fatalf("unexpected participant snapshot: %#v", payload)
	}
}

func TestResolveSessionUsesPublicJoinCode(t *testing.T) {
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/v1/live/sessions/resolve?join_code=join1", nil)
	snapshotHandler(&snapshotStore{}).ServeHTTP(response, request)
	if response.Code != http.StatusOK || !jsonFieldEquals(response.Body.Bytes(), "session_id", testSessionID) {
		t.Fatalf("resolve response = %d %s", response.Code, response.Body.String())
	}
	var payload struct {
		Presentation PublicLivePresentation `json:"presentation"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil || payload.Presentation.BackgroundColor != "#123456" || payload.Presentation.TextColor != "#ffffff" || payload.Presentation.Title != "آزمون نمونه" {
		t.Fatalf("resolve theme = %#v, err = %v", payload.Presentation, err)
	}

	missing := httptest.NewRecorder()
	snapshotHandler(&snapshotStore{}).ServeHTTP(missing, httptest.NewRequest(http.MethodGet, "/api/v1/live/sessions/resolve", nil))
	if missing.Code != http.StatusBadRequest {
		t.Fatalf("missing join code status = %d", missing.Code)
	}
}

func TestSnapshotUsesManagerRoleAndFallsBackToParticipantRole(t *testing.T) {
	store := &snapshotStore{}
	handler := snapshotHandler(store)

	managerRequest := httptest.NewRequest(http.MethodGet, "/api/v1/live/sessions/"+testSessionID+"/snapshot", nil)
	managerRequest.AddCookie(&http.Cookie{Name: "proslides_session", Value: "manager-token"})
	managerResponse := httptest.NewRecorder()
	handler.ServeHTTP(managerResponse, managerRequest)
	if managerResponse.Code != http.StatusOK || !jsonFieldEquals(managerResponse.Body.Bytes(), "role", "manager") {
		t.Fatalf("manager snapshot = %d %s", managerResponse.Code, managerResponse.Body.String())
	}

	participantRequest := httptest.NewRequest(http.MethodGet, "/api/v1/live/sessions/"+testSessionID+"/snapshot", nil)
	participantRequest.AddCookie(&http.Cookie{Name: "proslides_session", Value: "other-manager-token"})
	participantRequest.AddCookie(&http.Cookie{Name: "proslides_participant", Value: testParticipantToken})
	participantResponse := httptest.NewRecorder()
	handler.ServeHTTP(participantResponse, participantRequest)
	if participantResponse.Code != http.StatusOK || !jsonFieldEquals(participantResponse.Body.Bytes(), "role", "participant") {
		t.Fatalf("participant fallback = %d %s", participantResponse.Code, participantResponse.Body.String())
	}
}

func TestRosterIsManagerOnlyBoundedAndCursorBased(t *testing.T) {
	store := &snapshotStore{}
	handler := snapshotHandler(store)

	participantRequest := httptest.NewRequest(http.MethodGet, "/api/v1/live/sessions/"+testSessionID+"/roster", nil)
	participantRequest.AddCookie(&http.Cookie{Name: "proslides_participant", Value: testParticipantToken})
	participantResponse := httptest.NewRecorder()
	handler.ServeHTTP(participantResponse, participantRequest)
	if participantResponse.Code != http.StatusUnauthorized {
		t.Fatalf("participant roster status = %d", participantResponse.Code)
	}
	nonOwnerRequest := httptest.NewRequest(http.MethodGet, "/api/v1/live/sessions/"+testSessionID+"/roster", nil)
	nonOwnerRequest.AddCookie(&http.Cookie{Name: "proslides_session", Value: "other-manager-token"})
	nonOwnerResponse := httptest.NewRecorder()
	handler.ServeHTTP(nonOwnerResponse, nonOwnerRequest)
	if nonOwnerResponse.Code != http.StatusNotFound {
		t.Fatalf("non-owner roster status = %d", nonOwnerResponse.Code)
	}

	managerRequest := httptest.NewRequest(http.MethodGet, "/api/v1/live/sessions/"+testSessionID+"/roster?order=score&limit=1", nil)
	managerRequest.AddCookie(&http.Cookie{Name: "proslides_session", Value: "manager-token"})
	managerResponse := httptest.NewRecorder()
	handler.ServeHTTP(managerResponse, managerRequest)
	if managerResponse.Code != http.StatusOK {
		t.Fatalf("manager roster = %d %s", managerResponse.Code, managerResponse.Body.String())
	}
	var first RosterPage
	if err := json.Unmarshal(managerResponse.Body.Bytes(), &first); err != nil {
		t.Fatal(err)
	}
	if first.NextCursor == nil || store.lastRosterQuery.Order != "score" || store.lastRosterQuery.Limit != 1 {
		t.Fatalf("unexpected first roster page: %#v, query: %#v", first, store.lastRosterQuery)
	}

	secondRequest := httptest.NewRequest(http.MethodGet, "/api/v1/live/sessions/"+testSessionID+"/roster?order=score&limit=1&cursor="+*first.NextCursor, nil)
	secondRequest.AddCookie(&http.Cookie{Name: "proslides_session", Value: "manager-token"})
	secondResponse := httptest.NewRecorder()
	handler.ServeHTTP(secondResponse, secondRequest)
	if secondResponse.Code != http.StatusOK || store.lastRosterQuery.Cursor == nil || store.lastRosterQuery.Cursor.ID != first.Items[0].ParticipantID {
		t.Fatalf("cursor page = %d %s, query: %#v", secondResponse.Code, secondResponse.Body.String(), store.lastRosterQuery)
	}

	invalidRequest := httptest.NewRequest(http.MethodGet, "/api/v1/live/sessions/"+testSessionID+"/roster?limit=101", nil)
	invalidRequest.AddCookie(&http.Cookie{Name: "proslides_session", Value: "manager-token"})
	invalidResponse := httptest.NewRecorder()
	handler.ServeHTTP(invalidResponse, invalidRequest)
	if invalidResponse.Code != http.StatusBadRequest {
		t.Fatalf("invalid limit status = %d", invalidResponse.Code)
	}
	invalidCursorRequest := httptest.NewRequest(http.MethodGet, "/api/v1/live/sessions/"+testSessionID+"/roster?cursor=not-a-cursor", nil)
	invalidCursorRequest.AddCookie(&http.Cookie{Name: "proslides_session", Value: "manager-token"})
	invalidCursorResponse := httptest.NewRecorder()
	handler.ServeHTTP(invalidCursorResponse, invalidCursorRequest)
	if invalidCursorResponse.Code != http.StatusBadRequest {
		t.Fatalf("invalid cursor status = %d", invalidCursorResponse.Code)
	}
}

func jsonFieldEquals(body []byte, field, expected string) bool {
	var payload map[string]any
	return json.Unmarshal(body, &payload) == nil && payload[field] == expected
}
