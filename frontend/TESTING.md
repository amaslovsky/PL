# Manual testing — PL-3 / PL-5 / PL-6 / PL-7 / PL-8

A short checklist of things to verify by hand. The automated Vitest suite (`npm test`) covers the pure logic; this file covers what only a human can confirm.

## Setup

```sh
cd frontend
npm install      # if not already
npm run dev      # http://localhost:3000 (no backend) — for SPA-only checks
# or, from the project root:
./scripts/start-mac.sh   # full stack including Postgres-free SQLite
```

## Smoke — auth flow (PL-7)

- [ ] Visit `http://localhost:3000/` while signed out → 303 to `/login`.
- [ ] On `/login`, click "Create an account" → lands on `/signup`.
- [ ] On `/signup`, enter a short password (e.g. `short`) → submit, the form shows an error (client `minLength` blocks it).
- [ ] Enter a real-length password (e.g. `hunter2hunter2`) → click "Create account" → browser navigates to `/` and the header shows your email in a clickable button.
- [ ] Click the email in the header → dropdown opens with "My drafts" + "Sign out".
- [ ] Click **Sign out** → cookie is cleared, browser bounces to `/login`, header shows "Sign in" instead of email.
- [ ] Sign in with the same email + password → header reverts to showing your email.
- [ ] Open a private window and try `/api/auth/me` after signing out there → `{authenticated: false}` with HTTP 401.
- [ ] Sign up a second time with the same email → "email already registered" error.

## Smoke — chat-first home (PL-8)

- [ ] Sign in, visit `/`. The page renders the chat workspace immediately (no card grid).
- [ ] Left pane shows the greeting "Tell me about the deal — the parties, the effective date, any specifics…".
- [ ] Right pane shows the empty MNDA preview with the tinted yellow disclaimer banner above it.
- [ ] Type "draft an MNDA between Acme Inc (123 Main St, SF) and Globex Inc" and press Enter → preview fills in with party names; both panes stay in sync.
- [ ] Switch topic mid-conversation: "actually I need a Cloud Service Agreement instead" → within ~1 second the right pane switches to the Cloud Service Agreement standard terms (rendered as markdown), the title in the chat header changes too.
- [ ] Switch back: "let's do the mutual NDA again" → right pane swaps back to the live MNDA preview.
- [ ] Click **Start over** after a long thread → message list clears, preview blanks, document type resets to MNDA.

## Smoke — saved drafts (PL-7 + PL-8)

- [ ] Sign in, send a chat message with both party names + a date, click **Save draft** → header shows "Saved", no error.
- [ ] Open `/my-documents` → at least one draft is listed with the right document type + a sensible title.
- [ ] Click **Delete** on a draft → row disappears, no console errors.
- [ ] After deleting all drafts, the page shows the empty-state copy with a link back to the chat (`/`).
- [ ] Click **Download PDF** in the workspace → file downloads AND `/my-documents` shows a new row (auto-save on download).

## Smoke — header user menu (PL-8)

- [ ] Header shows logo + "New draft" + "My drafts" nav at all times on every page.
- [ ] When signed in, the email appears as a clickable button on the right with a caret; clicking opens a dropdown.
- [ ] Dropdown items: "My drafts" (navigates to `/my-documents`) and "Sign out" (signs out + goes to `/login`).
- [ ] Dropdown closes on: clicking outside, pressing Escape, clicking "My drafts" (then navigating), clicking "Sign out" (then signing out).
- [ ] When signed out, the email/menu is replaced with a blue "Sign in" button.

## Smoke — disclaimer + chrome (PL-7)

- [ ] Visit `/`, `/login`, `/signup`, `/my-documents`, `/mutual-nda` → every page renders a header (logo + New draft + My drafts nav, plus email menu or Sign in) and a footer with the disclaimer line.
- [ ] On the chat workspace `/`, the right pane shows a tinted yellow "Draft template only — not legal advice." banner above the preview content.
- [ ] The **Download PDF** button (visible only when MNDA is selected) uses the project blue (`#209dd7`).

## Smoke — back-compat redirects (PL-8)

- [ ] Open `http://localhost:3000/documents/mnda` directly → lands on `/` after hydration.
- [ ] Open `http://localhost:3000/documents/cloud-service-agreement` directly → lands on `/` (all 11 registered slugs redirect).
- [ ] Open `http://localhost:3000/mutual-nda` directly → lands on `/`.
- [ ] Open `http://localhost:3000/documents/totally-fake-id` → renders the SPA 404 (no prerendered file for unknown slugs).

## Smoke — Mutual NDA workspace (PL-3 + PL-5 + PL-8)

