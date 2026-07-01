# Templates

These Markdown files are copies of the canonical templates at `../../templates/`.

The **canonical source of truth** for legal agreement templates is `../../templates/` (Common Paper, CC BY 4.0). If you change the canonical source, copy the updated files here so this Next.js app picks them up.

The Mutual NDA prototype (`/mutual-nda`) only uses:

- `mutual-nda-coverpage.md` — the fillable cover page (party names, purpose, dates, governing law, jurisdiction, MNDA term, confidentiality term).
- `mutual-nda.md` — the fixed Standard Terms, with cross-references back to the cover page via `<span class="coverpage_link">KEY</span>` markers.

The other templates in `../../templates/` are not yet wired into the UI — that's a future roadmap item.