import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  fillCoverPage,
  fillFullNda,
  fillStandardTerms,
} from "@/lib/fillTemplate";
import type { NdaFormData } from "@/lib/types";
import { makeData } from "@/lib/__test__/makeData";

// ============================================================================
// Fixtures
// ============================================================================

/**
 * Read the actual templates from disk once per test file. Using the real
 * files (not inline copies) keeps tests in sync with what the server
 * component serves.
 */
let coverPageRaw: string;
let standardTermsRaw: string;

beforeAll(() => {
  const root = process.cwd();
  coverPageRaw = readFileSync(
    path.join(root, "templates", "mutual-nda-coverpage.md"),
    "utf8",
  );
  standardTermsRaw = readFileSync(
    path.join(root, "templates", "mutual-nda.md"),
    "utf8",
  );
});

/**
 * Count how many `- [x]` lines appear in the rendered cover page.
 * The checkbox-pair invariant requires exactly one per pair — two pairs,
 * so two `[x]` lines total.
 */
function countChecked(src: string): number {
  const matches = src.match(/^- \[x\]/gm);
  return matches ? matches.length : 0;
}

// ============================================================================
// fillCoverPage
// ============================================================================

describe("fillCoverPage", () => {
  it("substitutes party names into the table header", () => {
    const out = fillCoverPage(
      coverPageRaw,
      makeData({
        party1: { name: "Wayne Enterprises", address: "" },
        party2: { name: "Stark Industries", address: "" },
      }),
    );
    expect(out).toContain("|| Wayne Enterprises | Stark Industries |");
    expect(out).not.toContain("|| PARTY 1 | PARTY 2 |");
  });

  it("substitutes the purpose bracket", () => {
    const out = fillCoverPage(coverPageRaw, makeData({ purpose: "Negotiating a deal." }));
    expect(out).toContain("Negotiating a deal.");
    expect(out).not.toContain(
      "[Evaluating whether to enter into a business relationship with the other party.]",
    );
  });

  it("substitutes the effective date", () => {
    const out = fillCoverPage(coverPageRaw, makeData({ effectiveDateDisplay: "January 1, 2030" }));
    expect(out).toContain("January 1, 2030");
    expect(out).not.toContain("[Today’s date]");
  });

  it("substitutes governing law and jurisdiction", () => {
    const out = fillCoverPage(coverPageRaw, makeData({
      governingLaw: "California",
      jurisdiction: "San Francisco County, California",
    }));
    expect(out).toContain("Governing Law: California");
    expect(out).toContain("Jurisdiction: San Francisco County, California");
    expect(out).not.toContain("Governing Law: [Fill in state]");
    expect(out).not.toContain("[Fill in city or county and state");
  });

  describe("checkbox invariants", () => {
    // Four mode combinations × two pairs (MNDA Term, Term of Confidentiality).
    // For each combination, exactly one `- [x]` per pair must appear.

    const cases: Array<{
      label: string;
      data: NdaFormData;
      expectedChecked: string[];
    }> = [
      {
        label: "expires + years",
        data: makeData(),
        expectedChecked: [
          "Expires 1 year(s) from Effective Date.",
          "1 year(s) from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws.",
        ],
      },
      {
        label: "expires + perpetuity",
        data: makeData({
          ndaTerm: { mode: "expires", years: 3 },
          confidentialityTerm: { mode: "perpetuity", years: 1 },
        }),
        expectedChecked: [
          "Expires 3 year(s) from Effective Date.",
          "In perpetuity.",
        ],
      },
      {
        label: "continues + years",
        data: makeData({
          ndaTerm: { mode: "continues", years: 1 },
          confidentialityTerm: { mode: "years", years: 2 },
        }),
        expectedChecked: [
          "Continues until terminated in accordance with the terms of the MNDA.",
          "2 year(s) from Effective Date, but in the case of trade secrets",
        ],
      },
      {
        label: "continues + perpetuity",
        data: makeData({
          ndaTerm: { mode: "continues", years: 1 },
          confidentialityTerm: { mode: "perpetuity", years: 1 },
        }),
        expectedChecked: [
          "Continues until terminated in accordance with the terms of the MNDA.",
          "In perpetuity.",
        ],
      },
    ];

    for (const { label, data, expectedChecked } of cases) {
      it(`exactly one [x] per pair (${label})`, () => {
        const out = fillCoverPage(coverPageRaw, data);
        // Two pairs → exactly two `- [x]` lines total.
        expect(countChecked(out)).toBe(2);
        for (const line of expectedChecked) {
          expect(out).toContain(`- [x]     ${line}`);
        }
      });
    }

    it("uses the configured year count when mode is 'expires'", () => {
      const out = fillCoverPage(
        coverPageRaw,
        makeData({ ndaTerm: { mode: "expires", years: 5 } }),
      );
      expect(out).toContain("- [x]     Expires 5 year(s) from Effective Date.");
    });

    it("uses the configured year count for Term of Confidentiality when mode is 'years'", () => {
      const out = fillCoverPage(
        coverPageRaw,
        makeData({ confidentialityTerm: { mode: "years", years: 7 } }),
      );
      expect(out).toContain(
        "- [x]     7 year(s) from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws.",
      );
    });
  });

  describe("idempotence", () => {
    it("running fillCoverPage twice on the source yields the same output as running it once", () => {
      // Guard against the original bug where running fillCoverPage on a
      // previously-filled string would fail (the patterns expected
      // `[1 year(s)]` brackets but the filled output had bare `1 year(s)`).
      const once = fillCoverPage(coverPageRaw, makeData());
      const twice = fillCoverPage(once, makeData());
      expect(twice).toBe(once);
    });

    it("toggle roundtrip: years → perpetuity → years produces consistent output", () => {
      // A different invariant: switching the mode back to years with a
      // different year count should still produce exactly one [x] per pair.
      const years = makeData({
        ndaTerm: { mode: "expires", years: 1 },
        confidentialityTerm: { mode: "years", years: 1 },
      });
      const out1 = fillCoverPage(coverPageRaw, years);
      const perp = makeData({
        ndaTerm: { mode: "expires", years: 1 },
        confidentialityTerm: { mode: "perpetuity", years: 1 },
      });
      const out2 = fillCoverPage(out1, perp);
      const back = makeData({
        ndaTerm: { mode: "expires", years: 4 },
        confidentialityTerm: { mode: "years", years: 2 },
      });
      const out3 = fillCoverPage(out2, back);
      expect(countChecked(out3)).toBe(2);
      expect(out3).toContain("- [x]     Expires 4 year(s) from Effective Date.");
      expect(out3).toContain(
        "- [x]     2 year(s) from Effective Date, but in the case of trade secrets",
      );
    });
  });

  describe("literal substitution", () => {
    // `String#replace` with a string second argument interprets `$&`, `$1`,
    // `$$` etc. as backreferences. We dodge this by passing a function
    // replacement. This test pins that behaviour so a future refactor can't
    // accidentally re-introduce the vulnerability.
    it("passes user input through literally — does not expand $& / $1 / $$ in values", () => {
      const sneaky = makeData({
        party1: { name: "$$& Inc.", address: "" },
        party2: { name: "$1 LLC", address: "" },
        purpose: "$& ($1) ($$) ($') ($`)",
        governingLaw: "$&NY",
        jurisdiction: "$1County",
        effectiveDateDisplay: "$$today",
      });
      const out = fillCoverPage(coverPageRaw, sneaky);
      expect(out).toContain("|| $$& Inc. | $1 LLC |");
      expect(out).toContain("$& ($1) ($$) ($') ($`)");
      expect(out).toContain("Governing Law: $&NY");
      expect(out).toContain("Jurisdiction: $1County");
      expect(out).toContain("$$today");
    });
  });

  describe("edge cases", () => {
    it("renders an empty purpose string without leaving the placeholder bracket", () => {
      const out = fillCoverPage(coverPageRaw, makeData({ purpose: "" }));
      expect(out).toContain("### Purpose");
      expect(out).not.toContain(
        "[Evaluating whether to enter into a business relationship with the other party.]",
      );
    });
  });
});

