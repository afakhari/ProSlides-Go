import pytest
from rest_framework.test import APIClient

from django.conf import settings
from django.core import mail
from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone

from backend.srvs.office.office.models import EmailVerification
from backend.srvs.office.tests.factories import QuizFactory, UserFactory, SlideFactory


AUTH_VERIFY_SETTINGS = {
    **settings.REST_FRAMEWORK,
    "DEFAULT_THROTTLE_RATES": {
        **settings.REST_FRAMEWORK.get("DEFAULT_THROTTLE_RATES", {}),
        "auth_verify": "1000/min",
    },
}


@pytest.fixture(autouse=True)
def clear_throttle_cache():
    cache.clear()


@pytest.mark.django_db
def test_register_creates_user(api_client: APIClient):
    payload = {
        "username": "newuser",
        "email": "new@example.com",
        "password": "StrongPass!123",
        "full_name": "New User",
    }
    resp = api_client.post("/api/auth/register/", payload, format="json")
    assert resp.status_code == 201
    assert resp.data["username"] == "newuser"
    assert resp.data["is_active"] is False
    assert resp.data["verification_sent"] is True

    verification = EmailVerification.objects.filter(user__email="new@example.com").first()
    assert verification is not None
    assert verification.code is not None


@pytest.mark.django_db
def test_owner_can_list_own_quizzes(api_client: APIClient):
    owner = UserFactory()
    QuizFactory(owner=owner)
    api_client.force_authenticate(user=owner)

    resp = api_client.get("/api/quizzes/")
    assert resp.status_code == 200
    assert resp.data["count"] == 1
    assert len(resp.data["results"]) == 1


@pytest.mark.django_db
def test_non_owner_cannot_access_others_quiz(api_client: APIClient):
    owner = UserFactory()
    other = UserFactory()
    quiz = QuizFactory(owner=owner)

    api_client.force_authenticate(user=other)
    resp = api_client.get(f"/api/quizzes/{quiz.id}/")
    assert resp.status_code in (404, 403)


@pytest.mark.django_db
def test_non_owner_cannot_create_slide_on_foreign_quiz(api_client: APIClient):
    owner = UserFactory()
    other = UserFactory()
    quiz = QuizFactory(owner=owner)

    api_client.force_authenticate(user=other)
    resp = api_client.post(
        f"/api/quizzes/{quiz.id}/slides/",
        {"slide_type": 1, "order": 1},
        format="json",
    )
    assert resp.status_code in (404, 403)


@pytest.mark.django_db
@override_settings(EXPORT_SERVICE_TOKEN="test-export-token")
def test_export_requires_auth_or_service_token(api_client: APIClient):
    quiz = QuizFactory()
    SlideFactory(quiz=quiz, slide_type=1)

    resp = api_client.get(f"/api/quizzes/{quiz.id}/export/")
    assert resp.status_code in (401, 403)

    token_resp = api_client.get(
        f"/api/quizzes/{quiz.id}/export/",
        HTTP_X_EXPORT_TOKEN="test-export-token",
    )
    assert token_resp.status_code == 200

    api_client.force_authenticate(user=quiz.owner)
    resp_auth = api_client.get(f"/api/quizzes/{quiz.id}/export/")
    assert resp_auth.status_code == 200


@pytest.mark.django_db
@override_settings(REST_FRAMEWORK=AUTH_VERIFY_SETTINGS)
def test_verify_email_activates_user(api_client: APIClient):
    payload = {
        "username": "verifyuser",
        "email": "verify@example.com",
        "password": "StrongPass!123",
        "full_name": "Verify User",
    }
    resp = api_client.post("/api/auth/register/", payload, format="json")
    assert resp.status_code == 201

    verification = EmailVerification.objects.get(user__email="verify@example.com")
    verify_payload = {"email": "verify@example.com", "code": verification.code}
    verify_resp = api_client.post("/api/auth/verify/", verify_payload, format="json")
    assert verify_resp.status_code == 200

    verification.refresh_from_db()
    assert verification.is_verified is True
    assert verification.code is None


