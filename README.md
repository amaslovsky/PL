# PL

A platform for drafting common legal agreements.

> In progress. This project is under active development; expect incomplete features, breaking changes, and limited documentation until V1 ships.

## Running locally

Prerequisites: Docker Desktop (Mac/Windows) or Docker Engine + Compose v2 (Linux).

```bash
# Mac / Linux
./scripts/start-mac.sh        # or start-linux.sh
# Visit http://localhost:8000 — you'll be redirected to /login.
# Enter any email and any password to sign in.

./scripts/stop-mac.sh

# Windows (PowerShell)
.\scripts\start-windows.ps1
.\scripts\stop-windows.ps1
```

For frontend-only dev work (no backend), `cd frontend && npm run dev` and visit http://localhost:3000.

## Layout

- `frontend/` — Next.js 16 prototype (Mutual NDA creator).
- `backend/` — FastAPI service (uv-managed) for auth, DB, and static serving.
- `templates/` — Common Paper markdown templates (CC BY 4.0).
- `scripts/` — Start/stop wrappers around `docker compose`.
- `Dockerfile`, `docker-compose.yml` — Container packaging.

## Roadmap

- V1 foundation (auth, static export, scripts)
- AI-assisted drafting chat
- Document persistence and history
- Cover pages for all 11 agreement types
