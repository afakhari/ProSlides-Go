import pytest

from backend.srvs.office.office.models import Option
from backend.srvs.office.tests.factories import QuestionFactory


@pytest.mark.django_db
def test_option_order_auto_increments(api_client):
    question = QuestionFactory()
    api_client.force_authenticate(user=question.slide.quiz.owner)
    url = f"/api/quizzes/{question.slide.quiz_id}/slides/{question.slide_id}/question/options/"

    first = api_client.post(url, {"text": "A", "is_correct": False}, format="json")
    second = api_client.post(url, {"text": "B", "is_correct": False}, format="json")

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.data["order"] == 1
    assert second.data["order"] == 2


@pytest.mark.django_db
def test_option_order_create_shifts_existing(api_client):
    question = QuestionFactory()
    api_client.force_authenticate(user=question.slide.quiz.owner)
    url = f"/api/quizzes/{question.slide.quiz_id}/slides/{question.slide_id}/question/options/"

    first = api_client.post(url, {"text": "A", "is_correct": False}, format="json")
    second = api_client.post(url, {"text": "B", "is_correct": False}, format="json")

    resp = api_client.post(
        url,
        {"text": "C", "is_correct": False, "order": 2},
        format="json",
    )
    assert resp.status_code == 201
    assert resp.data["order"] == 2

    orders = list(
        Option.objects.filter(question=question)
        .order_by("order")
        .values_list("order", flat=True)
    )
    assert orders == [1, 2, 3]


@pytest.mark.django_db
def test_option_order_rejects_zero(api_client):
    question = QuestionFactory()
    api_client.force_authenticate(user=question.slide.quiz.owner)
    url = f"/api/quizzes/{question.slide.quiz_id}/slides/{question.slide_id}/question/options/"

    resp = api_client.post(
        url,
        {"text": "A", "is_correct": False, "order": 0},
        format="json",
    )
    assert resp.status_code == 400
    assert "order" in resp.data


@pytest.mark.django_db
def test_option_order_update_shifts_existing(api_client):
    question = QuestionFactory()
    api_client.force_authenticate(user=question.slide.quiz.owner)
    url = f"/api/quizzes/{question.slide.quiz_id}/slides/{question.slide_id}/question/options/"

    first = api_client.post(url, {"text": "A", "is_correct": False}, format="json")
    second = api_client.post(url, {"text": "B", "is_correct": False}, format="json")
    third = api_client.post(url, {"text": "C", "is_correct": False}, format="json")

    resp = api_client.patch(
        f"{url}{third.data['option_id']}/",
        {"order": 1},
        format="json",
    )
    assert resp.status_code == 200
    orders = list(
        Option.objects.filter(question=question)
        .order_by("order")
        .values_list("order", flat=True)
    )
    assert orders == [1, 2, 3]


@pytest.mark.django_db
def test_option_order_update_beyond_range_moves_to_end(api_client):
    question = QuestionFactory()
    api_client.force_authenticate(user=question.slide.quiz.owner)
    url = f"/api/quizzes/{question.slide.quiz_id}/slides/{question.slide_id}/question/options/"

    first = api_client.post(url, {"text": "A", "is_correct": False}, format="json")
    api_client.post(url, {"text": "B", "is_correct": False}, format="json")
    api_client.post(url, {"text": "C", "is_correct": False}, format="json")

    resp = api_client.patch(
        f"{url}{first.data['option_id']}/",
        {"order": 10},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["order"] == 10

    orders = list(
        Option.objects.filter(question=question)
        .order_by("order")
        .values_list("order", flat=True)
    )
    assert orders == [1, 2, 10]
