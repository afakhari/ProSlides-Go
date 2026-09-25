package reports

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/proslides/proslides/internal/identity"
)

const (
	testPresentationID = "11111111-1111-4111-8111-111111111111"
	testSessionID      = "22222222-2222-4222-8222-222222222222"
	testActivityID     = "33333333-3333-4333-8333-333333333333"
)

type reportTestSessions struct{}

func (reportTestSessions) Current(context.Context, string) (identity.StoredSession, error) {
	return identity.StoredSession{User: identity.User{ID: "owner"}}, nil
}

type reportTestStore struct {
	listCalls     int
	sessionCalls  int
	activityCalls int
	rankingCalls  int
}

func (s *reportTestStore) ListSessions(_ context.Context, presentationID, ownerID string, query SessionQuery) (SessionPage, error) {
	s.listCalls++
	createdAt := time.Date(2026, time.September, 25, 10, 30, 0, 0, time.UTC)
	return SessionPage{
		Items: []SessionSummary{{
			SessionID:         testSessionID,
			PresentationID:    presentationID,
			PresentationTitle: "Frozen title",
			State:             "ended",
			CreatedAt:         createdAt,
			ParticipantCount:  2,
			ActivityCount:     1,
			ResponseCount:     1,
			HasScoring:        true,
		}},
		Limit:   query.Limit,
		HasMore: true,
	}, nil
}

func (s *reportTestStore) SessionReport(_ context.Context, presentationID, sessionID, ownerID string) (SessionReport, error) {
	s.sessionCalls++
	return SessionReport{
		Session: SessionSummary{
			SessionID:         sessionID,
			PresentationID:    presentationID,
			PresentationTitle: "Frozen title",
			State:             "ended",
			CreatedAt:         time.Date(2026, time.September, 25, 10, 30, 0, 0, time.UTC),
		},
		Activities: []ActivitySummary{},
	}, nil
}

func (s *reportTestStore) ActivityReport(_ context.Context, presentationID, sessionID, activityID, ownerID string, query ResponseQuery) (ActivityReportPage, error) {
	s.activityCalls++
	return ActivityReportPage{
		Activity: ActivitySummary{
			ActivityItemID: activityID,
			Definition:     json.RawMessage(`{"activity_kind":"choice"}`),
		},
		Result:        ActivityResult{ActivityItemID: activityID, OptionCounts: map[string]int{}},
		TopPerformers: []ActivityTopPerformer{},
		Responses:     []ActivityResponse{},
		Limit:         query.Limit,
	}, nil
}

func (s *reportTestStore) Ranking(_ context.Context, presentationID, sessionID, ownerID string, query RankingQuery) (RankingPage, error) {
	s.rankingCalls++
	return RankingPage{
		HasScoring: true,
		IsFinal:    true,
		Items:      []RankingEntry{},
		Limit:      query.Limit,
	}, nil
}

func reportRequest(method, path string) *http.Request {
	request := httptest.NewRequest(method, path, nil)
	request.AddCookie(&http.Cookie{Name: "proslides_session", Value: "token"})
	return request
}

func TestReportHTTPRejectsMalformedResourceIDsBeforeStore(t *testing.T) {
	store := &reportTestStore{}
	mux := http.NewServeMux()
	NewHTTP(reportTestSessions{}, store).Register(mux)

	response := httptest.NewRecorder()
	mux.ServeHTTP(
		response,
		reportRequest(http.MethodGet, "/api/v1/presentations/not-a-uuid/sessions"),
	)

	if response.Code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
	if store.listCalls != 0 {
		t.Fatalf("store was called for malformed ID: %d", store.listCalls)
	}
}

func TestReportSessionHistoryReturnsOpaqueNextCursor(t *testing.T) {
	store := &reportTestStore{}
	mux := http.NewServeMux()
	NewHTTP(reportTestSessions{}, store).Register(mux)

	response := httptest.NewRecorder()
	mux.ServeHTTP(
		response,
		reportRequest(
			http.MethodGet,
			"/api/v1/presentations/"+testPresentationID+"/sessions?limit=1",
		),
	)

	if response.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
	var page SessionPage
	if err := json.Unmarshal(response.Body.Bytes(), &page); err != nil {
		t.Fatal(err)
	}
	if page.NextCursor == nil || *page.NextCursor == "" {
		t.Fatal("expected a next cursor")
	}
	var cursor SessionCursor
	if !decodeCursor(*page.NextCursor, &cursor) {
		t.Fatal("next cursor was not decodable")
	}
	if cursor.SessionID != testSessionID {
		t.Fatalf("cursor session=%s", cursor.SessionID)
	}
}

func TestReportActivityAndRankingAreDistinctResources(t *testing.T) {
	store := &reportTestStore{}
	mux := http.NewServeMux()
	NewHTTP(reportTestSessions{}, store).Register(mux)

	activityResponse := httptest.NewRecorder()
	mux.ServeHTTP(
		activityResponse,
		reportRequest(
			http.MethodGet,
			"/api/v1/presentations/"+testPresentationID+
				"/sessions/"+testSessionID+
				"/activities/"+testActivityID+"/results",
		),
	)
	if activityResponse.Code != http.StatusOK {
		t.Fatalf("activity status=%d body=%s", activityResponse.Code, activityResponse.Body.String())
	}

	rankingResponse := httptest.NewRecorder()
	mux.ServeHTTP(
		rankingResponse,
		reportRequest(
			http.MethodGet,
			"/api/v1/presentations/"+testPresentationID+
				"/sessions/"+testSessionID+"/ranking",
		),
	)
	if rankingResponse.Code != http.StatusOK {
		t.Fatalf("ranking status=%d body=%s", rankingResponse.Code, rankingResponse.Body.String())
	}

	if store.activityCalls != 1 || store.rankingCalls != 1 {
		t.Fatalf(
			"activity calls=%d ranking calls=%d",
			store.activityCalls,
			store.rankingCalls,
		)
	}
}
