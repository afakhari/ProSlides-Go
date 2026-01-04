import pytest

from backend.srvs.office.tests.factories import QuizFactory, SlideFactory, UserFactory


@pytest.mark.django_db
def test_content_retrieve_returns_fields(api_client):
    owner = UserFactory()
    quiz = QuizFactory(owner=owner)
    slide = SlideFactory(
        quiz=quiz,
        slide_type=2,
        title="Content title",
        content_text="Content body",
        content_image_url="http://example.com/content.png",
    )

    api_client.force_authenticate(user=owner)
    resp = api_client.get(f"/api/quizzes/{quiz.id}/slides/{slide.id}/content/")
    assert resp.status_code == 200
    assert resp.data["title"] == "Content title"
    assert resp.data["content_text"] == "Content body"
    assert resp.data["content_image_url"] == "http://example.com/content.png"


@pytest.mark.django_db
def test_content_update_persists_changes(api_client):
    owner = UserFactory()
    quiz = QuizFactory(owner=owner)
    slide = SlideFactory(
        quiz=quiz,
        slide_type=2,
        title="Old title",
        content_text="Old body",
        content_image_url=None,
    )

    api_client.force_authenticate(user=owner)
    resp = api_client.put(
        f"/api/quizzes/{quiz.id}/slides/{slide.id}/content/",
        {
            "title": "New title",
            "content_text": "New body",
            "content_image_url": "http://example.com/new.png",
        },
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["title"] == "New title"
    assert resp.data["content_text"] == "New body"
    assert resp.data["content_image_url"] == "http://example.com/new.png"

    slide.refresh_from_db()
    assert slide.title == "New title"
    assert slide.content_text == "New body"
    assert slide.content_image_url == "http://example.com/new.png"


@pytest.mark.django_db
def test_content_delete_clears_fields(api_client):
    owner = UserFactory()
    quiz = QuizFactory(owner=owner)
    slide = SlideFactory(
        quiz=quiz,
        slide_type=2,
        title="Content title",
        content_text="Content body",
        content_image_url="http://example.com/content.png",
    )

    api_client.force_authenticate(user=owner)
    resp = api_client.delete(f"/api/quizzes/{quiz.id}/slides/{slide.id}/content/")
    assert resp.status_code == 200
    assert resp.data["status"] == "content deleted"

    slide.refresh_from_db()
    assert slide.title is None
    assert slide.content_text is None
    assert slide.content_image_url is None
