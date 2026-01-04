import pytest
from rest_framework.test import APIClient
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from django.core import mail
from django.test import override_settings

from backend.srvs.office.tests.factories import UserFactory


@pytest.mark.django_db
def test_login_rejects_inactive_user(api_client: APIClient):
    user = UserFactory()
    user.is_active = False
    user.set_password("StrongPass!123")
    user.save(update_fields=["is_active", "password"])

    resp = api_client.post(
        "/api/auth/token/",
        {"username": user.username, "password": "StrongPass!123"},
        format="json",
    )
    assert resp.status_code == 401


@pytest.mark.django_db
def test_logout_requires_refresh_token(api_client: APIClient):
    user = UserFactory()
    api_client.force_authenticate(user=user)

    resp = api_client.post("/api/auth/logout/", {}, format="json")
    assert resp.status_code == 400
    assert resp.data["detail"] == "refresh token is required"


@pytest.mark.django_db
def test_logout_rejects_invalid_refresh_token(api_client: APIClient):
    user = UserFactory()
    api_client.force_authenticate(user=user)

    resp = api_client.post("/api/auth/logout/", {"refresh": "bad-token"}, format="json")
    assert resp.status_code == 400
    assert resp.data["detail"] == "Invalid token"


@pytest.mark.django_db
def test_token_refresh_rejects_invalid_token(api_client: APIClient):
    resp = api_client.post(
        "/api/auth/token/refresh/",
        {"refresh": "invalid-token"},
        format="json",
    )
    assert resp.status_code == 401


@pytest.mark.django_db
def test_password_reset_rejects_invalid_uid(api_client: APIClient):
    resp = api_client.post(
        "/api/auth/password/reset/confirm/",
        {"uid": "not-a-uid", "token": "fake", "new_password": "StrongPass!123"},
        format="json",
    )
    assert resp.status_code == 400
    assert resp.data["detail"] == "Invalid token"


@pytest.mark.django_db
def test_password_reset_rejects_invalid_token(api_client: APIClient):
    user = UserFactory()
    user.is_active = True
    user.set_password("StrongPass!123")
    user.save(update_fields=["is_active", "password"])

    uid = urlsafe_base64_encode(force_bytes(user.pk))
    resp = api_client.post(
        "/api/auth/password/reset/confirm/",
        {"uid": uid, "token": "invalid", "new_password": "StrongPass!123"},
        format="json",
    )
    assert resp.status_code == 400
    assert resp.data["detail"] == "Invalid token"


@pytest.mark.django_db
@pytest.mark.parametrize(
    "password, expected_message",
    [
        ("", "This field may not be blank."),
        ("short7", "Use at least 8 characters."),
        ("12345678", "Password cannot be all numbers."),
    ],
)
def test_register_password_policy(api_client: APIClient, password, expected_message):
    payload = {
        "username": "policyuser",
        "email": "policy@example.com",
        "password": password,
        "full_name": "Policy User",
    }
    resp = api_client.post("/api/auth/register/", payload, format="json")
    assert resp.status_code == 400
    assert expected_message in resp.data["password"][0]


@pytest.mark.django_db
def test_login_returns_profile_fields(api_client: APIClient):
    user = UserFactory(first_name="Parsa")
    user.is_active = True
    user.set_password("StrongPass!123")
    user.save(update_fields=["is_active", "password", "first_name"])

    resp = api_client.post(
        "/api/auth/token/",
        {"username": user.username, "password": "StrongPass!123"},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["email"] == user.email
    assert resp.data["full_name"] == "Parsa"
    assert resp.data["needs_password_setup"] is False
    assert "access" in resp.data
    assert "refresh" in resp.data


@pytest.mark.django_db
@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
def test_password_reset_does_not_email_inactive_user(api_client: APIClient):
    user = UserFactory(email="inactive@example.com")
    user.is_active = False
    user.save(update_fields=["is_active"])

    resp = api_client.post(
        "/api/auth/password/reset/",
        {"email": "inactive@example.com"},
        format="json",
    )
    assert resp.status_code == 200
    assert len(mail.outbox) == 0
