import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Pure-logic tests only — no React, no jsdom, no browser. `node` env keeps
// tests fast (~200ms total) and avoids the cost and footguns of jsdom.
//
// Scope: lib/**/*.test.ts and pdf/**/*.test.ts. Component/E2E tests are
// out of scope for this round (see TESTING.md).
//
// `vite-tsconfig-paths` honours the `@/*` alias from `tsconfig.json`.
// This is the approach recommended in the official Next.js 16 Vitest
// guide (`node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`).
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "pdf/**/*.test.ts"],
  },
});