- [ ] From `/`, type a sentence like "Acme Inc and BetaCo are evaluating a partnership, effective June 30, 2026, governed by Delaware law" and press Enter.
- [ ] Preview updates within a second: party names appear in the cover-page header, the Effective Date shows "June 30, 2026", Governing Law reads "Delaware".
- [ ] Ask a follow-up: "Alameda County for jurisdiction." → jurisdiction field updates.
- [ ] Ask "MNDA term is 3 years, confidentiality is perpetual." → both checkbox pairs flip to the new selection, exactly one `[x]` per pair, no broken markdown.

## Smoke — non-MNDA templates (PL-8)

- [ ] Type "I need a Cloud Service Agreement" → right pane switches to the CSA standard terms (no live fields, but the markdown renders).
- [ ] Type "draft a Design Partner Agreement for feedback on our beta" → right pane swaps to the DPA standard terms (or whichever Design Partner Agreement filename is registered).
- [ ] For any non-MNDA template, the **Save draft** button still works but the message says "Saved chat" rather than "Saved".
- [ ] When switching back to MNDA via "actually do an NDA", the live MNDA preview re-renders with whatever last values the LLM returned for it.

## Chat roundtrip

- [ ] After a few MNDA turns, click **Start over** in the chat header. The message thread clears and the preview goes blank.
- [ ] With a fresh chat, ask a question that's totally off-topic like "what's the weather in Paris?" The MNDA workspace still responds; party names don't get invented, and the LLM does not invent a non-MNDA document out of nowhere.

## Download

- [ ] After the preview has party names + date + governing law + jurisdiction + terms, click **Download PDF**.
- [ ] File downloads with a name like `mutual-nda-acme-inc-and-beta-co-2026-06-30.pdf` (slugified party names + ISO date).
- [ ] Open the PDF — it has **2 pages**.
- [ ] Page 1 contains: "Mutual Non-Disclosure Agreement" heading, Purpose, Effective Date, MNDA Term with one `[x]`, Term of Confidentiality with one `[x]`, Governing Law & Jurisdiction, MNDA Modifications, signature table with rows for Signature / Print Name / Title / Company / Notice Address / Date, footer.
- [ ] Page 2 contains: "Standard Terms" heading, numbered paragraphs 1–11, footer.
- [ ] In paragraph 9, "State of <Governing Law>" appears twice with the same value.
- [ ] In paragraph 5, the MNDA Term and Term of Confidentiality phrases match what the cover page shows.

## Edge cases

- [ ] **Send an empty message** — the Send button stays disabled, no request fires.
- [ ] **Press Enter twice quickly** — only one request goes through; the second send is ignored because of the in-flight ref.
- [ ] **Backend returns an error** (temporarily stop the container, send a message, restart) — the chat shows a red error banner and the user message is rolled back.
- [ ] **Effective Date empty** — preview shows "" in the Effective Date section and in paragraph 5. No crash.
- [ ] **Session expires while the page is open** — open the SPA, click Sign out from the header, try to send a chat message → chat shows "not authenticated".
- [ ] **Database wiped on restart** — restart the Docker container; `/my-documents` is empty for everyone, all sessions are invalidated.

## Static export (PL-6 + PL-7 + PL-8)

- [ ] `cd frontend && npm run build` succeeds.
- [ ] `frontend/out/documents/<id>/index.html` exists for every registered id (11 of them) — these are all client-side redirects to `/`.
- [ ] `frontend/out/mutual-nda.html` exists.
- [ ] `frontend/out/login.html` and `frontend/out/signup.html` exist.
- [ ] `frontend/out/my-documents.html` exists.
- [ ] After opening `/documents/mnda` in a browser, JS hydration navigates the user to `/` (the prerendered HTML contains a `NEXT_REDIRECT`).

## Not covered by automated tests

These manual checks exist *because* we deliberately didn't write automated tests for them. Listing them honestly so future maintainers know what's not protected:

- **Component rendering.** Vitest tests cover pure logic only — no jsdom, no React Testing Library. A JSX bug in `Workspace.tsx`, `NdaPreview.tsx`, `DownloadPdfButton.tsx`, `Header.tsx`, `Footer.tsx`, `Chat.tsx`, `MyDocumentsPage.tsx`, or `MyDocumentsList.tsx` would slip past `npm test`.
- **PDF binary correctness.** The `NdaPdfDocument.test.ts` regression test reads the source file and asserts no `pdfStyles.` substring leaked into rendered text. It does *not* render the PDF and inspect bytes — that's a Playwright job.
- **Hydration.** A bug where SSR and client produce different first-paint output (the original UTC-vs-local date bug) would not be caught by these unit tests.
- **Dropdown interactions.** The Header user-menu open/close behavior (outside click + Escape + item click) is not unit-tested; verify by hand.
- **LLM-assigned document type.** Whether the LLM picks the right template from a freeform user message is not unit-tested (the test suite mocks `postChat`).
- **Cookie / headers round-tripping.** The backend's `TestClient` covers `/api/auth/*` and `/api/documents*` request shapes, but the `cookies: "include"` flow on the browser side and the `httponly` cookie wiring are verified by the manual sign-up/sign-in flow.
