import pytest
from django.test import override_settings

from backend.srvs.office.office.models import Leaderboard
from backend.srvs.office.tests.factories import (
    QuizFactory,
    SlideFactory,
    QuestionFactory,
    PlayerSessionFactory,
    UserFactory,
)


@pytest.mark.django_db
def test_quiz_list_requires_authentication(api_client):
    QuizFactory()

    resp = api_client.get("/api/quizzes/list/")
    assert resp.status_code == 401

    user = UserFactory()
    owned_quiz = QuizFactory(owner=user)
    QuizFactory(owner=UserFactory())

    api_client.force_authenticate(user=user)
    resp = api_client.get("/api/quizzes/list/")
    assert resp.status_code == 200
    assert resp.data["count"] == 1
    assert resp.data["results"][0]["quiz_id"] == owned_quiz.id


@pytest.mark.django_db
@override_settings(EXPORT_SERVICE_TOKEN="test-export-token")
def test_leaderboard_receive_validates_quiz_pk(api_client):
    quiz1 = QuizFactory()
    quiz2 = QuizFactory()
    question = QuestionFactory(slide=SlideFactory(quiz=quiz1, slide_type=1))
    player = PlayerSessionFactory(quiz=quiz1)

    payload = {
        "leaderboard": [
            {
                "rust_session_id": player.rust_session_id,
                "player_name": player.player_name,
                "avatar": player.avatar,
                "score": 10,
                "time_taken": 1.0,
                "rank": 1,
            }
        ]
    }

    resp = api_client.post(
        f"/api/quizzes/{quiz2.id}/slides/{question.slide_id}/question/leaderboard/",
        payload,
        format="json",
        HTTP_X_EXPORT_TOKEN="test-export-token",
    )
    assert resp.status_code == 404


@pytest.mark.django_db
def test_participants_count_updates_via_signals():
    quiz1 = QuizFactory()
    quiz2 = QuizFactory()

    session1 = PlayerSessionFactory(quiz=quiz1)
    session2 = PlayerSessionFactory(quiz=quiz1)

    quiz1.refresh_from_db()
    assert quiz1.participants_count == 2

    session1.delete()
    quiz1.refresh_from_db()
    assert quiz1.participants_count == 1

    session2.quiz = quiz2
    session2.save()

    quiz1.refresh_from_db()
    quiz2.refresh_from_db()
    assert quiz1.participants_count == 0
    assert quiz2.participants_count == 1


@pytest.mark.django_db
def test_final_leaderboard_tie_ranking(api_client):
    owner = UserFactory()
    quiz = QuizFactory(owner=owner)
    question1 = QuestionFactory(slide=SlideFactory(quiz=quiz, slide_type=1))
    question2 = QuestionFactory(slide=SlideFactory(quiz=quiz, slide_type=1))

    p1 = PlayerSessionFactory(quiz=quiz)
    p2 = PlayerSessionFactory(quiz=quiz)
    p3 = PlayerSessionFactory(quiz=quiz)

    Leaderboard.objects.create(
        question=question1,
        rust_session_id=p1.rust_session_id,
        player_name=p1.player_name,
        avatar=p1.avatar,
        score=100,
        time_taken=1.0,
        rank=1,
    )
    Leaderboard.objects.create(
        question=question2,
        rust_session_id=p1.rust_session_id,
        player_name=p1.player_name,
        avatar=p1.avatar,
        score=50,
        time_taken=1.2,
        rank=1,
    )
    Leaderboard.objects.create(
        question=question1,
        rust_session_id=p2.rust_session_id,
        player_name=p2.player_name,
        avatar=p2.avatar,
        score=150,
        time_taken=0.8,
        rank=1,
    )
    Leaderboard.objects.create(
        question=question1,
        rust_session_id=p3.rust_session_id,
        player_name=p3.player_name,
        avatar=p3.avatar,
        score=120,
        time_taken=1.5,
        rank=1,
    )

    api_client.force_authenticate(user=owner)
    resp = api_client.get(f"/api/quizzes/{quiz.id}/final-leaderboard/")
    assert resp.status_code == 200

    leaderboard = {entry["rust_session_id"]: entry for entry in resp.data["leaderboard"]}
    assert leaderboard[p1.rust_session_id]["rank"] == 1
    assert leaderboard[p2.rust_session_id]["rank"] == 1
    assert leaderboard[p3.rust_session_id]["rank"] == 3
