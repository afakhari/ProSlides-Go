# Deployment (Django backend)

This project does not ship a production container or process manager. Use a
WSGI/ASGI server and your hosting provider's process tooling.

## 1) Install dependencies
From the repo root:
```
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

If you use `uv`:
```
uv sync
```

With pip:
```
python -m pip install -U pip
python -m pip install -e .
```

## 2) Configure environment
`env.read_env()` loads `.env` automatically. Start from `.env.example` and set
production values. Make sure your process has these variables set before it
starts (systemd, container env, hosting dashboard, etc).

Minimum required for production:
```
DEBUG=False
SECRET_KEY=change-me
ALLOWED_HOSTS=your.domain,api.your.domain
DJANGO_SETTINGS_MODULE=backend.srvs.office.office.settings.prod
EXPORT_SERVICE_TOKEN=change-me-export-token
GOOGLE_CLIENT_ID=your-google-client-id
```

Email + OTP (verification) settings:
```
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.example.com
EMAIL_PORT=465
EMAIL_HOST_USER=your_username
EMAIL_HOST_PASSWORD=your_password
EMAIL_USE_SSL=True
EMAIL_USE_TLS=False
DEFAULT_FROM_EMAIL=no-reply@your.domain
PASSWORD_RESET_URL_TEMPLATE=https://your.domain/reset-password?uid={uid}&token={token}
```

OTP behavior controls (optional, defaults in code):
```
EMAIL_VERIFICATION_CODE_TTL_MINUTES=10
EMAIL_VERIFICATION_RESEND_SECONDS=60
EMAIL_VERIFICATION_MAX_ATTEMPTS=5
AUTH_REQUIRE_EMAIL_VERIFICATION=True
```

Other optional production settings:
```
CORS_ALLOW_ALL_ORIGINS=False
CORS_ALLOW_CREDENTIALS=False
LOG_LEVEL=INFO
```

Frontend build env (set in your frontend hosting):
```
VITE_API_BASE_URL=https://api.your.domain/api
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

## Rust service token (export + leaderboard)
Rust can request quiz export and submit leaderboard updates by sending:
```
X-Export-Token: change-me-export-token
```
If `EXPORT_SERVICE_TOKEN` is empty, service-token access is disabled.

Notes:
- `ALLOWED_HOSTS` is a comma-separated list.
- For production, `DEBUG` must be `False`.
- Database settings are not env-driven; defaults to SQLite at
  `backend/srvs/office/db.sqlite3`. Update `backend/srvs/office/office/settings/base.py`
  if you need Postgres/MySQL.
- These are the only Django-related env vars read by this service (per
  `backend/srvs/office/office/settings/base.py` and `prod.py`).

## 3) Run migrations
Run from the repo root so Django can resolve `backend.*` imports. If your
process cannot run from the repo root, set `PYTHONPATH` to the repo root.
```
python backend/srvs/office/manage.py migrate
```

## 4) Start the server
The Django entrypoints are:
- WSGI: `backend.srvs.office.office.wsgi:application`
- ASGI: `backend.srvs.office.office.asgi:application`

Example (Gunicorn, install separately):
```
gunicorn backend.srvs.office.office.wsgi:application --bind 0.0.0.0:8000
```

Example (Uvicorn, install separately):
```
uvicorn backend.srvs.office.office.asgi:application --host 0.0.0.0 --port 8000
```

## 5) One-time admin tasks (optional)
Create a Django admin user:
```
python backend/srvs/office/manage.py createsuperuser
```

If you need static assets (Django admin UI):
```
python backend/srvs/office/manage.py collectstatic
```

## 6) Seed demo data (optional)
This loads bulk demo quizzes and related data. Use only on staging or when you
explicitly want demo data in production.

PowerShell:
```
$env:PYTHONPATH=(Get-Location).Path
$env:DJANGO_SETTINGS_MODULE="backend.srvs.office.office.settings.prod"
python backend/srvs/office/manage.py seed_bulk
```

Bash:
```
export PYTHONPATH="$(pwd)"
export DJANGO_SETTINGS_MODULE=backend.srvs.office.office.settings.prod
python backend/srvs/office/manage.py seed_bulk
```

Full seed with database reset (DANGEROUS):
```
python backend/srvs/office/manage.py seed_bulk --flush --quizzes 20 --slides-per-quiz 10 --players-per-quiz 30 --leaderboard-per-question 20
```

## 7) Verify
- Swagger UI: `http://<host>:8000/swagger`
- API base: `http://<host>:8000/api/`

## Notes
- Django static assets are not configured for production. If you need the admin
  UI, set `STATIC_ROOT` and run `collectstatic`, or serve static assets via your
  hosting platform.
