import pytest
from django.test import override_settings

from backend.srvs.office.tests.factories import QuestionFactory, OptionFactory


@pytest.mark.django_db
@override_settings(EXPORT_SERVICE_TOKEN="test-export-token")
def test_question_results_rejects_empty_options(api_client):
    question = QuestionFactory()
    resp = api_client.post(
        f"/api/quizzes/{question.slide.quiz_id}/slides/{question.slide_id}/question/results/",
        {"options": []},
        format="json",
        HTTP_X_EXPORT_TOKEN="test-export-token",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
@override_settings(EXPORT_SERVICE_TOKEN="test-export-token")
def test_question_results_rejects_duplicate_option_ids(api_client):
    question = QuestionFactory()
    option = OptionFactory(question=question)
    payload = {"options": [{"option_id": option.id, "number_of_submits": 1},
                           {"option_id": option.id, "number_of_submits": 2}]}
    resp = api_client.post(
        f"/api/quizzes/{question.slide.quiz_id}/slides/{question.slide_id}/question/results/",
        payload,
        format="json",
        HTTP_X_EXPORT_TOKEN="test-export-token",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
@override_settings(EXPORT_SERVICE_TOKEN="test-export-token")
def test_question_results_requires_all_options(api_client):
    question = QuestionFactory()
    opt1 = OptionFactory(question=question)
    OptionFactory(question=question)
    payload = {"options": [{"option_id": opt1.id, "number_of_submits": 1}]}
    resp = api_client.post(
        f"/api/quizzes/{question.slide.quiz_id}/slides/{question.slide_id}/question/results/",
        payload,
        format="json",
        HTTP_X_EXPORT_TOKEN="test-export-token",
    )
    assert resp.status_code == 400
    assert "missing_option_ids" in resp.data


@pytest.mark.django_db
@override_settings(EXPORT_SERVICE_TOKEN="test-export-token")
def test_question_results_updates_votes(api_client):
    question = QuestionFactory()
    opt1 = OptionFactory(question=question, votes=0)
    opt2 = OptionFactory(question=question, votes=0)
    payload = {
        "options": [
            {"option_id": opt1.id, "number_of_submits": 3},
            {"option_id": opt2.id, "number_of_submits": 5},
        ]
    }
    resp = api_client.post(
        f"/api/quizzes/{question.slide.quiz_id}/slides/{question.slide_id}/question/results/",
        payload,
        format="json",
        HTTP_X_EXPORT_TOKEN="test-export-token",
    )
    assert resp.status_code == 200
    opt1.refresh_from_db()
    opt2.refresh_from_db()
    assert opt1.votes == 3
    assert opt2.votes == 5
