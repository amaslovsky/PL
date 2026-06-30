// Type definitions for the Mutual NDA prototype.
//
// These types describe the user-fillable shape of the cover page. The
// substitution code (`lib/fillTemplate.ts`) and the PDF renderer
// (`pdf/NdaPdfDocument.tsx`) both consume the same `NdaFormData`.

export type NdaTermMode = "expires" | "continues";
export type ConfidentialityTermMode = "years" | "perpetuity";

export interface Party {
  name: string;
  address: string;
}

export interface NdaFormData {
  party1: Party;
  party2: Party;
  purpose: string;
  /** ISO `yyyy-mm-dd` (from `<input type="date">`). */
  effectiveDate: string;
  /** Human-readable date, e.g. "June 30, 2026". */
  effectiveDateDisplay: string;
  ndaTerm: {
    mode: NdaTermMode;
    /** Used only when `mode === "expires"`. */
    years: number;
  };
  confidentialityTerm: {
    mode: ConfidentialityTermMode;
    /** Used only when `mode === "years"`. */
    years: number;
  };
  governingLaw: string;
  jurisdiction: string;
}