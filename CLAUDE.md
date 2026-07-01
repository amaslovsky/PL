# PL Project

## Commands

All commands are run from the project root unless noted.

### Docker (full stack, port 8000)

```bash
./scripts/start-mac.sh    # Mac — docker compose up -d --build
./scripts/stop-mac.sh     # Mac — docker compose down
./scripts/start-linux.sh  # Linux
./scripts/stop-linux.sh
./scripts/start-windows.ps1   # Windows PowerShell
./scripts/stop-windows.ps1
```

The container drops `/app/data/app.db` on every start, so the schema is rebuilt from scratch (see `Dockerfile` `CMD`).

### Frontend (`cd frontend`)

```bash
npm install                # one-time
npm run dev                # http://localhost:3000 (no backend)
npm run build              # produces frontend/out (static export)
npm run lint               # ESLint
npm run typecheck          # tsc --noEmit
npm test                   # Vitest watch mode
npm run test:run           # Vitest one-shot
npx vitest run lib/fillTemplate.test.ts   # single test file
npx vitest -t "strips label"              # single test by name
```

Vitest is scoped to `lib/**/*.test.ts` and `pdf/**/*.test.ts` in `node` env (no jsdom, no React Testing Library). See `frontend/TESTING.md` for the manual checklist of what unit tests do NOT cover (component rendering, PDF bytes, hydration, dev-server routing).

### Backend (`cd backend`)

`backend/` is a `uv` project (`pyproject.toml` + `uv.lock`). Dependencies are pinned — use `uv sync --frozen` to install, not `pip install`.

```bash
uv sync --extra dev                      # install deps + pytest (creates .venv)
uv run --extra dev pytest                # run backend tests (pytest is in [project.optional-dependencies].dev)
uv run uvicorn app.main:app --reload     # dev server (rarely needed — Docker is the default)
uv add <pkg>                             # add a runtime dep
uv add --optional dev <pkg>              # add a dev dep (use this for pytest, etc.)
```

### Environment

- `.env` in project root (gitignored) supplies `SECRET_KEY` and `OPENROUTER_API_KEY`. See `.env.example`.
- Backend reads: `SECRET_KEY`, `DB_PATH` (default `/app/data/app.db`), `STATIC_DIR` (default `/app/static`), `COOKIE_SECURE` (`1` to set the session cookie `Secure` flag — required behind HTTPS).

## Architecture

### Two-process app behind one container

- **Frontend** is a Next.js 16 app built with `output: 'export'` (`frontend/next.config.ts`). The build emits plain HTML/JS into `frontend/out`, which is then copied into the Python image and served as static files by FastAPI. There is no Next.js server in the runtime container.
- **Backend** is a FastAPI app (`backend/app/main.py`) using `itsdangerous` for signed cookies and `bcrypt` for password hashing. The cookie value is a `URLSafeTimedSerializer`-signed `{uid}` payload with a 7-day max age. Passwords are stored as bcrypt hashes; login verifies via `bcrypt.checkpw`.
- **DB** is SQLite at `$DB_PATH`. The `users(id, email UNIQUE, password_hash, created_at)` and `documents(id, user_id, document_type, data_json, created_at, updated_at)` tables are created by `init_db()` on FastAPI `lifespan` startup, and the container's entrypoint deletes the file on every start so the schema is fresh (matches PL-7's "database can be temporary" note).

### Auth

Real auth lives in `backend/app/auth.py`. `POST /api/auth/signup` hashes the password and inserts a user row; `POST /api/auth/login` reads the row and `bcrypt.checkpw`s. Both responses set the `pl_session` cookie. Passwords must be at least 8 chars (Pydantic validator). Duplicate email returns 409. `GET /api/auth/me` resolves the cookie to a user row and returns `{authenticated, user_id, email}`; this is what the SPA `Header` uses to render email + sign-out. The `Header` is a client component calling `/api/auth/me` on mount — keeping it client-only avoids `headers()` in the root layout, which would break `output: "export"`.

### Static-asset routing precedence

`/_next/*` is mounted as a `StaticFiles` directory. Everything else falls through to `get_spa`, which tries `<path>`, `<path>.html`, then `<path>/index.html` from `STATIC_DIR`, finally returning `index.html` for SPA routing. The `/_next` mount MUST be registered before the `/{full_path:path}` catch-all or it loses to the path parameter. There is no FastAPI `/login` route anymore — that path is served by the SPA catch-all.