// ============================================================================
// `<label>` caption rendering
// ============================================================================
//
// The Common Paper source uses inline `<label>…</label>` tags as
// captions under each heading. Plain-markdown renderers HTML-escape
// these (`<label>…</label>` → literal text in the preview), so
// `fillCoverPage` converts them to italic markdown (`*…*`).

describe("fillCoverPage label-tag rendering", () => {
  it("strips every <label>...</label> tag from the cover page", () => {
    const out = fillCoverPage(coverPageRaw, makeData());
    expect(out).not.toMatch(/<label>/);
    expect(out).not.toMatch(/<\/label>/);
  });

  it("renders each captured caption as italic markdown", () => {
    const out = fillCoverPage(coverPageRaw, makeData());
    // The four captions shipped in the canonical Common Paper cover page:
    expect(out).toContain("*How Confidential Information may be used*");
    expect(out).toContain("*The length of this MNDA*");
    expect(out).toContain("*How long Confidential Information is protected*");
    expect(out).toContain("*Use either email or postal address*");
  });

  it("places each caption on its own line (no leftover line break junk)", () => {
    const out = fillCoverPage(coverPageRaw, makeData());
    // Caption line should be its own paragraph, not glued to other content.
    expect(out).toMatch(/\n\*The length of this MNDA\*\n/);
  });

  it("is idempotent: re-stripping yields the same output", () => {
    const once = fillCoverPage(coverPageRaw, makeData());
    const twice = fillCoverPage(once, makeData());
    expect(twice).toBe(once);
  });

  it("does not strip user-injected `<label>` text from party names", () => {
    // The label strip runs on the source template BEFORE user data is
    // injected, so a user-injected `<label>...</label>` in their party
    // name passes through literally.
    const data = makeData({
      party1: {
        name: "<label>not a caption</label> Acme",
        address: "123 Main St",
      },
    });
    const out = fillCoverPage(coverPageRaw, data);
    expect(out).toContain("<label>not a caption</label> Acme");
  });
});

// ============================================================================
// fillStandardTerms
// ============================================================================

