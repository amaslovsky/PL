import type { NdaFormData } from "./types";
import { formatLongDateUtc, todayIsoUtc } from "./date";

const DEFAULT_PURPOSE =
  "Evaluating whether to enter into a business relationship with the other party.";

/**
 * Default values for the NDA form. Pre-filling every field means the
 * prototype demos correctly on first paint — the user can see a complete
 * document without touching anything.
 *
 * Date defaults use `todayIsoUtc()` / `formatLongDateUtc()` from `date.ts`
 * so the ISO string (used by `<input type="date">`) and the displayed
 * long string agree on every machine. Without this, non-UTC users see a
 * one-day mismatch on first paint.
 */
export function buildDefaultNdaFormData(): NdaFormData {
  const today = new Date();
  return {
    party1: {
      name: "Acme, Inc.",
      address: "123 Main St, San Francisco, CA 94105",
    },
    party2: {
      name: "Beta Co.",
      address: "456 Market St, San Francisco, CA 94105",
    },
    purpose: DEFAULT_PURPOSE,
    effectiveDate: todayIsoUtc(),
    effectiveDateDisplay: formatLongDateUtc(today),
    ndaTerm: { mode: "expires", years: 1 },
    confidentialityTerm: { mode: "years", years: 1 },
    governingLaw: "Delaware",
    jurisdiction: "New Castle County, Delaware",
  };
}