@pytest.mark.django_db
@override_settings(REST_FRAMEWORK=AUTH_VERIFY_SETTINGS)
def test_verify_email_rejects_wrong_code(api_client: APIClient):
    payload = {
        "username": "wrongcode",
        "email": "wrong@example.com",
        "password": "StrongPass!123",
        "full_name": "Wrong Code",
    }
    api_client.post("/api/auth/register/", payload, format="json")
    verification = EmailVerification.objects.get(user__email="wrong@example.com")

    verify_payload = {"email": "wrong@example.com", "code": "000000"}
    resp = api_client.post("/api/auth/verify/", verify_payload, format="json")
    assert resp.status_code == 400

    verification.refresh_from_db()
    assert verification.attempts == 1


@pytest.mark.django_db
@override_settings(REST_FRAMEWORK=AUTH_VERIFY_SETTINGS)
def test_verify_email_rejects_expired_code(api_client: APIClient):
    user = UserFactory(email="expired@example.com", is_active=False)
    user.save(update_fields=["is_active"])
    EmailVerification.objects.create(
        user=user,
        code="123456",
        expires_at=timezone.now() - timezone.timedelta(minutes=1),
    )
    resp = api_client.post(
        "/api/auth/verify/",
        {"email": "expired@example.com", "code": "123456"},
        format="json",
    )
    assert resp.status_code == 400
    assert resp.data["detail"] == "Verification code expired"


@pytest.mark.django_db
@override_settings(EMAIL_VERIFICATION_MAX_ATTEMPTS=2, REST_FRAMEWORK=AUTH_VERIFY_SETTINGS)
def test_verify_email_rejects_too_many_attempts(api_client: APIClient):
    user = UserFactory(email="locked@example.com", is_active=False)
    user.save(update_fields=["is_active"])
    EmailVerification.objects.create(
        user=user,
        code="654321",
        attempts=2,
        expires_at=timezone.now() + timezone.timedelta(minutes=5),
    )
    resp = api_client.post(
        "/api/auth/verify/",
        {"email": "locked@example.com", "code": "654321"},
        format="json",
    )
    assert resp.status_code == 429
    assert resp.data["detail"] == "Too many failed attempts"


