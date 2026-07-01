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
- **Backend** is a FastAPI app (`backend/app/main.py`) using `itsdangerous` for signed cookies. The cookie value is a `URLSafeTimedSerializer`-signed `{uid}` payload with a 7-day max age.
- **DB** is SQLite at `$DB_PATH`. The `users` table is the only schema today; `init_db()` runs on FastAPI `lifespan` startup, and the container's entrypoint deletes the file on every start so the schema is fresh.

### Fake auth (will be replaced)

Any email + any password is accepted by `POST /api/auth/login`. The email is upserted into `users` and the resulting id is signed into the `pl_session` cookie. `GET /api/auth/me` returns `{authenticated, user_id?}`; the SPA uses it to gate `/`. This is a placeholder for real auth (signup/signin/JWT) — keep all auth logic in `backend/app/auth.py` so the swap is local.

### Static-asset routing precedence

`/login` and the auth API are real FastAPI routes. `/_next/*` is mounted as a `StaticFiles` directory. Everything else falls through to `get_spa`, which tries `<path>`, `<path>.html`, then `<path>/index.html` from `STATIC_DIR`, finally returning `index.html` for SPA routing. The `/_next` mount MUST be registered before the `/{full_path:path}` catch-all or it loses to the path parameter.

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

### Templates

`frontend/templates/` holds checked-in copies of the two MNDA markdown files (hermetic build). The canonical sources live in `templates/` at the project root, listed by `catalog.json` (CC BY 4.0 from Common Paper). Adding a new document type = adding entries to `catalog.json` and `templates/`, plus a new fill function in `lib/` that follows the literal-substitution rule above.

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory.
The user can carry out AI chat in order to establish what document they want and how to fill in the fields.
The available documents are covered in the catalog.json file in the project root, included here:

@catalog.json

The current implementation supports one document type (Mutual NDA) via an AI chat prototype with live preview and PDF download, served behind fake login. The remaining 11 templates, real auth, and document persistence are not yet wired up.

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
- `GET /login` - Fake login page (HTML)
- `POST /api/auth/login` - Accept any email/password, set signed session cookie, 303 to /
- `GET /api/auth/me` - JSON `{authenticated: bool, user_id?: int}`
- `POST /api/auth/logout` - Clear cookie, 303 to /login
- `POST /api/chat` - Body: `{messages: [{role, content}], document_type?: str}`. Returns `{fields: NdaFormData | null, assistant_message: str}`. 401 if unauthenticated. `document_type` defaults to `"mnda"`; any other id triggers a static fallback response (no LLM call).
- `GET /` - Serves Next.js landing if authed, else 303 to /login
- `GET /documents/<id>` - Document picker route (PL-6). One HTML file per registered slug (11 today); MNDA wires the chat workspace, others show the closest-match notice.
- `GET /mutual-nda` - Alias of `/documents/mnda`; renders the same MNDA workspace.
- `GET /_next/*` - Next.js static assets

### Upcoming
- Real auth (signup/signin/JWT) — replaces fake login
- Additional wired documents (PL-7+). The 10 unwired catalog entries are routed via `/documents/<id>` and answered with a closest-match message; wire each one in its own PR by adding its cover page + standard terms to `templates/` and `frontend/templates/`, extending the FE registry, and (if needed) the BE registry + chat schemas.
- Document persistence (save/load to SQLite)

### Implementation Update
- **Multi-document surface (2026-07-01, PL-6):** Lifted the chat surface from MNDA-only to all 11 registered documents via a `DocumentRegistry` and one dynamic route (`/documents/[type]`) with `generateStaticParams`. The other 10 entries get an `UnsupportedDocWorkspace` that explains the closest wired match in the right pane and keeps the chat functional; the backend returns `{fields: null, assistant_message: <static>}` for any non-MNDA `document_type` (no LLM call). `/mutual-nda` alias kept as a thin render-path wrapper. New pytest dev group added in `[project.optional-dependencies].dev` so Docker's `uv sync --frozen --no-dev` stays slim. Test suite at 61 FE + 8 BE = 69 passing (14 new FE + 8 new BE); static export produces 11 doc HTML files plus the alias; container smoke-test confirms MNDA chat still works, `/documents/csa` returns the static fallback message, unknown ids receive a generic fallback.
- **AI chat (2026-07-01, PL-5):** Form-driven MNDA prototype replaced with a freeform chat. Backend `POST /api/chat` calls `gpt-oss-120b` via LiteLLM + Cerebras using structured outputs and returns the current best-guess values for every MNDA field plus a short assistant reply. The returned fields flow into the existing `fillFullNda` + `NdaPdfDocument` pipeline — preview and PDF download unchanged. Test suite at 47/47 passing; static export builds clean; container rebuilds and the chat endpoint returns the expected structured payload end-to-end. Merged to `main` as commit `44f078c` (no-ff merge of `feature/PL-5-ai-chat` `51707cf`).
- **MNDA polish (2026-07-01, PL-4):** `<label>` tags stripped in `fillFullNda` (covered by a regression test); workspace redesigned with independent vertical scrolling per column, light-gray page background, white rounded cards, and improved text styles. Test suite at 51/51 passing; static export builds clean. Merged to `main` as commit `1784564` (no-ff merge of `feature/PL-4-foundation` `8923a15`).