### Mutual NDA prototype (PL-3 + PL-5)

- `app/mutual-nda/page.tsx` (server component) reads `frontend/templates/mutual-nda.md` and `frontend/templates/mutual-nda-coverpage.md` from disk at build time and passes the raw markdown to `components/NdaWorkspace.tsx` (`'use client'`).
- `lib/fillTemplate.ts` does literal string substitution on the markdown — NOT regex on user-supplied values. String-form `.replace()` interprets `$&`, `$1`, `$$` in the replacement as backreferences; the substitution code uses function replacements (`() => …`) precisely to avoid that. This is the rule to follow for any new field.
- Two checkbox pairs on the cover page (MNDA Term, Term of Confidentiality) are rewritten as a single `if/else` against the full multi-line regex match so the invariant `exactly one [x] per pair` cannot be violated.
- `<label>…</label>` tags from the Common Paper source are stripped in `fillFullNda` (regression-tested) before render.
- `pdf/NdaPdfDocument.tsx` renders the same data via `@react-pdf/renderer` to a downloadable Blob. `pdf/pdfStyles.ts` is a string-prefix sentinel — a Vitest test asserts no `pdfStyles.` substring leaks into rendered text.
- **PL-5 (chat-driven drafting):** `NdaWorkspace` is a two-column chat | preview UI. The form is gone. Each user turn hits `POST /api/chat`, which calls the LLM and returns `{fields, assistant_message}`; the returned `fields` flow straight into `fillFullNda` so the preview and PDF download work unchanged.

### Multi-document surface (PL-6)

- `frontend/lib/documents/registry.ts` is the FE source of truth for which documents the app routes the user to. 11 entries today (one per unique slug; the MNDA cover page is folded under MNDA). Each entry carries `wired: boolean`, `closestMatch: DocId`, and (when wired) template filenames. The `ALIASES` map links colloquial names (HIPAA → BAA, SOW → PSA, MOU → MNDA, …) to registry slugs.
- `frontend/lib/documents/wiring.ts` attaches React components to each entry (`Workspace` for wired, `Unsupported` for the rest). Pure data lives in `registry.ts` so it unit-tests without React.
- `frontend/app/documents/[type]/page.tsx` is a single dynamic route. `generateStaticParams` enumerates `listDocuments()` at build time so static export ships an HTML file per registered slug. Unknown slugs 404 via `notFound()`. The shared `app/_docRender.tsx` helper does the disk read for wired docs and dispatches to the right workspace component.
- `frontend/app/mutual-nda/page.tsx` is a thin alias of the same render path — no redirect, no middleware.
- `frontend/components/UnsupportedDocWorkspace.tsx` mirrors the two-column MNDA shell for unwired docs. The chat still works; every reply is the BE's static fallback. The right pane is a tinted yellow notice with a link to the closest wired match.
- `backend/app/documents.py` mirrors the registry (id, display_name, wired, closest_match). `app/main.py`'s `POST /api/chat` reads an optional `document_type` field; non-MNDA ids return `{fields: null, assistant_message: <static fallback>}` without calling the LLM. PL-7+ will introduce per-doc schemas and call the LLM for additional types.

### Saved drafts (PL-7)

- `POST /api/documents` validates `body.document_type` against `is_supported()` (`backend/app/documents.py`) and `body.data` against the per-doc Pydantic schema — today that's `NdaFields` (re-used as both the LLM response shape and the storage validation). New docs hang their own schema off the registry in PL-7+.
- `data` is stored as JSON in `documents.data_json`; the server doesn't second-guess the shape on read.
- `NdaWorkspace` ships a `Save draft` button next to `Start over`. `DownloadPdfButton` accepts an `onBeforeDownload` hook that the workspace passes its `saveDraft` to, so PDFs always end up listed on `/my-documents`.
- `/my-documents` is a client-rendered page (no `headers()` on the server) that calls `/api/documents` and lists the signed-in user's drafts.

### Templates

