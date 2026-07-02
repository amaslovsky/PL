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
npm test                   # Jest one-shot (all tests; jsdom under the hood)
npm run test:run           # alias of npm test
npx jest src/__tests__/AuthContext.test.tsx    # single test file
npx jest -t "signout"                          # single test by name
```

Jest + jsdom owns all tests under `src/__tests__/**` (React component tests and pure logic in one runner). See `frontend/TESTING.md` for the manual checklist of what unit tests do NOT cover (PDF bytes, hydration, dev-server routing).

### Backend (`cd backend`)

`backend/` is a `uv` project (`pyproject.toml` + `uv.lock`). Dependencies are pinned — use `uv sync --frozen` to install, not `pip install`. The backend is laid out flat at `backend/` root (no `app/` package) so the entry module is `main`, not `app.main`.

```bash
uv sync --extra dev                      # install deps + pytest (creates .venv)
uv run --extra dev pytest                # run backend tests (pytest is in [project.optional-dependencies].dev)
uv run uvicorn main:app --reload         # dev server (rarely needed — Docker is the default)
uv add <pkg>                             # add a runtime dep
uv add --optional dev <pkg>              # add a dev dep (use this for pytest, etc.)
```

### Environment

- `.env` in project root (gitignored) supplies `SECRET_KEY` and `OPENROUTER_API_KEY`. See `.env.example`.
- Backend reads: `SECRET_KEY` (default `"dev-secret-key-change-in-production"`), `DB_PATH` (default `/app/data/app.db`), `STATIC_DIR` (resolves to `frontend/out` relative to the repo root; the `/_next` mount only happens when that directory exists), `COOKIE_SECURE` (`1` to set the session cookie `Secure` flag — required behind HTTPS).

## Architecture

### Two-process app behind one container

- **Frontend** is a Next.js 16 app built with `output: 'export'` (`frontend/next.config.ts`). The build emits plain HTML/JS into `frontend/out`, which is then copied into the Python image and served as static files by FastAPI. There is no Next.js server in the runtime container.
- **Backend** is a layered FastAPI app (`backend/main.py` + `routes/` + `services/` + `models/` + `core/`). Auth uses `python-jose` for JWT signing and `passlib`'s `CryptContext(schemes=["bcrypt"])` for password hashing. The `access_token` cookie is a HS256 JWT with `{sub: str(user_id), email, exp}` payload and a 7-day expiry (`ACCESS_TOKEN_EXPIRE_MINUTES=60*24*7`). Login verifies the bcrypt hash via `passlib`'s context.
- **DB** is SQLite at `$DB_PATH`. SQLAlchemy 2.0 (declarative) owns the `users` (`id`, `email`, `hashed_password`) and `documents` (`user_id`, `document_type`, `title`, `form_data`, `created_at`, `updated_at`) tables. `engine` is created with `connect_args={"check_same_thread": False}` for FastAPI's threadpool. `database.init_db()` calls `Base.metadata.create_all(bind=engine)` on FastAPI `lifespan` startup, and the container's entrypoint deletes the file on every start so the schema is fresh (matches PL-7's "database can be temporary" note).

### Auth

Real auth lives in `backend/routes/auth.py`. `POST /api/auth/signup` hashes the password and inserts a user row; `POST /api/auth/signin` reads the row and verifies via `passlib`. Both responses set the `access_token` JWT cookie (HttpOnly, 7-day expiry) and return `AuthResponse{user: {id, email}, message}`. Passwords must be at least 8 chars (Pydantic validator). Duplicate email returns 409. `GET /api/auth/me` resolves the JWT to a user row and returns `UserResponse{id, email}`. Routes use `Depends(get_current_user)` (defined in `backend/core/dependencies.py`) — it reads the `access_token` cookie via FastAPI's `Cookie(...)` parameter rather than manual `request.cookies.get`.

The SPA reads auth state through `frontend/src/contexts/AuthContext.tsx` — an `AuthProvider` mounted in `frontend/src/app/layout.tsx` calls `getMe()` on mount and exposes `{user: User | null, loading: boolean, signin, signup, signout, refreshUser}` via `useAuth()`. The `Header` is a client component that reads `useAuth()` instead of fetching `/api/auth/me` itself. Keeping this client-only avoids `headers()` in the root layout, which would break `output: "export"`.

### Static-asset routing precedence

`/_next/*` is mounted as a `StaticFiles` directory. Everything else falls through to `get_spa`, which tries `<path>`, `<path>.html`, then `<path>/index.html` from `STATIC_DIR`, finally returning `index.html` for SPA routing. The `/_next` mount MUST be registered before the `/{full_path:path}` catch-all or it loses to the path parameter. There is no FastAPI `/login` route anymore — that path is served by the SPA catch-all.

### Mutual NDA prototype (PL-3 + PL-5)

- `app/mutual-nda/page.tsx` (server component) reads `frontend/templates/mutual-nda.md` and `frontend/templates/mutual-nda-coverpage.md` from disk at build time and passes the raw markdown to `components/NdaWorkspace.tsx` (`'use client'`).
- `lib/fillTemplate.ts` does literal string substitution on the markdown — NOT regex on user-supplied values. String-form `.replace()` interprets `$&`, `$1`, `$$` in the replacement as backreferences; the substitution code uses function replacements (`() => …`) precisely to avoid that. This is the rule to follow for any new field.
- Two checkbox pairs on the cover page (MNDA Term, Term of Confidentiality) are rewritten as a single `if/else` against the full multi-line regex match so the invariant `exactly one [x] per pair` cannot be violated.
- `<label>…</label>` tags from the Common Paper source are stripped in `fillFullNda` (regression-tested) before render.
- `pdf/NdaPdfDocument.tsx` renders the same data via `@react-pdf/renderer` to a downloadable Blob. `pdf/pdfStyles.ts` is a string-prefix sentinel — a Vitest test asserts no `pdfStyles.` substring leaks into rendered text.
- **PL-5 (chat-driven drafting):** `NdaWorkspace` is a two-column chat | preview UI. The form is gone. Each user turn hits `POST /api/chat`, which calls the LLM and returns `{fields, assistant_message}`; the returned `fields` flow straight into `fillFullNda` so the preview and PDF download work unchanged.

### Multi-document surface (PL-6 → PL-8)

PL-6 shipped a per-doc route `/documents/[id]` with a closest-match fallback for unwired templates. PL-8 simplified this dramatically: the chat workspace is now a single two-column page at `/` and the LLM picks the template from the user's freeform message. Per-doc URLs and `/mutual-nda` are thin client-side redirects.

- `frontend/src/utils/documentConfig.ts` is the FE source of truth for the 11 templates (id, displayName, description, optional coverPageFilename / standardTermsFilename for templates with checked-in markdown). Pure data, no React.
- `frontend/src/app/page.tsx` (server component) reads every registered `standardTermsFilename` and `coverPageFilename` at build time and ships the markdown to the client. `frontend/src/components/Workspace.tsx` (`'use client'`) is the chat | preview UI — default document type is MNDA, and the right pane swaps between MNDA live preview (via `fillFullNda`) and any other template's standard-terms markdown as the LLM picks a new `documentType`.
- `frontend/src/app/documents/[type]/page.tsx` and `frontend/src/app/mutual-nda/page.tsx` both call `redirect("/")` from a server component. `generateStaticParams` enumerates the 11 slugs so static export ships a `NEXT_REDIRECT` HTML file per slug; unknown ids fall through to the SPA 404.
- `frontend/src/components/Chat.tsx` (PL-6, kept) hosts `MessageBubble` and `ThinkingBubble` so the chat column renders identically regardless of which template is active.
- `backend/models/documents.py` mirrors the FE registry (id, display_name, description). `routes/chat.py`'s `POST /api/chat/message` accepts `{messages}` and returns `{response, documentType?, suggestedDocument?, ...per-doc-fields...}`; the BE always invokes the LLM and the LLM returns the slug it picked (so the FE swaps the right pane). PL-8 removed the static-fallback path that PL-6 had for non-MNDA ids. `GET /api/chat/greeting` returns a static greeting (no LLM call).
- `backend/services/ai_service.py` generates a system prompt from `REGISTRY` on every call so the LLM sees the full template list each turn. Per-doc fields are flattened in the response (`party1Name`, `effectiveDate`, `mndaTermType`, etc.) with an optional `formData` bag for anything that doesn't fit a top-level field.

### Saved drafts (PL-7)

- `POST /api/documents` validates `body.document_type` against `is_known()` (`backend/models/documents.py`) and `body.data` against the per-doc Pydantic schema — today that's `NdaFields` (re-used as both the LLM response shape and the storage validation). New docs hang their own schema off the registry in PL-7+.
- `data` is stored as JSON in `documents.form_data`; the server doesn't second-guess the shape on read.
- `Workspace` ships a `Save draft` button next to `Start over`. `DocumentDownload` accepts an `onBeforeDownload` hook that the workspace passes its `saveDraft` to, so PDFs always end up listed on `/my-documents`.
- `/my-documents` is a client-rendered page (no `headers()` on the server) that calls `/api/documents` and lists the signed-in user's drafts.

### Templates

`frontend/templates/` holds checked-in copies of the two MNDA markdown files (hermetic build). The canonical sources live in `templates/` at the project root, listed by `catalog.json` (CC BY 4.0 from Common Paper). Adding a new document type = adding entries to `catalog.json` and `templates/`, plus a new fill function in `lib/` that follows the literal-substitution rule above.

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory.
The user can carry out AI chat in order to establish what document they want and how to fill in the fields.
The available documents are covered in the catalog.json file in the project root, included here:

@catalog.json

The chat surface at `/` knows all 11 registered documents (Common Paper templates, CC BY 4.0). The LLM picks the template from the user's freeform message and the right pane swaps between the MNDA live preview and any other template's standard-terms markdown. Served behind real auth (email + bcrypt password, 7-day session cookie). Drafts save to a per-user SQLite table so the user can return to them via `/my-documents`. The disclaimer footer and chrome appear on every page. `/documents/<id>` and `/mutual-nda` are thin redirects to `/`.

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

### Completed (PL-9, superseded by PL-10)
- Architectural restructure to match the prelegal reference repo's layered shape (idiomatic FastAPI Depends, SQLAlchemy 2.0 ORM, JWT in HttpOnly cookie, AuthContext). PL-10 realigned the file naming + cookie name + JWT payload + auth response shape + chat endpoints + test runner to match prelegal more precisely; the architectural shape PL-9 introduced is unchanged.

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
- Multi-doc routing surface with closest-match fallback for unwired templates (superseded by PL-8 — kept here for history):
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
- `GET /api/health` - `{"status": "healthy"}`. Used by smoke tests.
- `POST /api/auth/signup` - Body `{email, password}`. Bcrypt-hashes the password (via passlib), inserts the user, sets the `access_token` JWT cookie, returns `AuthResponse{user: {id, email}, message}`. 409 on duplicate email; 422 on password < 8 chars.
- `POST /api/auth/signin` - Body `{email, password}`. Verifies credentials, sets the cookie, returns `AuthResponse`. 401 on bad credentials.
- `POST /api/auth/signout` - Clears the cookie, returns `{message}`.
- `GET /api/auth/me` - Returns `UserResponse{id, email}`. 401 if no cookie or invalid JWT.
- `GET /api/chat/greeting` - Returns the static greeting (no LLM call). Shape mirrors `ChatResponse` with the assistant message in `response`.
- `POST /api/chat/message` - Body: `{messages: [{role, content}]}`. Returns `ChatResponse{response, documentType?, suggestedDocument?, party1Name?, party2Name?, effectiveDate?, governingLaw?, jurisdiction?, mndaTermType?, mndaTermYears?, confidentialityTermType?, confidentialityTermYears?, formData?}`. 401 if unauthenticated. Every call invokes `gpt-oss-120b` with a system prompt that enumerates all 11 templates — the BE has no static fallback path.
- `GET /api/documents` - Lists the signed-in user's saved drafts (newest first). Returns `{documents: SavedDocument[]}`. 401 if unauthenticated.
- `POST /api/documents` - Body `{document_type: str, title: str, data: dict}`. Validates against the per-doc schema (`NdaFields` for MNDA today; other types skip schema validation). 422 on MNDA schema failure, 400 on unknown type.
- `GET /api/documents/<id>` - Single document. 404 if missing or not the owner.
- `PUT /api/documents/<id>` - Updates the document's form_data.
- `DELETE /api/documents/<id>` - Removes the document. 404 if missing or not the owner.
- `GET /` - Serves Next.js chat workspace (`/`) if authed, else 303 to /login. Two-column chat | preview; right pane swaps between MNDA live preview and any other template's standard-terms markdown as the LLM switches.
- `GET /documents/<id>` - Thin client-side redirect to `/`; one HTML file per registered slug (11 today). Unknown slugs fall through to the SPA 404.
- `GET /login` - SPA sign-in screen (Next.js).
- `GET /signup` - SPA sign-up screen (Next.js).
- `GET /my-documents` - SPA drafts list, client-side fetch via cookie.
- `GET /mutual-nda` - Thin client-side redirect to `/`.
- `GET /_next/*` - Next.js static assets (only mounted when `frontend/out` exists)

### Upcoming
- Per-template schemas for the 10 non-MNDA documents so the live preview + chat fields work the way MNDA does today.
- Password recovery flow (no SMTP today).
- Re-opening a saved draft into the chat workspace (the `/my-documents` `Open` link currently just sends the user back to `/` without rehydrating state).

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

### Completed (PL-8)
- Chat-first home, all 11 templates first-class:
  - `frontend/app/page.tsx` — server component reads every registered template's markdown at build time and ships it to the client.
  - `frontend/components/Workspace.tsx` (new) — two-column chat | preview, default MNDA. Right pane swaps live between MNDA live preview (`fillFullNda` + `NdaPreview` + `DownloadPdfButton`) and any other template's standard-terms markdown as the LLM returns a new `document_type`. The chat thread drives the switch.
  - `frontend/app/documents/[type]/page.tsx` and `frontend/app/mutual-nda/page.tsx` — both call `redirect("/")`; `generateStaticParams` enumerates the 11 registry slugs so static export ships a `NEXT_REDIRECT` HTML file per slug.
  - `frontend/components/NdaWorkspace.tsx`, `UnsupportedDocWorkspace.tsx`, `frontend/lib/documents/wiring.ts`, `frontend/lib/documents/aliases.test.ts`, `frontend/app/_docRender.tsx` — deleted (no longer needed; the universal Workspace replaces them).
  - `frontend/components/Header.tsx` — email becomes a clickable dropdown menu (caret rotates when open). Click-outside and Escape both close the dropdown; menu items close it before navigating. "Documents" nav link renamed "New draft".
  - `backend/app/ai.py` — `ChatTurn.document_type: str` added to the structured-output schema; `fields` widened to `dict` (MNDA-shaped only when `document_type == "mnda"`). The system prompt is generated from `REGISTRY` on every call (`_catalog_block`), so the LLM always sees the full template list.
  - `backend/app/documents.py` — flattened: dropped `wired`, `closest_match`, `is_supported`, `fallback_message`. `is_known()` remains. The BE always invokes the LLM; the static-fallback path is gone.
  - `backend/app/main.py` — `ChatRequest.document_type` is now optional (`str | None = None`); no behavioral branch on it (LLM response carries the chosen slug back). `POST /api/documents` and `PUT` use `is_known()` instead of `is_supported()`; only MNDA gets per-doc schema validation today.
- 7 new tests: 3 BE (registry size + unique ids + unknown-type rejection), 3 FE (`postChat` request/response shape, no-hint omits `document_type`, hint is forwarded), 1 BE chat smoke. Total suite 62 FE + 21 BE = 83 passing.
- Static export builds clean: 18 routes (same route count as PL-7; `/documents/<id>` is now a redirect file per slug and `/mutual-nda` is a redirect page). Manual smoke checklist expanded in `frontend/TESTING.md` to cover the chat-first home, the Header dropdown, and the redirect routes.

### Implementation Update
- **Match prelegal layout (2026-07-02, PL-10):** Realigned the FE and BE shape to mirror the `ed-donner/prelegal` reference repo. **Frontend**: collapsed everything under `frontend/src/` — `app/`, `components/`, `contexts/`, `services/`, `types/`, `utils/` — replacing the previous split (root `app/`/`components/`/`lib/`/`pdf/` plus a tiny `src/`). Renamed `lib/types.ts` to `types/nda.ts`, `lib/api.ts` to `services/api.ts` (now exports `getGreeting`/`sendMessage`/`signUp`/`signIn`/`signOut`/`getMe`/`saveDocument`/`deleteSavedDocument`/`listSavedDocuments` matching prelegal), and split logic utils into `utils/{date,terms,fillTemplate,documentConfig}.ts`. **Backend**: swapped direct `bcrypt` for `passlib[bcrypt]`, switched env var from `JWT_SECRET` to `SECRET_KEY`, renamed cookie from `pl_session` to `access_token`, updated JWT payload to `{sub: str(user_id), email, exp}` (prelegal shape), widened `get_current_user` to read the cookie via FastAPI's `Cookie(...)` parameter, and split the chat endpoint into `GET /api/chat/greeting` (static text) + `POST /api/chat/message` (LLM call returning `ChatResponse{response, documentType?, suggestedDocument?, ...flat per-doc fields, formData?}`). Health check now returns `{"status": "healthy"}`. `STATIC_DIR` resolves to `frontend/out` relative to the repo root; `/_next` mount is conditional. Auth responses reshaped from `{authenticated, user_id, email}` to `AuthResponse{user: {id, email}, message}`. **Test runner**: Vitest removed; Jest + jsdom owns everything. Suite 47 FE Jest + 23 BE = 70 passing; static export still ships 18 routes.
- **Architectural restructure (2026-07-02, PL-9):** Replaced the flat `backend/app/` package + itsdangerous signed cookies + raw `sqlite3` with a layered FastAPI app (`main.py` + `routes/` + `services/` + `models/` + `core/`), JWT in HttpOnly cookie (python-jose HS256, 7-day), and SQLAlchemy 2.0 declarative models. Frontend gained `<AuthProvider>` (read via `useAuth()` by `Header` and other consumers), Jest + jsdom for component tests alongside Vitest for pure-logic, and a split Workspace (`<ChatInterface>` + `<DocumentPreview>` dispatcher with `<NDAPreview>` and `<StandardTermsPreview>` children). BE catalog loaded at import time from project-root `catalog.json` with a slug override (`mutual-nda` -> `mnda`); FE registry stays hand-authored with a hardcoded `BE_IDS` drift check. Suite 63 FE Vitest + 8 FE Jest + 26 BE = 97 passing; static export still ships 18 routes; container smoke-test confirms signup → JWT cookie (three base64url segments) → `/api/auth/me` 200 → chat picks MNDA → save/list/delete documents all work.
- **Chat-first home + all 11 templates in LLM memory (2026-07-01, PL-8):** Replaced the PL-6 card-grid landing and per-doc workspaces with a single two-column chat | preview surface at `/`. The LLM now sees every template on every call (system prompt generated from the registry) and picks one freely per turn; the client follows its lead and swaps the right pane between MNDA live preview and the chosen template's standard-terms markdown. `/documents/<id>` and `/mutual-nda` are thin `redirect("/")` pages. Header email became a clickable dropdown menu (caret rotates; outside-click and Escape both close it). Dropped the PL-6 `wired` / `closestMatch` / `fallbackMessage` plumbing across both FE and BE. Suite 62 FE + 21 BE = 83 passing; static export still ships 18 routes; container smoke-test confirms chat correctly picks CSA / MNDA from freeform user messages.
- **Multiple users & final polish (2026-07-01, PL-7):** Replaced fake login with bcrypt-hashed email+password sign-up/sign-in; added per-user document storage behind `GET/POST/PUT/DELETE /api/documents`; added `/login`, `/signup`, `/my-documents` SPA routes plus a global `Header`/`Footer` and a tinted disclaimer banner on the preview pane. The `Download PDF` button auto-saves the draft before downloading, so every PDF also shows up on `/my-documents`. Data validation on `POST/PUT /api/documents` re-uses the per-doc Pydantic schema (today `NdaFields`); unsupported types get 400, schema failures get 422. Auth flows tested at 8 BE + 7 BE = 15; api-helper plumbing tested at 4 FE. Suite now 66 FE + 23 BE = 89 passing; static export produces 18 routes.
- **Multi-document surface (2026-07-01, PL-6):** Lifted the chat surface from MNDA-only to all 11 registered documents via a `DocumentRegistry` and one dynamic route (`/documents/[type]`) with `generateStaticParams`. The other 10 entries get an `UnsupportedDocWorkspace` that explains the closest wired match in the right pane and keeps the chat functional; the backend returns `{fields: null, assistant_message: <static>}` for any non-MNDA `document_type` (no LLM call). `/mutual-nda` alias kept as a thin render-path wrapper. New pytest dev group added in `[project.optional-dependencies].dev` so Docker's `uv sync --frozen --no-dev` stays slim. Test suite at 61 FE + 8 BE = 69 passing (14 new FE + 8 new BE); static export produces 11 doc HTML files plus the alias; container smoke-test confirms MNDA chat still works, `/documents/csa` returns the static fallback message, unknown ids receive a generic fallback.
- **AI chat (2026-07-01, PL-5):** Form-driven MNDA prototype replaced with a freeform chat. Backend `POST /api/chat` calls `gpt-oss-120b` via LiteLLM + Cerebras using structured outputs and returns the current best-guess values for every MNDA field plus a short assistant reply. The returned fields flow into the existing `fillFullNda` + `NdaPdfDocument` pipeline — preview and PDF download unchanged. Test suite at 47/47 passing; static export builds clean; container rebuilds and the chat endpoint returns the expected structured payload end-to-end. Merged to `main` as commit `44f078c` (no-ff merge of `feature/PL-5-ai-chat` `51707cf`).
- **MNDA polish (2026-07-01, PL-4):** `<label>` tags stripped in `fillFullNda` (covered by a regression test); workspace redesigned with independent vertical scrolling per column, light-gray page background, white rounded cards, and improved text styles. Test suite at 51/51 passing; static export builds clean. Merged to `main` as commit `1784564` (no-ff merge of `feature/PL-4-foundation` `8923a15`).