# Rust Facade -> Django API Integration

This service talks to Django over HTTP. It does not use Django WebSockets.

## 1) Service token
Set a shared token in Django (and export it for the Rust process):
```
EXPORT_SERVICE_TOKEN=your-export-token
```

Rust must send this header on service calls:
```
X-Export-Token: your-export-token
```

## 2) Django API base URL
Export the API base URL for the Rust process:
```
DJANGO_API_BASE_URL=https://api.proslides.ir/api
```

You can also use a local API base, for example:
```
http://127.0.0.1:8000/api
```

## 3) Endpoints used by Rust

### A) Export quiz (used by Rust + React)
`GET /api/quizzes/{quiz_id}/export/`

- Auth: `X-Export-Token` OR JWT (owner)
- Example:
```
curl -H "X-Export-Token: your-export-token" \
  https://api.proslides.ir/api/quizzes/123/export/
```

### B) Submit leaderboard (Rust only)
`POST /api/quizzes/{quiz_id}/slides/{slide_id}/question/leaderboard/`

- Auth: `X-Export-Token` (service token)
- Body:
```json
{
  "leaderboard": [
    {
      "rust_session_id": "abc123",
      "player_name": "Ali",
      "avatar": "😀",
      "score": 1200,
      "time_taken": 2.4,
      "rank": 1
    }
  ]
}
```
- Example:
```
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Export-Token: your-export-token" \
  -d '{"leaderboard":[{"rust_session_id":"abc123","player_name":"Ali","avatar":"😀","score":1200,"time_taken":2.4,"rank":1}]}' \
  https://api.proslides.ir/api/quizzes/123/slides/456/question/leaderboard/
```

### C) Submit final option votes (Rust only)
`POST /api/quizzes/{quiz_id}/slides/{slide_id}/question/results/`

- Auth: `X-Export-Token` (service token)
- Body:
```json
{
  "options": [
    { "option_id": 111, "number_of_submits": 12 },
    { "option_id": 112, "number_of_submits": 4 }
  ]
}
```
- Example:
```
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Export-Token: your-export-token" \
  -d '{"options":[{"option_id":111,"number_of_submits":12},{"option_id":112,"number_of_submits":4}]}' \
  https://api.proslides.ir/api/quizzes/123/slides/456/question/results/
```

## 4) Notes
- Rust should not hardcode the API base in code; prefer a config/env value.
- If `EXPORT_SERVICE_TOKEN` is empty, service-token access is disabled.