`frontend/templates/` holds checked-in copies of the two MNDA markdown files (hermetic build). The canonical sources live in `templates/` at the project root, listed by `catalog.json` (CC BY 4.0 from Common Paper). Adding a new document type = adding entries to `catalog.json` and `templates/`, plus a new fill function in `lib/` that follows the literal-substitution rule above.

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory.
The user can carry out AI chat in order to establish what document they want and how to fill in the fields.
The available documents are covered in the catalog.json file in the project root, included here:

@catalog.json

The chat surface is routed to all 11 registered documents via `/documents/<id>`; today only the Mutual NDA is wired (full AI chat → live preview → PDF download), the other 10 reply with a static closest-match fallback message. Served behind real auth (email + bcrypt password, 7-day session cookie). Drafts save to a per-user SQLite table so the user can return to them via `/my-documents`. The disclaimer footer and chrome appear on every page.

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
- Vitest unit tests (51 passing; 50 baseline + 1 label-strip regression) covering fill logic, date utils, term phrasing, PDF regression
- (Form UI superseded by PL-5; `NdaForm.tsx` and `lib/defaultValues.ts` removed)

### Completed (PL-4)
- V1 technical foundation:
  - `backend/` uv project with FastAPI + itsdangerous
  - SQLite `users` table, recreated on every container start
  - Fake login: any email + any password signs you in via signed cookie
  - `GET /api/auth/me`, `GET /api/auth/logout`
  - Next.js `output: 'export'`, static build served by FastAPI on port 8000
  - Docker multi-stage build (Node builder, Python runtime with uv)
  - `scripts/` start/stop wrappers for Mac, Linux, Windows
- MNDA workspace polish:
  - `<label>` annotation tags stripped from Common Paper source before render
  - Independent vertical scrolling for form and preview panes (fixed-height page, each column scrolls inside its own card)
  - Light-gray page background, white rounded cards with subtle shadow
  - Improved text styles: relaxed leading, prose-zinc preview, soft-tinted party fieldsets

### Completed (PL-5)
- AI chat drives the MNDA prototype (form removed):
  - `backend/app/ai.py` — LiteLLM wrapper, `gpt-oss-120b` via Cerebras. Pydantic `ChatTurn` schema = `{fields, assistant_message}` with `Literal` modes and `ge=1/le=99` on year counts.
  - `POST /api/chat` — session-cookie gated; module-scope fail-fast if `OPENROUTER_API_KEY` is unset.
  - `frontend/components/NdaWorkspace.tsx` — chat | preview layout. Synchronous `useRef` in-flight flag prevents double-click races; on error the optimistic user message rolls back so the failed turn doesn't sit in the chat silently.
  - `frontend/lib/api.ts` — small fetch helper.
- Test suite at 47/47 passing (defaultValues tests dropped alongside the form).
- Merged to `main` as commit `44f078c` (no-ff merge of `feature/PL-5-ai-chat` `51707cf`).

### Completed (PL-6)
- Multi-doc routing surface with closest-match fallback for unwired templates:
  - `frontend/lib/documents/registry.ts` — 11-entry registry (MNDA cover page folded under MNDA). One source of truth for display name, description, wiring flag, and closest-match slug. Pure data, no React imports.
  - `frontend/lib/documents/wiring.ts` — attaches `NdaWorkspace` to MNDA and `UnsupportedDocWorkspace` to the other 10 entries.
  - `frontend/app/documents/[type]/page.tsx` — single dynamic route. `generateStaticParams` enumerates the registry at build time; static export ships 11 HTML files.
  - `frontend/app/_docRender.tsx` — shared server-component dispatcher: reads template markdown for wired docs, mounts the closest-match notice for the rest.
  - `frontend/app/mutual-nda/page.tsx` — thin alias to the same render path.
  - `frontend/components/UnsupportedDocWorkspace.tsx` — two-column shell (chat left, closest-match notice right). Chat still works; every reply is the BE's static fallback.
  - `frontend/app/page.tsx` — registry-driven landing picker (one card per entry, MNDA has no pill, others show a yellow "coming soon" badge).
  - `frontend/components/Chat.tsx` — `MessageBubble` and `ThinkingBubble` extracted from the inline JSX in `NdaWorkspace` so both workspaces share chat styling.
  - `backend/app/documents.py` — `DocEntry` dataclass + 11-entry REGISTRY dict + `is_supported` and `fallback_message` helpers.
  - `backend/app/main.py` — `ChatRequest.document_type` field (defaults to `"mnda"` for back-compat); `/api/chat` returns `{fields: null, assistant_message: ...}` for any non-MNDA id without invoking the LLM.
  - `backend/pyproject.toml` — `[project.optional-dependencies].dev` adds `pytest>=8.0.0` so the runtime Docker image stays slim (`uv sync --frozen --no-dev` in the Dockerfile skips it).
