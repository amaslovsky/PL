import type { NdaFormData } from "@/lib/types";

/**
 * Build an `NdaFormData` with literal defaults. Tests override individual
 * fields; the defaults match `buildDefaultNdaFormData()` so a test that
 * doesn't override anything exercises the same shape a real user sees.
 */
export function makeData(overrides: Partial<NdaFormData> = {}): NdaFormData {
  return {
    party1: { name: "Acme, Inc.", address: "123 Main St, San Francisco, CA" },
    party2: { name: "Beta Co.", address: "456 Market St, San Francisco, CA" },
    purpose: "Evaluating whether to enter into a business relationship.",
    effectiveDate: "2026-06-30",
    effectiveDateDisplay: "June 30, 2026",
    ndaTerm: { mode: "expires", years: 1 },
    confidentialityTerm: { mode: "years", years: 1 },
    governingLaw: "Delaware",
    jurisdiction: "New Castle County, Delaware",
    ...overrides,
  };
}