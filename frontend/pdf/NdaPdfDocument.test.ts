import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// ============================================================================
// Regression test for the corruption that shipped in PR #4.
//
// During quality review of the PL-3 implementation, an over-broad
// `s. → pdfStyles.` Edit replace_all rewrote seven words inside template
// literals — `Terms` → `TermpdfStyles.`, `laws` → `lawpdfStyles.`, etc.
// The build only checks types, so the corrupted literals ended up rendered
// in the PDF. This test reads the source file as text and asserts no such
// corruption is present (legitimate `pdfStyles.<prop>` property accesses
// are stripped first).
// ============================================================================

describe("NdaPdfDocument source", () => {
  const source = readFileSync(
    path.join(process.cwd(), "pdf", "NdaPdfDocument.tsx"),
    "utf8",
  );

  // Strip legitimate property accesses (`pdfStyles.foo`) so the substring
  // check below only flags `<word>pdfStyles.` patterns.
  const stripped = source.replace(/pdfStyles\.[A-Za-z_][A-Za-z0-9_]*/g, "");

  it("contains no 'pdfStyles.' substring outside of property accesses", () => {
    expect(stripped.includes("pdfStyles.")).toBe(false);
  });

  // The seven words that were originally corrupted. Each must appear as
  // itself in the source — this is a human-narrative companion to the
  // substring check above, naming the historical examples for future
  // maintainers.
  const originallyCorrupted = [
    "Standard Terms.",
    "applicable laws.",
    "such rights.",
    "other remedies.",
    "voting securities.",
    "successors and assigns.",
    "signed by both parties.",
  ];

  it.each(originallyCorrupted)(
    "'%s' appears as itself, not suffixed with 'pdfStyles.'",
    (phrase) => {
      expect(source).toContain(phrase);
      expect(source).not.toContain(`${phrase.replace(/\.$/, "")}pdfStyles.`);
    },
  );
});