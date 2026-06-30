import type { NdaFormData } from "./types";

/**
 * Phrase to substitute for the "MNDA Term" cross-reference in the standard
 * terms (paragraph 5). The standard-terms prose already reads "expires at
 * the end of the <MNDA Term>", so we return only the trailing noun phrase.
 */
export function ndaTermPhrase(data: NdaFormData): string {
  if (data.ndaTerm.mode === "expires") {
    const n = data.ndaTerm.years;
    return n === 1 ? "1 year period" : `${n} year period`;
  }
  return "term";
}

/**
 * Phrase to substitute for the "Term of Confidentiality" cross-reference
 * in the standard terms (paragraph 5). The prose already reads "will survive
 * for the <Term of Confidentiality>", so we return only the trailing noun
 * phrase.
 */
export function confidentialityTermPhrase(data: NdaFormData): string {
  if (data.confidentialityTerm.mode === "years") {
    const n = data.confidentialityTerm.years;
    return n === 1 ? "1 year term" : `${n} year term`;
  }
  return "perpetual term";
}