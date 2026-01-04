import pytest

from backend.srvs.office.tests.factories import QuizFactory, PlayerSessionFactory, UserFactory


@pytest.mark.django_db
@pytest.mark.filterwarnings("ignore::django.core.paginator.UnorderedObjectListWarning")
def test_player_session_create_and_list_scoped_to_owner(api_client):
    owner = UserFactory()
    other = UserFactory()
    quiz = QuizFactory(owner=owner)
    other_quiz = QuizFactory(owner=other)

    api_client.force_authenticate(user=owner)
    create_resp = api_client.post(
        "/api/player-sessions/",
        {"rust_session_id": "session-123", "quiz": quiz.id, "player_name": "Player", "avatar": "A"},
        format="json",
    )
    assert create_resp.status_code == 201

    PlayerSessionFactory(quiz=other_quiz)

    list_resp = api_client.get("/api/player-sessions/?page_size=10")
    assert list_resp.status_code == 200
    assert list_resp.data["count"] == 1
    assert len(list_resp.data["results"]) == 1

    create_resp = api_client.post(
        "/api/player-sessions/",
        {"rust_session_id": "session-999", "quiz": other_quiz.id, "player_name": "Other", "avatar": "B"},
        format="json",
    )
    assert create_resp.status_code in (404, 403)


@pytest.mark.django_db
def test_player_sessions_require_auth(api_client):
    quiz = QuizFactory()
    resp = api_client.get("/api/player-sessions/")
    assert resp.status_code == 401

    resp = api_client.post(
        "/api/player-sessions/",
        {"rust_session_id": "session-123", "quiz": quiz.id, "player_name": "Player", "avatar": "A"},
        format="json",
    )
    assert resp.status_code == 401


@pytest.mark.django_db
def test_player_session_accepts_user_id_alias(api_client):
    owner = UserFactory()
    quiz = QuizFactory(owner=owner)
    api_client.force_authenticate(user=owner)

    resp = api_client.post(
        "/api/player-sessions/",
        {"user_id": "legacy-123", "quiz": quiz.id, "player_name": "Legacy", "avatar": "L"},
        format="json",
    )
    assert resp.status_code == 201
    assert resp.data["rust_session_id"] == "legacy-123"


@pytest.mark.django_db
def test_player_session_rejects_missing_session_id(api_client):
    owner = UserFactory()
    quiz = QuizFactory(owner=owner)
    api_client.force_authenticate(user=owner)

    resp = api_client.post(
        "/api/player-sessions/",
        {"quiz": quiz.id, "player_name": "NoId", "avatar": "N"},
        format="json",
    )
    assert resp.status_code == 400
    assert "rust_session_id" in resp.data
