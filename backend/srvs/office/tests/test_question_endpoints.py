import pytest

from backend.srvs.office.tests.factories import QuizFactory, SlideFactory, QuestionFactory


@pytest.mark.django_db
def test_question_create_rejects_duplicate_on_slide(api_client):
    quiz = QuizFactory()
    slide = SlideFactory(quiz=quiz, slide_type=1)
    QuestionFactory(slide=slide)

    api_client.force_authenticate(user=quiz.owner)
    resp = api_client.post(
        f"/api/quizzes/{quiz.id}/slides/{slide.id}/question/",
        {
            "title": "Duplicate",
            "text": "Should fail",
            "question_type": "single",
            "min_point": 0,
            "max_point": 100,
            "time_limit": 30,
            "faster_answers_more_points": False,
            "partial_scoring": False,
        },
        format="json",
    )
    assert resp.status_code == 400
    assert resp.data["error"] == "This slide already has a question"


@pytest.mark.django_db
def test_question_retrieve_missing_returns_404(api_client):
    quiz = QuizFactory()
    slide = SlideFactory(quiz=quiz, slide_type=1)
    api_client.force_authenticate(user=quiz.owner)

    resp = api_client.get(
        f"/api/quizzes/{quiz.id}/slides/{slide.id}/question/"
    )
    assert resp.status_code == 404
