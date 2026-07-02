import type { Config } from "jest";

/**
 * Two Jest projects, split by file extension:
 *
 * - `unit`        (`.test.ts`, node env)  — pure logic: dates, term phrasing,
 *                                            markdown substitution. No DOM,
 *                                            no React Testing Library.
 * - `components`  (`.test.tsx`, jsdom)    — React components: AuthContext
 *                                            state transitions, Header
 *                                            signed-in/out/loading.
 *
 * `npm test` runs both. Filter by project name:
 *   npx jest --selectProjects unit
 *   npx jest --selectProjects components
 *
 * ts-jest handles TS/TSX transform; the moduleNameMapper honours the
 * `@/*` alias from tsconfig.
 */
const tsTransform = {
  "^.+\\.(ts|tsx)$": [
    "ts-jest",
    {
      tsconfig: "<rootDir>/tsconfig.json",
      jsx: "react-jsx",
    },
  ],
};

const config: Config = {
  projects: [
    {
      displayName: "unit",
      preset: "ts-jest",
      testEnvironment: "node",
      testMatch: ["<rootDir>/src/**/*.test.ts"],
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
      },
      transform: tsTransform,
    },
    {
      displayName: "components",
      preset: "ts-jest",
      testEnvironment: "jsdom",
      testMatch: ["<rootDir>/src/**/*.test.tsx"],
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
      },
      transform: tsTransform,
    },
  ],
};

export default config;