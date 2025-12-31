# ProSlides Local Setup (Frontend Team)

This guide is for running the backend API locally so the frontend can consume it.

## 1) Get the right branch
Auth endpoints exist only on `feature/auth-permissions`.
```
git checkout feature/auth-permissions
```

## 2) Requirements
- Python 3.13+
- Git
- (Windows) PowerShell or CMD

## 3) Create and activate a virtual environment
PowerShell:
```
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

CMD:
```
python -m venv .venv
.venv\Scripts\activate
```

## 4) Install dependencies
If you use `uv`:
```
uv sync
```

With pip:
```
python -m pip install -U pip
python -m pip install -e .
```

## 5) Environment variables
Copy `.env.example` to `.env` and adjust as needed:
```
copy .env.example .env
```

Minimum suggested values for local dev:
```
DEBUG=True
DJANGO_SETTINGS_MODULE=backend.srvs.office.office.settings
ALLOWED_HOSTS=127.0.0.1,localhost
CORS_ALLOWED_ORIGINS=http://127.0.0.1:3000,http://localhost:3000
EXPORT_SERVICE_TOKEN=dev-export-token
GOOGLE_CLIENT_ID=your-google-client-id
```

Email behavior:
- For console output (fast local dev):
  ```
  EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
  ```
- For real SMTP, fill in `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`,
  and set `EMAIL_USE_TLS=True` (or `EMAIL_USE_SSL=True`).

## 6) Run migrations
```
python backend/srvs/office/manage.py migrate
```

## 7) Run the server
```
python backend/srvs/office/manage.py runserver 127.0.0.1:8000
```

## 8) Frontend setup (Vite)
From the repo root:
```
cd frontend
```

Create `frontend/.env` with:
```
VITE_API_BASE_URL=http://127.0.0.1:8000/api
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

Install dependencies and run:
```
npm install
npm run dev
```

## Rust service token (export + leaderboard)
Rust can request quiz export and submit leaderboard updates by sending:
```
X-Export-Token: dev-export-token
```
If `EXPORT_SERVICE_TOKEN` is empty, service-token access is disabled.

For full Rust facade integration details, see `RUST_FACADE_SETUP.md`.

## 9) Swagger and base URLs
- Swagger UI: `http://127.0.0.1:8000/swagger`
- API base: `http://127.0.0.1:8000/api/`

## 10) Quick auth flow test
1) Register:
   `POST /api/auth/register`
   ```json
   {"username":"testuser","email":"test@example.com","password":"StrongPass123!"}
   ```
2) Verify email (get code from console or SMTP):
   `POST /api/auth/verify`
   ```json
   {"email":"test@example.com","code":"123456"}
   ```
3) Login:
   `POST /api/auth/token`
   ```json
   {"username":"testuser","password":"StrongPass123!"}
   ```

## 11) Seed demo data (optional)
Generate demo quizzes, slides, players, and leaderboard entries:
```
python backend/srvs/office/manage.py seed_bulk --flush --quizzes 20 --slides-per-quiz 10 --players-per-quiz 30 --leaderboard-per-question 20
```
Note: `--flush` wipes the database.

Seed all quizzes under a single owner (recommended for frontend testing):
```
python backend/srvs/office/manage.py seed_bulk --flush --single-owner --owner-username demo_owner --owner-email owner@example.com --owner-password password123
```
Login with:
- username: `demo_owner`
- password: `password123`

## Troubleshooting
- ModuleNotFoundError: make sure the venv is activated.
- No email code shown: set `EMAIL_BACKEND` to console backend and restart the server.
- Port already in use: choose another port, e.g. `127.0.0.1:8001`.
