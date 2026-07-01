import type { NdaFormData } from "./types";
import { confidentialityTermPhrase, ndaTermPhrase } from "./terms";

// ============================================================================
// Cover Page

// ============================================================================
// Cover Page
// ============================================================================
//
// The cover page is structured enough that targeted literal replacements are
// safer than regex. Each replace target below is a unique substring in the
// source. Pair-of-checkboxes rewrites are written as a single `if/else` so
// the invariant `exactly one [-x] per pair` cannot be violated.
//
// To make `fillCoverPage` robust to repeated calls on already-filled
// strings (e.g. if a future caller caches the output rather than the raw
// template), the source's placeholder brackets around the year — e.g.
// `[1 year(s)]` — are stripped at the start of the function. From that
// point on, the substitution patterns match the bare form `N year(s)` and
// are indifferent to whether the input is the raw template or a previously
// filled string.

const PARTY1_LINE = "|| PARTY 1 | PARTY 2 |";

const PURPOSE_BRACKET =
  "[Evaluating whether to enter into a business relationship with the other party.]";
const TODAY_BRACKET = "[Today’s date]";

// Placeholder-bracket patterns to strip. These convert the source's
// `[N year(s)]` (a placeholder the template uses) into `N year(s)` (the
// form the filled document uses). The regex is anchored so it only matches
// in the expected positions.
const NDA_TERM_YEARS_BRACKETS_RE = /Expires \[\d+ year\(s\)\]/g;
const CONF_TERM_YEARS_BRACKETS_RE = / \[\d+ year\(s\)\] from Effective Date/g;

// Checkbox-pair matchers. Each matches BOTH checkbox states (`[x]` or
// `[ ]`), so the same pattern works whether the input is the raw source or
// a previously filled string with the opposite selection.
const NDA_TERM_PAIR_RE =
  /^(- )\[[ x]\](     Expires \d+ year\(s\) from Effective Date\.)$\n^(- )\[[ x]\](     Continues until terminated in accordance with the terms of the MNDA\.)$/m;

const CONF_TERM_PAIR_RE =
  /^(- )\[[ x]\](     \d+ year\(s\) from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws\.)$\n^(- )\[[ x]\](     In perpetuity\.)$/m;

const GOVERNING_LAW_RE = /^Governing Law: \[Fill in state\]$/m;
const JURISDICTION_RE =
  /^Jurisdiction: \[Fill in city or county and state, i\.e\. “courts located in New Castle, DE”\]$/m;

/**
 * Fill the cover page template with the user's form data.
 *
 * Returns a new string. Does not mutate inputs.
 */
export function fillCoverPage(raw: string, data: NdaFormData): string {
  let out = raw;

  // 0. Normalise: strip placeholder brackets from the year counts so the
  // same substitution patterns work whether the input is the source
  // template or a previously filled string.
  out = out
    .replace(NDA_TERM_YEARS_BRACKETS_RE, (m) => m.replace(/[[\]]/g, ""))
    .replace(CONF_TERM_YEARS_BRACKETS_RE, (m) => m.replace(/[[\]]/g, ""));

  // 1. Party names in the table header.
  //
  // IMPORTANT: use a function-replacement (`() => …`) rather than a string
  // substitution. With a string, `$&`, `$1`, `$$` etc. in user-supplied
  // names would be interpreted as backreferences against the matched
  // placeholder. A function replacement treats the return value literally.
  out = out.replace(
    PARTY1_LINE,
    () => `|| ${data.party1.name} | ${data.party2.name} |`,
  );

  // 2. Purpose.
  out = out.replace(PURPOSE_BRACKET, () => data.purpose);

  // 3. Effective date.
  out = out.replace(TODAY_BRACKET, () => data.effectiveDateDisplay);

  // 4. MNDA Term — exactly one `[x]` between the two lines.
  // Match the pair as a block so the invariant cannot be violated even if
  // the line was previously filled (e.g. with a different year).
  out = out.replace(NDA_TERM_PAIR_RE, (_match, p1, _p2, p3, p4) => {
    const expiresBox = data.ndaTerm.mode === "expires" ? "[x]" : "[ ]";
    const continuesBox = data.ndaTerm.mode === "continues" ? "[x]" : "[ ]";
    const expiresBody = `     Expires ${data.ndaTerm.years} year(s) from Effective Date.`;
    const continuesBody = p4; // unchanged
    return `${p1}${expiresBox}${expiresBody}\n${p3}${continuesBox}${continuesBody}`;
  });

  // 5. Term of Confidentiality — same shape.
  out = out.replace(CONF_TERM_PAIR_RE, (_match, p1, _p2, p3, p4) => {
    const yearsBox = data.confidentialityTerm.mode === "years" ? "[x]" : "[ ]";
    const perpBox = data.confidentialityTerm.mode === "perpetuity" ? "[x]" : "[ ]";
    const yearsBody = `     ${data.confidentialityTerm.years} year(s) from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws.`;
    const perpBody = p4; // unchanged
    return `${p1}${yearsBox}${yearsBody}\n${p3}${perpBox}${perpBody}`;
  });

  // 6. Governing law.
  out = out.replace(GOVERNING_LAW_RE, () => `Governing Law: ${data.governingLaw}`);

  // 7. Jurisdiction.
  out = out.replace(JURISDICTION_RE, () => `Jurisdiction: ${data.jurisdiction}`);

  return out;
}