@pytest.mark.django_db
@override_settings(REST_FRAMEWORK=AUTH_VERIFY_SETTINGS)
def test_verify_email_returns_already_verified(api_client: APIClient):
    user = UserFactory(email="active@example.com", is_active=True)
    resp = api_client.post(
        "/api/auth/verify/",
        {"email": "active@example.com", "code": "000000"},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["detail"] == "Email already verified"


@pytest.mark.django_db
def test_register_rejects_duplicate_email(api_client: APIClient):
    payload = {
        "username": "firstuser",
        "email": "dup@example.com",
        "password": "StrongPass!123",
        "full_name": "First User",
    }
    resp1 = api_client.post("/api/auth/register/", payload, format="json")
    assert resp1.status_code == 201

    payload2 = {
        "username": "seconduser",
        "email": "dup@example.com",
        "password": "StrongPass!123",
        "full_name": "Second User",
    }
    resp2 = api_client.post("/api/auth/register/", payload2, format="json")
    assert resp2.status_code == 400


@pytest.mark.django_db
@override_settings(AUTH_REQUIRE_EMAIL_VERIFICATION=False)
def test_register_without_email_verification_activates_user(api_client: APIClient):
    payload = {
        "username": "activeuser",
        "email": "active@example.com",
        "password": "StrongPass!123",
        "full_name": "Active User",
    }
    resp = api_client.post("/api/auth/register/", payload, format="json")
    assert resp.status_code == 201
    assert resp.data["is_active"] is True
    assert resp.data["verification_sent"] is False
    assert EmailVerification.objects.filter(user__email="active@example.com").exists() is False


@pytest.mark.django_db
@override_settings(REST_FRAMEWORK=AUTH_VERIFY_SETTINGS)
def test_resend_verification_unknown_email_returns_generic_success(api_client: APIClient):
    resp = api_client.post(
        "/api/auth/verify/resend/",
        {"email": "missing@example.com"},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["detail"] == "If the account exists, a code was sent."


@pytest.mark.django_db
@override_settings(REST_FRAMEWORK=AUTH_VERIFY_SETTINGS)
def test_resend_verification_rejects_verified_user(api_client: APIClient):
    user = UserFactory(email="verified@example.com", is_active=True)
    resp = api_client.post(
        "/api/auth/verify/resend/",
        {"email": user.email},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["detail"] == "Email already verified"


@pytest.mark.django_db
@override_settings(EMAIL_VERIFICATION_RESEND_SECONDS=300, REST_FRAMEWORK=AUTH_VERIFY_SETTINGS)
def test_resend_verification_rate_limited(api_client: APIClient):
    user = UserFactory(email="cooldown@example.com", is_active=False)
    user.save(update_fields=["is_active"])
    EmailVerification.objects.create(
        user=user,
        code="111111",
        expires_at=timezone.now() + timezone.timedelta(minutes=5),
    )
    resp = api_client.post(
        "/api/auth/verify/resend/",
        {"email": "cooldown@example.com"},
        format="json",
    )
    assert resp.status_code == 429
    assert resp.data["detail"] == "Please wait before requesting a new code."
    assert resp.data["retry_after_seconds"] >= 0
    assert resp.data["code_expires_in_seconds"] >= 0


@pytest.mark.django_db
@override_settings(
    EMAIL_VERIFICATION_RESEND_SECONDS=1,
    EMAIL_VERIFICATION_CODE_TTL_MINUTES=5,
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    REST_FRAMEWORK=AUTH_VERIFY_SETTINGS,
)
def test_resend_verification_issues_new_code(api_client: APIClient):
    user = UserFactory(email="resend@example.com", is_active=False)
    user.save(update_fields=["is_active"])
    verification = EmailVerification.objects.create(
        user=user,
        code="222222",
        expires_at=timezone.now() + timezone.timedelta(minutes=5),
        attempts=3,
    )
    EmailVerification.objects.filter(pk=verification.pk).update(
        sent_at=timezone.now() - timezone.timedelta(seconds=5)
    )
    resp = api_client.post(
        "/api/auth/verify/resend/",
        {"email": "resend@example.com"},
        format="json",
    )
    assert resp.status_code == 200
    verification.refresh_from_db()
    assert verification.code != "222222"
    assert verification.attempts == 0
    assert verification.is_verified is False
    assert resp.data["resend_seconds"] == 1
    assert resp.data["code_expires_in_seconds"] == 300


@pytest.mark.django_db
@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
def test_password_reset_flow(api_client: APIClient):
    user = UserFactory(email="reset@example.com")
    user.is_active = True
    user.set_password("OldStrongPass!123")
    user.save()

    resp = api_client.post(
        "/api/auth/password/reset/",
        {"email": "reset@example.com"},
        format="json",
    )
    assert resp.status_code == 200
    assert len(mail.outbox) == 1

    body = mail.outbox[0].body
    assert "reset-password" in body
    uid = body.split("uid=")[1].split("&")[0]
    token = body.split("token=")[1].split()[0]

    confirm = api_client.post(
        "/api/auth/password/reset/confirm/",
        {"uid": uid, "token": token, "new_password": "NewStrongPass!123"},
        format="json",
    )
    assert confirm.status_code == 200

    login = api_client.post(
        "/api/auth/token/",
        {"username": user.username, "password": "NewStrongPass!123"},
        format="json",
    )
    assert login.status_code == 200


@pytest.mark.django_db
def test_logout_blacklists_refresh_token(api_client: APIClient):
    user = UserFactory()
    user.is_active = True
    user.set_password("StrongPass!123")
    user.save()

    login = api_client.post(
        "/api/auth/token/",
        {"username": user.username, "password": "StrongPass!123"},
        format="json",
    )
    assert login.status_code == 200
    refresh = login.data["refresh"]

    api_client.force_authenticate(user=user)
    logout = api_client.post("/api/auth/logout/", {"refresh": refresh}, format="json")
    assert logout.status_code == 200

    refresh_resp = api_client.post(
        "/api/auth/token/refresh/",
        {"refresh": refresh},
        format="json",
    )
    assert refresh_resp.status_code == 401
