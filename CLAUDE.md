# PL Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory.
The user can carry out AI chat in order to establish what document they want and how to fill in the fields.
The available documents are covered in the catalog.json file in the project root, included here:

@catalog.json

The current implementation supports all 11 document types via AI chat with full user authentication and document persistence.

## Development process

When instructed to build a feature:
1. Use your Atlassian tools to read the feature instructions from Jira
2. Develop the feature - do not skip any step from the feature-dev 7 step process
3. Thoroughly test the feature with unit tests and integration tests and fix any issues
4. Submit a PR using your github tools

## AI design

When writing code to make calls to LLMs, use your Cerebras skill to use LiteLLM via OpenRouter to the `openrouter/openai/gpt-oss-120b` model with Cerebras as the inference provider. You should use Structured Outputs so that you can interpret the results and populate fields in the legal document.

There is an OPENROUTER_API_KEY in the .env file in the project root.

## Technical design

The entire project should be packaged into a Docker container.  
The backend should be in backend/ and be a uv project, using FastAPI.  
The frontend should be in frontend/  
The database should use SQLLite and be created from scratch each time the Docker container is brought up, allowing for a users table with sign up and sign in.  
Consider statically building the frontend and serving it via FastAPI, if that will work.  
There should be scripts in scripts/ for:  
```bash
# Mac
scripts/start-mac.sh    # Start
scripts/stop-mac.sh     # Stop

# Linux
scripts/start-linux.sh
scripts/stop-linux.sh

# Windows
scripts/start-windows.ps1
scripts/stop-windows.ps1
```
Backend available at http://localhost:8000

## Color Scheme
- Accent Yellow: `#ecad0a`
- Blue Primary: `#209dd7`
- Purple Secondary: `#753991` (submit buttons)
- Dark Navy: `#032147` (headings)
- Gray Text: `#888888`

## Implementation Status

### Completed (PL-2)
- Common Paper legal templates (13 markdown files, CC BY 4.0)

### Completed (PL-3)
- Next.js 16 prototype: Mutual NDA form with live preview and PDF download
- Vitest unit tests (55 passing) covering fill logic, date utils, term phrasing, PDF regression

### Completed (PL-4)
- V1 technical foundation:
  - `backend/` uv project with FastAPI + itsdangerous
  - SQLite `users` table, recreated on every container start
  - Fake login: any email + any password signs you in via signed cookie
  - `GET /api/auth/me`, `GET /api/auth/logout`
  - Next.js `output: 'export'`, static build served by FastAPI on port 8000
  - Docker multi-stage build (Node builder, Python runtime with uv)
  - `scripts/` start/stop wrappers for Mac, Linux, Windows

### Current API Endpoints
- `GET /login` - Fake login page (HTML)
- `POST /api/auth/login` - Accept any email/password, set signed session cookie, 303 to /
- `GET /api/auth/me` - JSON `{authenticated: bool, user_id?: int}`
- `GET /api/auth/logout` - Clear cookie, 303 to /login
- `GET /` - Serves Next.js landing if authed, else 303 to /login
- `GET /mutual-nda` - Next.js MNDA prototype page
- `GET /_next/*` - Next.js static assets

### Upcoming
- Real auth (signup/signin/JWT) — replaces fake login
- AI chat drafting — LiteLLM via OpenRouter/Cerebras (gpt-oss-120b)
- All 11 document types from catalog.json
- Document persistence (save/load to SQLite)