describe("fillStandardTerms", () => {
  it("substitutes the Purpose cross-reference (appears 3 times)", () => {
    const out = fillStandardTerms(
      standardTermsRaw,
      makeData({ purpose: "Joint R&D on widget X." }),
    );
    const matches = out.match(/Joint R&D on widget X\./g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(3);
    expect(out).not.toContain('class="coverpage_link">Purpose</span>');
  });

  it("substitutes Effective Date (appears 1 time)", () => {
    const out = fillStandardTerms(
      standardTermsRaw,
      makeData({ effectiveDateDisplay: "March 15, 2027" }),
    );
    expect(out).toContain("March 15, 2027");
    expect(out).not.toContain('class="coverpage_link">Effective Date</span>');
  });

  it("substitutes MNDA Term with the right phrase for each mode", () => {
    const expires = fillStandardTerms(
      standardTermsRaw,
      makeData({ ndaTerm: { mode: "expires", years: 2 } }),
    );
    expect(expires).toContain("expires at the end of the 2 year period.");

    const continues = fillStandardTerms(
      standardTermsRaw,
      makeData({ ndaTerm: { mode: "continues", years: 1 } }),
    );
    expect(continues).toContain("expires at the end of the term.");
  });

  it("substitutes Term of Confidentiality with the right phrase for each mode", () => {
    const years = fillStandardTerms(
      standardTermsRaw,
      makeData({ confidentialityTerm: { mode: "years", years: 3 } }),
    );
    expect(years).toContain("will survive for the 3 year term,");

    const perp = fillStandardTerms(
      standardTermsRaw,
      makeData({ confidentialityTerm: { mode: "perpetuity", years: 1 } }),
    );
    expect(perp).toContain("will survive for the perpetual term,");
  });

  it("substitutes Governing Law (appears 2 times in paragraph 9)", () => {
    const out = fillStandardTerms(
      standardTermsRaw,
      makeData({ governingLaw: "New York" }),
    );
    expect(out).toContain("laws of the State of New York");
    expect(out).toContain("conflict of laws provisions of such New York");
    expect(out).not.toContain('class="coverpage_link">Governing Law</span>');
  });

  it("substitutes Jurisdiction (appears 2 times in paragraph 9)", () => {
    const out = fillStandardTerms(
      standardTermsRaw,
      makeData({ jurisdiction: "San Francisco County, California" }),
    );
    expect(out).toContain(
      "must be instituted in the federal or state courts located in San Francisco County, California",
    );
    expect(out).toContain(
      "submits to the exclusive jurisdiction of such San Francisco County, California",
    );
    expect(out).not.toContain('class="coverpage_link">Jurisdiction</span>');
  });

  it("strips leftover coverpage_link spans from an unknown key", () => {
    // Inject a span that no known key matches. The defensive
    // `stripRemainingSpans` fallback should remove the markup and leave
    // the inner text content intact.
    const templateWithUnknown = standardTermsRaw.replace(
      /in connection with the <span class="coverpage_link">Purpose<\/span>/,
      `in connection with the <span class="coverpage_link">Future Key</span> is here,`,
    );
    const out = fillStandardTerms(templateWithUnknown, makeData());
    expect(out).not.toContain("<span class=\"coverpage_link\">");
    expect(out).not.toContain("</span>");
    expect(out).toContain("Future Key");
  });

  it("passes user input through literally in cross-reference substitutions", () => {
    // Same `$&`/`$1` guard as fillCoverPage — applies to the
    // standard-terms cross-reference values too.
    const out = fillStandardTerms(
      standardTermsRaw,
      makeData({
        purpose: "$& ($1) ($$)",
        governingLaw: "$&NY",
        jurisdiction: "$1County",
        effectiveDateDisplay: "$$today",
      }),
    );
    expect(out).toContain("$& ($1) ($$)");
    expect(out).toContain("State of $&NY");
    expect(out).toContain("courts located in $1County");
  });
});

// ============================================================================
// fillFullNda
// ============================================================================

describe("fillFullNda", () => {
  it("stitches cover page and standard terms separated by a horizontal rule", () => {
    const out = fillFullNda(coverPageRaw, standardTermsRaw, makeData());
    // Cover page text comes first…
    expect(out.startsWith("# Mutual Non-Disclosure Agreement")).toBe(true);
    // …then the separator…
    expect(out).toContain("\n\n---\n\n");
    // …then the standard terms.
    expect(out).toContain("# Standard Terms");
  });

  it("both halves are filled end-to-end", () => {
    const data = makeData({
      party1: { name: "Apollo", address: "1 Moon Base" },
      party2: { name: "Artemis", address: "2 Moon Base" },
      purpose: "Lunar cooperation.",
      governingLaw: "Texas",
    });
    const out = fillFullNda(coverPageRaw, standardTermsRaw, data);

    // Cover page substitutions.
    expect(out).toContain("|| Apollo | Artemis |");
    expect(out).toContain("Lunar cooperation.");
    expect(out).toContain("Governing Law: Texas");

    // Standard-terms substitutions.
    expect(out).toContain("State of Texas");
  });
});