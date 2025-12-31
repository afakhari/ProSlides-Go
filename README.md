# ProSlides
a live interactive quiz

## Local Setup
See `LOCAL_SETUP.md` for a step-by-step guide for running the backend locally.

## Frontend Setup
See `FRONTEND_SETUP.md` for how to run the Vite frontend locally.

## Rust Facade
See `RUST_FACADE_SETUP.md` for service-token setup and the Django endpoints used by the Rust WebSocket facade.

## Deployment
See `DEPLOYMENT.md` for how to run the Django backend in production.

## Frontend API requests
Use the shared `apiFetch` helper so base URL selection and auth headers stay consistent.

Example:
```javascript
import { apiFetch } from "./utils/apiFetch";

const res = await apiFetch("/quizzes/", {
  method: "POST",
  json: { title: "Untitled" },
});

await apiFetch("/auth/token/", {
  method: "POST",
  auth: false,
  json: { username, password },
});
```

## Seed Demo Data

This project provides a management command to generate bulk demo data.

### Prerequisites
- Activate the virtual environment.
- Set `PYTHONPATH` to the project root.

### Run (Windows PowerShell)
```powershell
$env:PYTHONPATH=(Get-Location).Path
.\.venv\Scripts\python backend/srvs/office/manage.py seed_bulk
```

### Full seed with database reset
```powershell
$env:PYTHONPATH=(Get-Location).Path
.\.venv\Scripts\python backend/srvs/office/manage.py seed_bulk --flush --quizzes 20 --slides-per-quiz 10 --players-per-quiz 30 --leaderboard-per-question 20
```

### Options
- `--flush`: delete all data before seeding.
- `--owners`: number of demo owners to create (if Quiz has `owner`).
- `--quizzes`: number of quizzes.
- `--slides-per-quiz`: number of slides per quiz.
- `--content-ratio`: fraction of content slides (0-1).
- `--options-per-question`: number of options per question.
- `--players-per-quiz`: number of player sessions per quiz.
- `--leaderboard-per-question`: leaderboard rows per question.
- `--seed`: random seed for deterministic data.

Note: `--flush` wipes the database. Use it only in development.
