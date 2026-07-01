import { describe, it, expect } from "vitest";
import {
  REGISTRY,
  getDocument,
  listDocuments,
  type DocId,
} from "./registry";

describe("document registry", () => {
  it("contains 11 unique user-facing entries (catalog has 12 files; MNDA cover page is folded under MNDA)", () => {
    expect(REGISTRY.length).toBe(11);
  });

  it("mnda is wired and the rest are not", () => {
    expect(getDocument("mnda")?.wired).toBe(true);
    for (const d of REGISTRY) {
      if (d.id === "mnda") continue;
      expect(d.wired, `${d.id} should be unwired`).toBe(false);
    }
  });

  it("ids are unique", () => {
    const ids = new Set(REGISTRY.map((d) => d.id));
    expect(ids.size).toBe(REGISTRY.length);
  });

  it("listDocuments returns a stable order", () => {
    expect(listDocuments().map((d) => d.id)).toEqual(
      REGISTRY.map((d) => d.id),
    );
  });

  it("every entry has a closestMatch that resolves to a known id", () => {
    for (const d of REGISTRY) {
      const target = getDocument(d.closestMatch);
      expect(target, `${d.closestMatch} referenced by ${d.id}`).toBeDefined();
    }
  });

  it("every entry has displayName and description from catalog.json", () => {
    for (const d of REGISTRY) {
      expect(d.displayName.length).toBeGreaterThan(0);
      expect(d.description.length).toBeGreaterThan(0);
    }
  });

  it("mnda has both template filenames; non-mnda does not", () => {
    expect(getDocument("mnda")?.coverPageFilename).toBe("mutual-nda-coverpage.md");
    expect(getDocument("mnda")?.standardTermsFilename).toBe("mutual-nda.md");
    for (const d of REGISTRY) {
      if (d.id === "mnda") continue;
      expect(d.coverPageFilename, `${d.id} should have no cover page`).toBeUndefined();
      expect(d.standardTermsFilename, `${d.id} should have no standard terms yet`).toBeUndefined();
    }
  });

  it("getDocument returns undefined for unknown ids", () => {
    expect(getDocument("nope" as DocId)).toBeUndefined();
  });
});