- 22 new tests: 14 in FE (registry, aliases, api), 8 in BE (registry); total suite 61 FE + 8 BE = 69 passing.
- Static export builds clean: 11 document HTML files plus the `/mutual-nda` alias.
- Smoke-tested end-to-end via Docker: landing shows 11 cards; `/documents/mnda` drafts via LLM; `/documents/cloud-service-agreement` returns the static fallback message with closest-match link to MNDA.

### Current API Endpoints
- `POST /api/auth/signup` - Body `{email, password}`. Bcrypt-hashes the password, inserts the user, sets the `pl_session` cookie. 409 on duplicate email; 422 on password < 8 chars.
- `POST /api/auth/login` - Body `{email, password}`. Verifies credentials, sets the cookie. 401 on bad credentials.
- `GET /api/auth/me` - JSON `{authenticated: bool, user_id?: int, email?: str}`. 401 if no cookie.
- `POST /api/auth/logout` - Clears the cookie, returns `{ok: true}`.
- `POST /api/chat` - Body: `{messages: [{role, content}], document_type?: str}`. Returns `{fields: NdaFormData | null, assistant_message: str}`. 401 if unauthenticated. `document_type` defaults to `"mnda"`; any other id triggers a static fallback response (no LLM call).
- `GET /api/documents` - Lists the signed-in user's saved drafts (newest first). 401 if unauthenticated.
- `POST /api/documents` - Body `{document_type: str, data: dict}`. Validates against the per-doc schema (`NdaFields` for MNDA today). 422 on schema failure, 400 on unsupported type.
- `GET /api/documents/<id>` - Single document. 404 if missing or not the owner.
- `PUT /api/documents/<id>` - Updates the document's data_json.
- `DELETE /api/documents/<id>` - Removes the document. 404 if missing or not the owner.
- `GET /` - Serves Next.js landing if authed, else 303 to /login
- `GET /documents/<id>` - One HTML file per registered slug (11 today); MNDA wires the chat workspace, others show the closest-match notice.
- `GET /login` - SPA sign-in screen (Next.js).
- `GET /signup` - SPA sign-up screen (Next.js).
- `GET /my-documents` - SPA drafts list, client-side fetch via cookie.
- `GET /mutual-nda` - Alias of `/documents/mnda`; renders the same MNDA workspace.
- `GET /_next/*` - Next.js static assets

### Upcoming
- Additional wired documents (PL-7+). The 10 unwired catalog entries are routed via `/documents/<id>` and answered with a closest-match message; wire each one in its own PR by adding its cover page + standard terms to `templates/` and `frontend/templates/`, extending the FE registry, and (if needed) the BE registry + chat schemas.
- Password recovery flow (no SMTP today).
- Re-opening a saved draft into the chat workspace (the `/my-documents` `Open` link currently just sends the user back to `/documents/<id>` without rehydrating state).

### Completed (PL-7)
- Real auth (replaces the PL-4 fake login):
  - `backend/app/auth.py` — bcrypt password hashing + verifying via `hash_password` / `verify_password`. `authenticate(email, password) -> int | None` looks up the user and checks the hash. `find_user_by_email` / `find_user_by_id` added in `backend/app/db.py` for `/api/auth/me` to surface the email.
  - `POST /api/auth/signup` and `POST /api/auth/login` switched from form-encoded to JSON; both set the same `pl_session` cookie on success. `signup` returns 409 on duplicate email, 422 on password < 8 chars. `login` returns 401 on bad creds. `logout` clears the cookie.
  - The server-rendered `/login` HTML (`backend/app/login_page.py`) was removed; `/login`, `/signup`, `/my-documents` are now SPA routes (Next.js, static-exported).
