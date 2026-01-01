import pytest

from backend.srvs.office.tests.factories import QuizFactory, SlideFactory
from backend.srvs.office.office.models import Slide


@pytest.mark.django_db
def test_create_slide_shifts_orders(api_client):
    quiz = QuizFactory()
    api_client.force_authenticate(user=quiz.owner)
    s1 = SlideFactory(quiz=quiz, order=1)
    s2 = SlideFactory(quiz=quiz, order=2)

    resp = api_client.post(
        f"/api/quizzes/{quiz.id}/slides/",
        {"slide_type": 1, "order": 2},
        format="json",
    )
    assert resp.status_code == 201

    orders = list(
        Slide.objects.filter(quiz=quiz).order_by("order").values_list("order", flat=True)
    )
    assert orders == [1, 2, 3]

    s1.refresh_from_db()
    s2.refresh_from_db()
    assert s1.order == 1
    assert s2.order == 3


@pytest.mark.django_db
def test_update_slide_move_up_shifts_down(api_client):
    quiz = QuizFactory()
    api_client.force_authenticate(user=quiz.owner)
    s1 = SlideFactory(quiz=quiz, order=1)
    s2 = SlideFactory(quiz=quiz, order=2)
    s3 = SlideFactory(quiz=quiz, order=3)

    resp = api_client.patch(
        f"/api/quizzes/{quiz.id}/slides/{s3.id}/",
        {"order": 1},
        format="json",
    )
    assert resp.status_code == 200

    s1.refresh_from_db()
    s2.refresh_from_db()
    s3.refresh_from_db()
    assert s3.order == 1
    assert s1.order == 2
    assert s2.order == 3


@pytest.mark.django_db
def test_update_slide_move_down_shifts_up(api_client):
    quiz = QuizFactory()
    api_client.force_authenticate(user=quiz.owner)
    s1 = SlideFactory(quiz=quiz, order=1)
    s2 = SlideFactory(quiz=quiz, order=2)
    s3 = SlideFactory(quiz=quiz, order=3)

    resp = api_client.patch(
        f"/api/quizzes/{quiz.id}/slides/{s1.id}/",
        {"order": 3},
        format="json",
    )
    assert resp.status_code == 200

    s1.refresh_from_db()
    s2.refresh_from_db()
    s3.refresh_from_db()
    assert s1.order == 3
    assert s2.order == 1
    assert s3.order == 2


@pytest.mark.django_db
def test_invalid_order_rejected(api_client):
    quiz = QuizFactory()
    api_client.force_authenticate(user=quiz.owner)

    resp = api_client.post(
        f"/api/quizzes/{quiz.id}/slides/",
        {"slide_type": 1, "order": 0},
        format="json",
    )
    assert resp.status_code == 400
    assert "order" in resp.data


@pytest.mark.django_db
def test_create_slide_without_order_assigns_next(api_client):
    quiz = QuizFactory()
    api_client.force_authenticate(user=quiz.owner)
    SlideFactory(quiz=quiz, order=1)
    SlideFactory(quiz=quiz, order=2)

    resp = api_client.post(
        f"/api/quizzes/{quiz.id}/slides/",
        {"slide_type": 1},
        format="json",
    )
    assert resp.status_code == 201
    assert resp.data["order"] == 3
