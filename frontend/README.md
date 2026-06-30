# PL-3: Mutual NDA Creator (Next.js prototype)

A Next.js 16 / React 19 web app that fills in the Common Paper Mutual NDA
from a short form. Built for Jira ticket PL-3.

## Run

```bash
npm install
npm run dev
```

Open <http://localhost:3000/mutual-nda>.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript only
- `npm test` — Vitest in watch mode (use `npm run test:run` for one-shot)
- See [TESTING.md](./TESTING.md) for the manual test checklist

## How it works

- `app/mutual-nda/page.tsx` (server) reads the two MNDA template files from
  `templates/` and passes the raw markdown to `components/NdaWorkspace.tsx`
  (`'use client'`).
- `lib/fillTemplate.ts` performs literal string substitution to produce a
  filled cover page and filled standard terms.
- The on-screen preview uses `react-markdown` with `remark-gfm`.
- The PDF is generated client-side with `@react-pdf/renderer` and downloaded
  as a Blob.

## Templates

The two `templates/*.md` files are copies of the canonical Common Paper
Mutual NDA in `../../templates/`. They are checked into this directory so
the build is hermetic. See `templates/README.md` for the source-of-truth
note.

## Jira

- Issue: [PL-3](https://amaslovsky.atlassian.net/browse/PL-3) — prototype of mutual NDA creator