- Document storage:
  - `documents(user_id, document_type, data_json, created_at, updated_at)` SQLite table + index on `user_id`. Schema lives in `init_db()` (DB is wiped on container start, matching the PL-7 description).
  - `POST /api/documents`, `GET /api/documents`, `GET /api/documents/<id>`, `PUT /api/documents/<id>`, `DELETE /api/documents/<id>`. Data is validated against the per-doc Pydantic schema (`NdaFields` for MNDA today; other entries will add their own schema in PL-7+).
  - `NdaWorkspace` gets a "Save draft" button next to "Start over". `DownloadPdfButton` accepts an `onBeforeDownload` hook and the workspace passes its `saveDraft` to it, so PDF downloads automatically persist the latest `data`.
- Final polish:
  - Global `Header` (logo + Documents + My drafts nav + email/Sign out) and `Footer` (disclaimer line) components, mounted in `frontend/app/layout.tsx` so every page renders chrome.
  - `Download PDF` button now uses the project blue (`#209dd7`) instead of `bg-blue-600` to match the design tokens.
  - Disclaimer banner ("Draft template only — not legal advice. Subject to legal review before use.") appears above the preview pane in `NdaWorkspace` and as the footer copy on every page.
- 22 new tests: 8 BE auth (signup/login/me/logout happy paths + 409/401/422 edges), 7 BE documents (auth required, list/get cross-user 404, delete, schema validation 422, unsupported type 400), 7 FE api helpers (signUp, signIn, saveDocument, listSavedDocuments wiring); total suite 66 FE + 23 BE = 89 passing.
- Static export builds clean: 18 routes prerendered (4 new: `/login`, `/signup`, `/my-documents`; previously 14). Manual smoke checklist extended in `frontend/TESTING.md`.

### Implementation Update
- **Multiple users & final polish (2026-07-01, PL-7):** Replaced fake login with bcrypt-hashed email+password sign-up/sign-in; added per-user document storage behind `GET/POST/PUT/DELETE /api/documents`; added `/login`, `/signup`, `/my-documents` SPA routes plus a global `Header`/`Footer` and a tinted disclaimer banner on the preview pane. The `Download PDF` button auto-saves the draft before downloading, so every PDF also shows up on `/my-documents`. Data validation on `POST/PUT /api/documents` re-uses the per-doc Pydantic schema (today `NdaFields`); unsupported types get 400, schema failures get 422. Auth flows tested at 8 BE + 7 BE = 15; api-helper plumbing tested at 4 FE. Suite now 66 FE + 23 BE = 89 passing; static export produces 18 routes.
- **Multi-document surface (2026-07-01, PL-6):** Lifted the chat surface from MNDA-only to all 11 registered documents via a `DocumentRegistry` and one dynamic route (`/documents/[type]`) with `generateStaticParams`. The other 10 entries get an `UnsupportedDocWorkspace` that explains the closest wired match in the right pane and keeps the chat functional; the backend returns `{fields: null, assistant_message: <static>}` for any non-MNDA `document_type` (no LLM call). `/mutual-nda` alias kept as a thin render-path wrapper. New pytest dev group added in `[project.optional-dependencies].dev` so Docker's `uv sync --frozen --no-dev` stays slim. Test suite at 61 FE + 8 BE = 69 passing (14 new FE + 8 new BE); static export produces 11 doc HTML files plus the alias; container smoke-test confirms MNDA chat still works, `/documents/csa` returns the static fallback message, unknown ids receive a generic fallback.
- **AI chat (2026-07-01, PL-5):** Form-driven MNDA prototype replaced with a freeform chat. Backend `POST /api/chat` calls `gpt-oss-120b` via LiteLLM + Cerebras using structured outputs and returns the current best-guess values for every MNDA field plus a short assistant reply. The returned fields flow into the existing `fillFullNda` + `NdaPdfDocument` pipeline — preview and PDF download unchanged. Test suite at 47/47 passing; static export builds clean; container rebuilds and the chat endpoint returns the expected structured payload end-to-end. Merged to `main` as commit `44f078c` (no-ff merge of `feature/PL-5-ai-chat` `51707cf`).
- **MNDA polish (2026-07-01, PL-4):** `<label>` tags stripped in `fillFullNda` (covered by a regression test); workspace redesigned with independent vertical scrolling per column, light-gray page background, white rounded cards, and improved text styles. Test suite at 51/51 passing; static export builds clean. Merged to `main` as commit `1784564` (no-ff merge of `feature/PL-4-foundation` `8923a15`).