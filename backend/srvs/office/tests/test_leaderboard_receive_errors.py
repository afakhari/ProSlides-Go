import pytest

from backend.srvs.office.office.models import PlayerSession
from backend.srvs.office.tests.factories import QuestionFactory, QuizFactory


@pytest.mark.django_db
def test_leaderboard_receive_rejects_empty_list(api_client):
    question = QuestionFactory()
    resp = api_client.post(
        f"/api/quizzes/{question.slide.quiz_id}/slides/{question.slide_id}/question/leaderboard/",
        {"leaderboard": []},
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_leaderboard_receive_partial_errors_returns_207(api_client):
    question = QuestionFactory()
    other_quiz = QuizFactory()
    PlayerSession.objects.create(
        rust_session_id="session-2",
        quiz=other_quiz,
        player_name="Bob",
        avatar="B",
    )
    payload = {
        "leaderboard": [
            {
                "rust_session_id": "session-1",
                "player_name": "Alice",
                "avatar": "A",
                "score": 10,
                "time_taken": 2.5,
                "rank": 1,
            },
            {
                "rust_session_id": "session-2",
                "player_name": "Bob",
                "avatar": "B",
                "score": 5,
                "time_taken": 3.2,
                "rank": 2,
            },
        ]
    }
    resp = api_client.post(
        f"/api/quizzes/{question.slide.quiz_id}/slides/{question.slide_id}/question/leaderboard/",
        payload,
        format="json",
    )
    assert resp.status_code == 207
    assert resp.data["saved_entries"] == 1
    assert resp.data["total_entries"] == 2
    assert resp.data.get("errors")


@pytest.mark.django_db
def test_leaderboard_receive_rejects_session_from_other_quiz(api_client):
    quiz = QuizFactory()
    question = QuestionFactory()
    PlayerSession.objects.create(
        rust_session_id="session-x",
        quiz=quiz,
        player_name="Hacker",
        avatar="X",
    )
    payload = {
        "leaderboard": [
            {
                "rust_session_id": "session-x",
                "player_name": "Hacker",
                "avatar": "X",
                "score": 99,
                "time_taken": 1.1,
                "rank": 1,
            }
        ]
    }
    resp = api_client.post(
        f"/api/quizzes/{question.slide.quiz_id}/slides/{question.slide_id}/question/leaderboard/",
        payload,
        format="json",
    )
    assert resp.status_code == 207
    assert resp.data["saved_entries"] == 0
