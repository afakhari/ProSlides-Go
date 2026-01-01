import uuid

import pytest
from django.contrib.auth import get_user_model

from backend.srvs.office.office.models import Quiz
from backend.srvs.office.tests.factories import (
    QuizFactory,
    SlideFactory,
    QuestionFactory,
    OptionFactory,
)


def _create_owner():
    User = get_user_model()
    token = uuid.uuid4().hex[:8]
    return User.objects.create_user(
        username=f"owner_{token}",
        password="pass1234",
        email=f"owner_{token}@example.com",
    )


def _create_quiz(owner):
    quiz_fields = {field.name for field in Quiz._meta.get_fields()}
    if "owner" in quiz_fields:
        return QuizFactory(owner=owner)
    return QuizFactory()


@pytest.mark.django_db
def test_single_choice_rejects_second_correct_option(api_client):
    owner = _create_owner()
    quiz = _create_quiz(owner)
    slide = SlideFactory(quiz=quiz, slide_type=1)
    question = QuestionFactory(slide=slide, question_type="single")

    if "owner" in {field.name for field in Quiz._meta.get_fields()}:
        api_client.force_authenticate(user=owner)
    create_url = f"/api/quizzes/{quiz.id}/slides/{slide.id}/question/options/"

    first_resp = api_client.post(
        create_url,
        {"text": "Option A", "is_correct": True},
        format="json",
    )
    assert first_resp.status_code == 201

    second_resp = api_client.post(
        create_url,
        {"text": "Option B", "is_correct": True},
        format="json",
    )
    assert second_resp.status_code == 400


@pytest.mark.django_db
def test_switch_to_single_rejects_multiple_correct_options(api_client):
    owner = _create_owner()
    quiz = _create_quiz(owner)
    slide = SlideFactory(quiz=quiz, slide_type=1)
    question = QuestionFactory(slide=slide, question_type="multiple")
    OptionFactory(question=question, is_correct=True)
    OptionFactory(question=question, is_correct=True)

    if "owner" in {field.name for field in Quiz._meta.get_fields()}:
        api_client.force_authenticate(user=owner)
    update_url = f"/api/quizzes/{quiz.id}/slides/{slide.id}/question/"
    resp = api_client.patch(
        update_url,
        {"question_type": "single"},
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_single_choice_update_rejects_second_correct_option(api_client):
    owner = _create_owner()
    quiz = _create_quiz(owner)
    slide = SlideFactory(quiz=quiz, slide_type=1)
    question = QuestionFactory(slide=slide, question_type="single")
    OptionFactory(question=question, order=1, is_correct=True)
    other_option = OptionFactory(question=question, order=2, is_correct=False)

    if "owner" in {field.name for field in Quiz._meta.get_fields()}:
        api_client.force_authenticate(user=owner)
    update_url = (
        f"/api/quizzes/{quiz.id}/slides/{slide.id}/question/options/{other_option.id}/"
    )
    resp = api_client.patch(update_url, {"is_correct": True}, format="json")
    assert resp.status_code == 400
