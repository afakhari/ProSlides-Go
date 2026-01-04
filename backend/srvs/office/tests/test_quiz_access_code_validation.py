import pytest

from backend.srvs.office.tests.factories import QuizFactory, UserFactory


@pytest.mark.django_db
def test_quiz_create_rejects_invalid_access_code(api_client):
    user = UserFactory()
    api_client.force_authenticate(user=user)
    payload = {
        "title": "Invalid code quiz",
        "access_code": "bad code!",
    }
    resp = api_client.post("/api/quizzes/", payload, format="json")
    assert resp.status_code == 400
    assert "access_code" in resp.data


@pytest.mark.django_db
def test_quiz_create_rejects_duplicate_access_code(api_client):
    quiz = QuizFactory(access_code="ABCD12")
    api_client.force_authenticate(user=quiz.owner)
    payload = {
        "title": "Duplicate code quiz",
        "access_code": quiz.access_code,
    }
    resp = api_client.post("/api/quizzes/", payload, format="json")
    assert resp.status_code == 400
    assert "access_code" in resp.data


@pytest.mark.django_db
def test_quiz_update_rejects_duplicate_access_code(api_client):
    owner = UserFactory()
    first = QuizFactory(owner=owner, access_code="ABCD12")
    second = QuizFactory(owner=owner, access_code="WXYZ34")
    api_client.force_authenticate(user=owner)

    resp = api_client.patch(
        f"/api/quizzes/{second.id}/",
        {"access_code": first.access_code},
        format="json",
    )
    assert resp.status_code == 400
    assert "access_code" in resp.data
