import pytest

from backend.srvs.office.office.models import Leaderboard
from backend.srvs.office.tests.factories import QuizFactory, QuestionFactory, OptionFactory


@pytest.mark.django_db
def test_export_includes_quiz_and_slides(api_client):
    quiz = QuizFactory(background_color="#123456")
    question = QuestionFactory(slide__quiz=quiz)
    OptionFactory.create_batch(3, question=question)

    api_client.force_authenticate(user=quiz.owner)
    resp = api_client.get(f"/api/quizzes/{quiz.id}/export/")
    assert resp.status_code == 200

    data = resp.data
    assert data["quiz_id"] == quiz.id
    assert data["title"] == quiz.title
    assert data["background"]["color"] == "#123456"

    slides = data["slides"]
    assert len(slides) == 1
    slide = slides[0]
    assert slide["slide_type"] == 1
    assert slide["question"]["question_id"] == question.id
    assert len(slide["question"]["options"]) == 3


@pytest.mark.django_db
def test_export_includes_leaderboard_slide_after_question(api_client):
    quiz = QuizFactory()
    question = QuestionFactory(slide__quiz=quiz, slide__show_leaderboard_after=True)
    OptionFactory.create_batch(2, question=question)

    api_client.force_authenticate(user=quiz.owner)
    resp = api_client.get(f"/api/quizzes/{quiz.id}/export/")
    assert resp.status_code == 200

    slides = resp.data["slides"]
    assert len(slides) == 2

    question_slide, leaderboard_slide = slides
    assert question_slide["slide_type"] == 1
    assert leaderboard_slide["slide_type"] == 3
    assert leaderboard_slide["order"] == question_slide["order"]
    assert leaderboard_slide["question"] is None
    assert leaderboard_slide["leaderboard"] == []


@pytest.mark.django_db
def test_export_includes_leaderboard_entries_sorted(api_client):
    quiz = QuizFactory()
    question = QuestionFactory(slide__quiz=quiz)
    Leaderboard.objects.create(
        question=question,
        rust_session_id="player-2",
        player_name="Two",
        avatar="T",
        score=20,
        time_taken=2.0,
        rank=2,
    )
    Leaderboard.objects.create(
        question=question,
        rust_session_id="player-1",
        player_name="One",
        avatar="O",
        score=30,
        time_taken=1.5,
        rank=1,
    )

    api_client.force_authenticate(user=quiz.owner)
    resp = api_client.get(f"/api/quizzes/{quiz.id}/export/")
    assert resp.status_code == 200

    leaderboard = resp.data["slides"][0]["leaderboard"]
    assert [entry["rank"] for entry in leaderboard] == [1, 2]
