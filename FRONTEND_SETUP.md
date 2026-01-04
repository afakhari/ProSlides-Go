# Frontend Setup (Vite)

This frontend uses Vite and expects a small set of env vars.
For a full architecture overview and service-to-service communication,
see `SYSTEM_OVERVIEW.md`.

## 1) Install dependencies
From the repo root:
```
cd frontend
npm install
```

## 2) Create frontend env
Create `frontend/.env`:
```
VITE_API_BASE_URL=http://127.0.0.1:8000/api
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

Notes:
- For production, set `VITE_API_BASE_URL` to your deployed API base.
- `VITE_GOOGLE_CLIENT_ID` must match the Google OAuth Client ID.
- If the frontend is local and the backend is remote, ensure the backend allows
  CORS/CSRF from `http://localhost:5173`.

For local dev, you can also copy:
```
copy frontend/.env.development.example frontend/.env
```

## 3) Run the dev server
```
npm run dev
```

## 4) Build for production
```
npm run build
```
