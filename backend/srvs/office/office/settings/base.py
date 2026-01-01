from pathlib import Path
from email.utils import formataddr

from environs import Env

env = Env()
env.read_env()

# Base paths
BASE_DIR = Path(__file__).resolve().parents[2]

# Security
SECRET_KEY = env.str(
    "SECRET_KEY", default="django-insecure-82s@p*pkocb%%s6cvx_irf%=8bpa2_xgge825ixjf(jro%84%q"
)
DEBUG = env.bool("DEBUG", False)
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["*"])
EXPORT_SERVICE_TOKEN = env.str("EXPORT_SERVICE_TOKEN", default="")
GOOGLE_CLIENT_ID = env.str("GOOGLE_CLIENT_ID", default="")

# Application definition
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "backend.srvs.office.office.apps.OfficeConfig",
    "drf_yasg",
    "corsheaders",
    "rest_framework",
    "django_filters",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "backend.srvs.office.office.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "backend.srvs.office.office.wsgi.application"
ASGI_APPLICATION = "backend.srvs.office.office.asgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Email defaults
EMAIL_BACKEND = env.str(
    "EMAIL_BACKEND",
    default="django.core.mail.backends.console.EmailBackend" if DEBUG else "django.core.mail.backends.smtp.EmailBackend",
)
DEFAULT_FROM_EMAIL = env.str("DEFAULT_FROM_EMAIL", default="no-reply@proslides.ir")
SERVER_EMAIL = env.str("SERVER_EMAIL", default=DEFAULT_FROM_EMAIL)
EMAIL_FROM_NAME = env.str("EMAIL_FROM_NAME", default="ProSlides")
EMAIL_FROM_ADDRESS = formataddr((EMAIL_FROM_NAME, DEFAULT_FROM_EMAIL))
EMAIL_HOST = env.str("EMAIL_HOST", default="localhost")
EMAIL_PORT = env.int("EMAIL_PORT", default=25)
EMAIL_HOST_USER = env.str("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env.str("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=False)
EMAIL_USE_SSL = env.bool("EMAIL_USE_SSL", default=False)

# Email verification policy
EMAIL_VERIFICATION_CODE_TTL_MINUTES = env.int(
    "EMAIL_VERIFICATION_CODE_TTL_MINUTES", default=10
)
EMAIL_VERIFICATION_RESEND_SECONDS = env.int(
    "EMAIL_VERIFICATION_RESEND_SECONDS", default=60
)
EMAIL_VERIFICATION_MAX_ATTEMPTS = env.int(
    "EMAIL_VERIFICATION_MAX_ATTEMPTS", default=5
)
AUTH_REQUIRE_EMAIL_VERIFICATION = env.bool(
    "AUTH_REQUIRE_EMAIL_VERIFICATION", default=True
)
PASSWORD_RESET_URL_TEMPLATE = env.str(
    "PASSWORD_RESET_URL_TEMPLATE",
    default="https://proslides.ir/reset-password?uid={uid}&token={token}",
)

# DRF defaults
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.ScopedRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "anon": "60/min",
        "user": "120/min",
        "auth": "10/min",
        "auth_verify": "6/min",
        "password_reset": "5/min",
    },
    "DEFAULT_PAGINATION_CLASS": "backend.srvs.office.office.pagination.StandardResultsSetPagination",
    "PAGE_SIZE": 20,
}

# SimpleJWT (defaults؛ قابل تنظیم با env)
from datetime import timedelta  # noqa: E402

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
    "AUTH_HEADER_TYPES": ("Bearer",),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}

# CORS (development default; can be overridden per environment)
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
    CORS_ALLOW_CREDENTIALS = True

# Logging configuration: console-only by default; override handlers in env/prod
LOG_LEVEL = env.str("LOG_LEVEL", "INFO")
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "[{levelname}] {asctime} {name}: {message}",
            "style": "{",
        },
        "simple": {
            "format": "[{levelname}] {name}: {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": LOG_LEVEL,
    },
    "loggers": {
        "django": {"handlers": ["console"], "level": LOG_LEVEL, "propagate": False},
    },
}

# Swagger UI compatibility settings
SWAGGER_USE_COMPAT_RENDERERS = False

SWAGGER_SETTINGS = {
    "SECURITY_DEFINITIONS": {
        "Bearer": {
            "type": "apiKey",
            "name": "Authorization",
            "in": "header",
            "description": 'JWT Authorization header using the Bearer scheme. Example: "Authorization: Bearer <token>"',
        }
    },
    "USE_SESSION_AUTH": False,
    "DOC_EXPANSION": "none",
    "PERSIST_AUTH": True,
    "TAGS": [
        {"name": "Auth", "description": "Authentication, verification, and recovery"},
        {"name": "Quizzes", "description": "Quiz management and metadata"},
        {"name": "Slides", "description": "Slide CRUD and ordering"},
        {"name": "Questions", "description": "Question CRUD for slides"},
        {"name": "Options", "description": "Answer options for questions"},
        {"name": "Leaderboard", "description": "Leaderboard ingest and aggregation"},
        {"name": "Players", "description": "Player session management"},
        {"name": "Content", "description": "Content-only slides"},
    ],
}
