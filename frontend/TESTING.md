# Manual testing — PL-3 / PL-5 / PL-6 / PL-7

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
- [ ] Enter a real-length password (e.g. `hunter2hunter2`) → click "Create account" → browser navigates to `/` and the header shows your email + "Sign out".
- [ ] Click **Sign out** in the header → cookie is cleared, browser bounces to `/login`, header shows "Sign in" instead of email.
- [ ] Sign in with the same email + password → header reverts to showing your email.
- [ ] Open a private window and try `/api/auth/me` after signing out there → `{authenticated: false}` with HTTP 401.
- [ ] Sign up a second time with the same email → "email already registered" error.

## Smoke — saved drafts (PL-7)

- [ ] Sign in, open `/documents/mnda`, type a sentence with both party names + a date, send it.
- [ ] Click **Save draft** → header shows "Saved", no error.
- [ ] Open `/my-documents` → at least one draft is listed with the right document type + a sensible title.
- [ ] Click **Delete** on a draft → row disappears, no console errors.
- [ ] After deleting all drafts, the page shows the empty-state copy with a link back to `/documents/mnda`.
- [ ] Click **Download PDF** in the workspace → file downloads AND `/my-documents` shows a new row (auto-save on download).

## Smoke — disclaimer + chrome (PL-7)

- [ ] Visit `/`, `/login`, `/signup`, `/my-documents`, `/documents/mnda`, `/documents/cloud-service-agreement` → every page renders a header (logo + Documents + My drafts nav, plus email/Sign in or email/Sign out) and a footer with the disclaimer line.
- [ ] On `/documents/mnda`, the right pane shows a tinted yellow "Draft template only — not legal advice." banner above the preview content.
- [ ] The **Download PDF** button uses the project blue (`#209dd7`), not `bg-blue-600`.

## Smoke — landing page (PL-6)

- [ ] Open `http://localhost:3000/`.
- [ ] Page renders the "Prelegal" header and a list of 11 cards (one per registered document). MNDA has no pill; the other 10 show a yellow "coming soon" badge.
- [ ] Each card title matches the catalog: Mutual Non-Disclosure Agreement, Cloud Service Agreement, Service Level Agreement, Professional Services Agreement, Data Processing Agreement, Design Partner Agreement, Software License Agreement, Partnership Agreement, Pilot Agreement, Business Associate Agreement, AI Addendum.

## Smoke — Mutual NDA workspace (PL-3 + PL-5)

- [ ] Click the MNDA card → loads `/documents/mnda`.
- [ ] First paint shows the chat panel on the left and the preview panel on the right, both empty.
- [ ] Type a sentence like "Acme Inc and BetaCo are evaluating a partnership, effective June 30, 2026, governed by Delaware law" and press Enter.
- [ ] Preview updates within a second: party names appear in the cover-page header, the Effective Date shows "June 30, 2026", Governing Law reads "Delaware".
- [ ] Ask a follow-up: "Alameda County for jurisdiction." → jurisdiction field updates.
- [ ] Ask "MNDA term is 3 years, confidentiality is perpetual." → both checkbox pairs flip to the new selection, exactly one `[x]` per pair, no broken markdown.

## Smoke — unsupported doc workspace (PL-6)

- [ ] Click the Cloud Service Agreement card → loads `/documents/cloud-service-agreement`.
- [ ] Left pane shows one assistant bubble: "Hi — I can talk through this document, but I can't yet fill in fields for it."
- [ ] Right pane shows the "Closest match" notice pointing at the Mutual Non-Disclosure Agreement with a `<Link>` to `/documents/mnda`.
- [ ] Type "what's a CSA?" and press Enter. The chat bubbles update with the BE static fallback message; nothing crashes.
- [ ] Click "Reset chat" — message thread returns to the initial greeting.

## Alias — `/mutual-nda`

- [ ] Open `http://localhost:3000/mutual-nda` directly.
- [ ] It loads the same MNDA workspace as `/documents/mnda` (the alias is a thin wrapper around the same render path).

## Chat roundtrip

- [ ] After a few MNDA turns, click **Start over** in the chat header. The message thread clears and the preview goes blank.
- [ ] With a fresh chat, ask a question that's totally off-topic like "what's the weather in Paris?" The MNDA workspace still responds; party names don't get invented.

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

## Static export (PL-6 + PL-7)

- [ ] `cd frontend && npm run build` succeeds.
- [ ] `frontend/out/documents/<id>/index.html` exists for every registered id (11 of them).
- [ ] `frontend/out/mutual-nda.html` exists.
- [ ] `frontend/out/login.html` and `frontend/out/signup.html` exist.
- [ ] `frontend/out/my-documents.html` exists.

## Not covered by automated tests

These manual checks exist *because* we deliberately didn't write automated tests for them. Listing them honestly so future maintainers know what's not protected:

- **Component rendering.** Vitest tests cover pure logic only — no jsdom, no React Testing Library. A JSX bug in `NdaWorkspace.tsx`, `UnsupportedDocWorkspace.tsx`, `NdaPreview.tsx`, `DownloadPdfButton.tsx`, `Header.tsx`, `Footer.tsx`, `MyDocumentsPage.tsx`, `MyDocumentsList.tsx`, `app/login/page.tsx`, or `app/signup/page.tsx` would slip past `npm test`.
- **PDF binary correctness.** The `NdaPdfDocument.test.ts` regression test reads the source file and asserts no `pdfStyles.` substring leaked into rendered text. It does *not* render the PDF and inspect bytes — that's a Playwright job.
- **Hydration.** A bug where SSR and client produce different first-paint output (the original UTC-vs-local date bug) would not be caught by these unit tests.
- **Server-routed page params.** `params` is awaited in the dynamic route; the test suite mocks only the FE helper, not Next.js's runtime. Verify by visiting `/documents/<id>` for each registered slug.
- **`URL.revokeObjectURL` timing.** The `setTimeout(revoke, 0)` pattern isn't tested. A regression would only show up as a console warning in some browsers.
- **Cookie / headers round-tripping.** The backend's `TestClient` covers `/api/auth/*` and `/api/documents*` request shapes, but the `cookies: "include"` flow on the browser side and the `httponly` cookie wiring are verified by the manual sign-up/sign-in flow.