import pytest

from backend.srvs.office.tests.factories import QuizFactory


@pytest.mark.django_db
def test_resolve_access_code_requires_param(api_client):
    resp = api_client.get("/api/quizzes/resolve-access-code/")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_resolve_access_code_not_found(api_client):
    resp = api_client.get("/api/quizzes/resolve-access-code/?access_code=ZZZZ99")
    assert resp.status_code == 404


@pytest.mark.django_db
def test_resolve_access_code_returns_quiz_id(api_client):
    quiz = QuizFactory(
        background_color="#123456",
        background_image_url="http://example.com/bg.png",
        music_url="http://example.com/music.mp3",
    )
    resp = api_client.get(f"/api/quizzes/resolve-access-code/?access_code={quiz.access_code}")
    assert resp.status_code == 200
    assert resp.data["quiz_id"] == quiz.id
    assert resp.data["background_color"] == "#123456"
    assert resp.data["background_image_url"] == "http://example.com/bg.png"
    assert resp.data["music_url"] == "http://example.com/music.mp3"