// ============================================================================
// Standard Terms
// ============================================================================
//
// The standard terms reference cover-page values via spans:
//   <span class="coverpage_link">KEY</span>
//
// We `replaceAll` the entire span for each known key. The phrase helpers
// (`ndaTermPhrase`, `confidentialityTermPhrase`) live in `lib/terms.ts` so
// the PDF renderer can use the same grammar.

function subSpan(src: string, key: string, value: string): string {
  // Function replacement so `$&`, `$1`, `$$` etc. in `value` are NOT
  // interpreted as backreferences. See comment in `fillCoverPage`.
  const needle = `<span class="coverpage_link">${key}</span>`;
  return src.split(needle).join(value);
}

/**
 * Strip any leftover coverpage_link span (in case a future template
 * introduces a new key not yet handled). This is a defensive fallback —
 * known keys are substituted explicitly above. If this ever fires, the
 * canonical template has a new key that should be added to the explicit
 * substitutions above (and `stripRemainingSpans` should be removed).
 */
function stripRemainingSpans(src: string): string {
  return src.replace(
    /<span class="coverpage_link">([^<]+)<\/span>/g,
    "$1",
  );
}

/**
 * Fill the standard-terms template with the user's form data. Returns a
 * new string.
 */
export function fillStandardTerms(raw: string, data: NdaFormData): string {
  let out = raw;

  out = subSpan(out, "Purpose", data.purpose);
  out = subSpan(out, "Effective Date", data.effectiveDateDisplay);
  out = subSpan(out, "MNDA Term", ndaTermPhrase(data));
  out = subSpan(out, "Term of Confidentiality", confidentialityTermPhrase(data));
  out = subSpan(out, "Governing Law", data.governingLaw);
  out = subSpan(out, "Jurisdiction", data.jurisdiction);

  return stripRemainingSpans(out);
}

// ============================================================================
// Helper: stitch a single preview markdown string from both filled parts.
// ============================================================================

/**
 * Strip `<label>…</label>` annotation tags left over from the Common Paper
 * source. They were meant as accessibility hints in the original
 * document, but render as raw text in the Markdown preview and PDF.
 */
function stripLabelTags(src: string): string {
  return src.replace(/<label>[^<]*<\/label>/g, "");
}

/**
 * Produce the full NDA as a single markdown string for the on-screen
 * preview. The cover page comes first, then a horizontal rule, then the
 * standard terms.
 */
export function fillFullNda(
  coverPageRaw: string,
  standardTermsRaw: string,
  data: NdaFormData,
): string {
  const cover = stripLabelTags(fillCoverPage(coverPageRaw, data));
  const terms = stripLabelTags(fillStandardTerms(standardTermsRaw, data));
  return `${cover}\n\n---\n\n${terms}`;
}