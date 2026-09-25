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
	testRevealSessionID  = "66666666-6666-4666-8666-666666666666"
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
		Presentation: PublicLivePresentation{Title: "آزمون نمونه", BackgroundColor: "#123456", BackgroundImageURL: "https://example.test/theme.webp", MusicURL: "https://example.test/theme.mp3", TextColor: "#ffffff"},
	}, nil
}
func (s *snapshotStore) Join(context.Context, string, string, string, string, []byte) (Participant, bool, error) {
	return Participant{}, false, errors.New("unexpected Join")
}
func (s *snapshotStore) ApplyAction(context.Context, string, string, string, int64, string, string) (Session, bool, error) {
	return Session{}, false, errors.New("unexpected ApplyAction")
}
func (s *snapshotStore) SubmitAnswer(context.Context, string, []byte, string, string, ActivityResponsePayload, ScoringPolicy) (AnswerResult, error) {
	return AnswerResult{}, errors.New("unexpected SubmitAnswer")
}
func (s *snapshotStore) ParticipantSnapshot(_ context.Context, session string, hash []byte) (ParticipantSnapshot, error) {
	if (session != testSessionID && session != testPresentationID && session != testRevealSessionID) || string(hash) != string(tokenHash(testParticipantToken)) {
		return ParticipantSnapshot{}, ErrUnauthorized
	}
	remaining := 42
	accepting := ActivityAccepting
	if session == testRevealSessionID {
		revealed := ActivityRevealed
		return ParticipantSnapshot{
			Role:             "participant",
			Session:          PublicSession{ID: session, PresentationID: testPresentationID, State: Presenting, StateVersion: 6, ActivityPhase: &revealed, StageView: StageItem},
			Participant:      ParticipantWithScore{Participant: Participant{ID: "participant-1", DisplayName: "Current Player", Avatar: "P"}, Score: 170},
			PersonalActivityResult: &PersonalActivityResult{
				ActivityItemID: testPresentationID,
				Response:       json.RawMessage(`{"selected_option_indexes":[1]}`),
				ScoreDelta:     100,
			},
			ParticipantCount: 10_000,
			HasScoring:       true,
			LastEventID:      43,
		}, nil
	}
	if session == testPresentationID {
		return ParticipantSnapshot{
			Role:             "participant",
			Session:          PublicSession{ID: session, PresentationID: testPresentationID, State: Presenting, StateVersion: 5, ActivityPhase: &accepting, StageView: StageItem, RemainingSeconds: &remaining},
			Participant:      ParticipantWithScore{Participant: Participant{ID: "participant-1", DisplayName: "Current Player", Avatar: "P"}, Score: 70},
			ParticipantCount: 10_000,
			HasScoring:       true,
			LastEventID:      42,
		}, nil
	}
	return ParticipantSnapshot{
		Role:             "participant",
		Session:          PublicSession{ID: session, PresentationID: testPresentationID, State: Lobby, StateVersion: 2, StageView: StageItem},
		Participant:      ParticipantWithScore{Participant: Participant{ID: "participant-1", DisplayName: "Current Player", Avatar: "P"}, Score: 70},
		ParticipantCount: 10_000,
		HasScoring:       true,
		LastEventID:      42,
	}, nil
}
func (s *snapshotStore) ManagerSnapshot(_ context.Context, session, manager string) (ManagerSnapshot, error) {
	accepting := ActivityAccepting
	if (session != testSessionID && session != testPresentationID) || manager != testManagerID {
		return ManagerSnapshot{}, ErrNotFound
	}
	remaining := 42
	if session == testPresentationID {
		return ManagerSnapshot{
			Role:             "manager",
			Session:          Session{ID: session, PresentationID: testPresentationID, HostID: manager, JoinCode: "JOIN1", State: Presenting, StateVersion: 5, ActivityPhase: &accepting, StageView: StageItem, RemainingSeconds: &remaining},
			ParticipantCount: 10_000,
			HasScoring:       true,
			LastEventID:      42,
			ActivityTopPerformers: []ActivityTopPerformer{},
		}, nil
	}
	return ManagerSnapshot{
		Role:             "manager",
		Session:          Session{ID: session, PresentationID: testPresentationID, HostID: manager, JoinCode: "JOIN1", State: Lobby, StateVersion: 2, StageView: StageItem},
		ParticipantCount: 10_000,
		HasScoring:       true,
		LastEventID:      42,
		ActivityTopPerformers: []ActivityTopPerformer{},
	}, nil
}
func (s *snapshotStore) StageSnapshot(_ context.Context, session, manager string) (StageSnapshot, error) {
	if manager != testManagerID || (session != testSessionID && session != testPresentationID) {
		return StageSnapshot{}, ErrNotFound
	}
	accepting := ActivityAccepting
	remaining := 42
	itemID := testPresentationID
	return StageSnapshot{
		Role:         "stage",
		Session:      PublicSession{ID: session, PresentationID: testPresentationID, State: Presenting, StateVersion: 5, ActiveItemID: &itemID, ActivityPhase: &accepting, StageView: StageItem, RemainingSeconds: &remaining},
		JoinCode:     "JOIN1",
		Presentation: PublicLivePresentation{Title: "آزمون نمونه", BackgroundColor: "#123456", BackgroundImageURL: "", MusicURL: "https://example.test/theme.mp3", TextColor: "#ffffff"},
		ActiveItem:   json.RawMessage(`{"id":"item-1","kind":"activity","content":{"evaluation":{"mode":"correctness"},"response":{"options":[{"id":"a","text":"الف"}]}}}`),
		ParticipantCount: 10_000,
		HasScoring:       true,
		LastEventID:      42,
		Ranking:          []StageRankingEntry{},
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
func (s *snapshotStore) SetParticipantPresence(context.Context, string, []byte, bool) error {
	return nil
}
func (s *snapshotStore) AuthorizeViewer(_ context.Context, session, manager string, hash []byte) error {
	if session != testSessionID && session != testPresentationID && session != testRevealSessionID {
		return ErrUnauthorized
	}
	if manager == testManagerID {
		return nil
	}
	if len(hash) > 0 && string(hash) == string(tokenHash(testParticipantToken)) {
		return nil
	}
	return ErrUnauthorized
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
	if participant["id"] != "participant-1" || participant["score"] != float64(70) || payload["participant_count"] != float64(10_000) || payload["has_scoring"] != true || payload["last_event_id"] != float64(42) {
		t.Fatalf("unexpected participant snapshot: %#v", payload)
	}
}

func TestRevealedParticipantSnapshotExposesOnlyOwnActivityOutcome(t *testing.T) {
	store := &snapshotStore{}
	request := httptest.NewRequest(http.MethodGet, "/api/v1/live/sessions/"+testRevealSessionID+"/snapshot", nil)
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
	personal, ok := payload["personal_activity_result"].(map[string]any)
	if !ok || personal["score_delta"] != float64(100) {
		t.Fatalf("unexpected personal activity result: %#v", payload["personal_activity_result"])
	}
	if _, exists := personal["is_correct"]; exists {
		t.Fatalf("personal activity result must not invent correctness: %#v", personal)
	}
	if _, exists := payload["participants"]; exists {
		t.Fatalf("participant snapshot disclosed roster data")
	}
}

func TestAcceptingActivitySnapshotsExposeServerComputedRemainingSeconds(t *testing.T) {
	store := &snapshotStore{}
	for _, tc := range []struct {
		name string
		role string
	}{
		{name: "participant", role: "participant"},
		{name: "manager", role: "manager"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodGet, "/api/v1/live/sessions/"+testPresentationID+"/snapshot", nil)
			if tc.role == "manager" {
				request.AddCookie(&http.Cookie{Name: "proslides_session", Value: "manager-token"})
			} else {
				request.AddCookie(&http.Cookie{Name: "proslides_participant", Value: testParticipantToken})
			}
			response := httptest.NewRecorder()
			snapshotHandler(store).ServeHTTP(response, request)
			if response.Code != http.StatusOK {
				t.Fatalf("status = %d, body = %s", response.Code, response.Body.String())
			}
			var payload struct {
				Session PublicSession `json:"session"`
			}
			if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
				t.Fatal(err)
			}
			if payload.Session.RemainingSeconds == nil || *payload.Session.RemainingSeconds != 42 {
				t.Fatalf("expected remaining_seconds=42 in %s snapshot, got %#v", tc.role, payload.Session)
			}
		})
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
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil || payload.Presentation.BackgroundColor != "#123456" || payload.Presentation.MusicURL != "https://example.test/theme.mp3" || payload.Presentation.TextColor != "#ffffff" || payload.Presentation.Title != "آزمون نمونه" {
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

func TestEventViewerPrefersOwningManagerAndFallsBackToParticipant(t *testing.T) {
	store := &snapshotStore{}
	service := NewService(store, DeductionPolicy{})
	handler := NewHTTP(service, NewEventBroker(store, time.Hour, 1), snapshotAuth{}, false)

	managerRequest := httptest.NewRequest(
		http.MethodGet,
		"/api/v1/live/sessions/"+testSessionID+"/events",
		nil,
	)
	managerRequest.SetPathValue("sessionId", testSessionID)
	managerRequest.AddCookie(&http.Cookie{Name: "proslides_session", Value: "manager-token"})
	managerRequest.AddCookie(&http.Cookie{Name: "proslides_participant", Value: testParticipantToken})
	managerViewer, err := handler.eventViewer(managerRequest)
	if err != nil || managerViewer.role != "manager" || managerViewer.participantToken != "" {
		t.Fatalf("manager viewer = %#v, err = %v", managerViewer, err)
	}

	fallbackRequest := httptest.NewRequest(
		http.MethodGet,
		"/api/v1/live/sessions/"+testSessionID+"/events",
		nil,
	)
	fallbackRequest.SetPathValue("sessionId", testSessionID)
	fallbackRequest.AddCookie(&http.Cookie{Name: "proslides_session", Value: "other-manager-token"})
	fallbackRequest.AddCookie(&http.Cookie{Name: "proslides_participant", Value: testParticipantToken})
	participantViewer, err := handler.eventViewer(fallbackRequest)
	if err != nil ||
		participantViewer.role != "participant" ||
		participantViewer.participantToken != testParticipantToken {
		t.Fatalf("participant fallback viewer = %#v, err = %v", participantViewer, err)
	}
}

func TestParticipantEventStreamDoesNotExposeClosedActivityResults(t *testing.T) {
	resultEvent := Event{
		EventID:      12,
		SchemaVersion: 2,
		SessionID:    testSessionID,
		StateVersion: 5,
		Name:         "activity.result_updated",
		Payload:      json.RawMessage(`{"activity_item_id":"activity-1","activity_kind":"text","schema_version":1,"response_count":2,"payload":{"terms":[{"text":"محرمانه","count":2}]}}`),
	}
	stateEvent := Event{
		EventID:      11,
		SchemaVersion: 1,
		SessionID:    testSessionID,
		StateVersion: 5,
		Name:         "session.state_changed",
		Payload:      json.RawMessage(`{"state":"presenting","activity_phase":"closed","stage_view":"item"}`),
	}

	if eventVisibleToViewer("participant", resultEvent) {
		t.Fatal("participant stream exposed private closed Activity result")
	}
	if !eventVisibleToViewer("participant", stateEvent) {
		t.Fatal("participant stream must still receive lifecycle events")
	}
	if !eventVisibleToViewer("manager", resultEvent) {
		t.Fatal("manager stream lost private Activity result")
	}
}

func TestStageSnapshotIsManagerOnlyAndProjectionScoped(t *testing.T) {
	store := &snapshotStore{}
	handler := snapshotHandler(store)

	participantRequest := httptest.NewRequest(http.MethodGet, "/api/v1/live/sessions/"+testSessionID+"/stage", nil)
	participantRequest.AddCookie(&http.Cookie{Name: "proslides_participant", Value: testParticipantToken})
	participantResponse := httptest.NewRecorder()
	handler.ServeHTTP(participantResponse, participantRequest)
	if participantResponse.Code != http.StatusUnauthorized {
		t.Fatalf("participant stage status = %d", participantResponse.Code)
	}

	managerRequest := httptest.NewRequest(http.MethodGet, "/api/v1/live/sessions/"+testSessionID+"/stage", nil)
	managerRequest.AddCookie(&http.Cookie{Name: "proslides_session", Value: "manager-token"})
	managerResponse := httptest.NewRecorder()
	handler.ServeHTTP(managerResponse, managerRequest)
	if managerResponse.Code != http.StatusOK {
		t.Fatalf("manager stage = %d %s", managerResponse.Code, managerResponse.Body.String())
	}
	var payload map[string]any
	if err := json.Unmarshal(managerResponse.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload["role"] != "stage" || payload["join_code"] != "JOIN1" || payload["participant_count"] != float64(10_000) {
		t.Fatalf("unexpected stage projection: %#v", payload)
	}
	if _, exists := payload["participant"]; exists {
		t.Fatalf("stage projection disclosed participant identity")
	}
	session := payload["session"].(map[string]any)
	if _, exists := session["host_id"]; exists {
		t.Fatalf("stage projection disclosed host_id")
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
