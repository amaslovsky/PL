# Manual testing — Mutual NDA creator (PL-3)

A short checklist of things to verify by hand before merging changes to the MNDA prototype. The automated Vitest suite (`npm test`) covers the pure logic; this file covers what only a human can confirm.

## Setup

```sh
cd frontend
npm install      # if not already
npm run dev      # http://localhost:3000
```

## Smoke

- [ ] Open `http://localhost:3000/mutual-nda`.
- [ ] First paint shows defaults: party 1 = "Acme, Inc.", party 2 = "Beta Co.", governing law = "Delaware", date = today's date (long form, e.g. "June 30, 2026"), MNDA Term radio on "Expires 1 year(s)", Term of Confidentiality on "1 year(s)".
- [ ] The right pane shows a rendered markdown preview of the full document (cover page + standard terms).

## Form fields

For each field, change it to a non-default value and confirm the preview updates within a frame (no reload, no flash of empty content):

- [ ] Party 1 name → "Wayne Enterprises" — preview header row shows "Wayne Enterprises".
- [ ] Party 2 name → "Stark Industries" — preview shows "Wayne Enterprises | Stark Industries".
- [ ] Party 1 address → preview shows it in the cover-page table cell.
- [ ] Party 2 address → same.
- [ ] Purpose → "Negotiating a SaaS subscription." — preview shows it in the Purpose section and in 3 places in the standard terms (paragraphs 1 and 2).
- [ ] Effective Date → pick a date two weeks out — preview shows the new long-form date in the Effective Date section and in paragraph 5 of the standard terms.
- [ ] Governing Law → "California" — preview shows "Governing Law: California" on the cover page and "State of California" twice in paragraph 9.
- [ ] Jurisdiction → "Alameda County, California" — preview shows it on the cover page and twice in paragraph 9.

## Toggle roundtrip (checkbox invariant)

The cover page has two checkbox pairs. Exactly one `- [x]` per pair must appear at all times.

- [ ] Flip MNDA Term to "Continues until terminated" — that line gets `[x]`, "Expires 1 year(s)" gets `[ ]`.
- [ ] Flip back to "Expires 1 year(s)" — back to the default.
- [ ] Flip Term of Confidentiality to "In perpetuity" — that line gets `[x]`, "1 year(s)" gets `[ ]`.
- [ ] Flip back to "1 year(s)" — back to the default.
- [ ] **Combined:** both lines on "Continues"/"In perpetuity" simultaneously — still exactly one `[x]` per pair.

## Year change

- [ ] Set MNDA Term years to 5 → preview shows "Expires 5 year(s)".
- [ ] Set Term of Confidentiality years to 3 → preview shows "3 year(s) from Effective Date, but in the case of trade secrets…".
- [ ] Standard terms paragraph 5 shows "the 5 year period" and "the 3 year term".
- [ ] Reset both to 1 → preview reverts.

## Download

- [ ] Click **Download PDF**.
- [ ] File downloads with a name like `mutual-nda-acme-inc-and-beta-co-2026-06-30.pdf` (slugified party names + ISO date).
- [ ] Open the PDF — it has **2 pages**.
- [ ] Page 1 contains: "Mutual Non-Disclosure Agreement" heading, Purpose, Effective Date, MNDA Term with one `[x]`, Term of Confidentiality with one `[x]`, Governing Law & Jurisdiction, MNDA Modifications, signature table with rows for Signature / Print Name / Title / Company / Notice Address / Date, footer.
- [ ] Page 2 contains: "Standard Terms" heading, numbered paragraphs 1–11, footer.
- [ ] Open the PDF in a text-aware viewer (Preview, Chrome, Adobe) and try to select text from a paragraph — the text is selectable, not rasterised.
- [ ] In paragraph 9, "State of <Governing Law>" appears twice with the same value.
- [ ] In paragraph 5, the MNDA Term and Term of Confidentiality phrases match what the cover page shows.

## Edge cases

- [ ] **Both party names empty** — preview table header should fall back to a sensible default (current behaviour: it shows `||  |  |`). The downloaded PDF filename should fall back to `mutual-nda-draft-and-draft-<date>.pdf`.
- [ ] **Effective Date empty** — preview shows "" in the Effective Date section and in paragraph 5. No crash.
- [ ] **Multi-digit year (e.g. 99)** — preview shows "Expires 99 year(s)"; the `<input type="number">` does not let you go above 99.

## Not covered by automated tests

These manual checks exist *because* we deliberately didn't write automated tests for them. Listing them honestly so future maintainers know what's not protected:

- **Component rendering.** Vitest tests cover pure logic only — no jsdom, no React Testing Library. A JSX bug in `NdaForm.tsx`, `NdaWorkspace.tsx`, `NdaPreview.tsx`, or `DownloadPdfButton.tsx` would slip past `npm test`.
- **PDF binary correctness.** The `NdaPdfDocument.test.ts` regression test reads the source file and asserts no `pdfStyles.` substring leaked into rendered text. It does *not* render the PDF and inspect bytes — that's a Playwright job.
- **Hydration.** A bug where SSR and client produce different first-paint output (the original UTC-vs-local date bug) would not be caught by these unit tests. The `defaultValues.test.ts` test asserts the *internal* consistency of the two date fields but not their SSR/client agreement.
- **Dev-server routing.** `/` vs `/mutual-nda` vs `/_not-found` aren't tested. Verify by clicking the link on the landing page.
- **`URL.revokeObjectURL` timing.** The `setTimeout(revoke, 0)` pattern isn't tested. A regression would only show up as a console warning in some browsers.