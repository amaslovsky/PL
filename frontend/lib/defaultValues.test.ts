import { describe, expect, it } from "vitest";
import { buildDefaultNdaFormData } from "@/lib/defaultValues";
import { formatLongDateUtc } from "@/lib/date";

describe("buildDefaultNdaFormData", () => {
  it("returns an object with all required top-level fields", () => {
    const data = buildDefaultNdaFormData();
    expect(data).toHaveProperty("party1");
    expect(data).toHaveProperty("party2");
    expect(data).toHaveProperty("purpose");
    expect(data).toHaveProperty("effectiveDate");
    expect(data).toHaveProperty("effectiveDateDisplay");
    expect(data).toHaveProperty("ndaTerm");
    expect(data).toHaveProperty("confidentialityTerm");
    expect(data).toHaveProperty("governingLaw");
    expect(data).toHaveProperty("jurisdiction");
  });

  it("uses the literal defaults that make the prototype demo on first paint", () => {
    const data = buildDefaultNdaFormData();
    expect(data.party1.name).toBe("Acme, Inc.");
    expect(data.party1.address).toBe("123 Main St, San Francisco, CA 94105");
    expect(data.party2.name).toBe("Beta Co.");
    expect(data.party2.address).toBe("456 Market St, San Francisco, CA 94105");
    expect(data.purpose).toBe(
      "Evaluating whether to enter into a business relationship with the other party.",
    );
    expect(data.governingLaw).toBe("Delaware");
    expect(data.jurisdiction).toBe("New Castle County, Delaware");
  });

  it("defaults both term modes to 'expires'/'years' with 1 year", () => {
    const data = buildDefaultNdaFormData();
    expect(data.ndaTerm).toEqual({ mode: "expires", years: 1 });
    expect(data.confidentialityTerm).toEqual({ mode: "years", years: 1 });
  });

  it("effectiveDate and effectiveDateDisplay agree (UTC consistency)", () => {
    // Regression guard for the SSR/hydration bug: previously these were
    // computed from two different Date objects in different timezones.
    // The display string must equal what you'd get by formatting the ISO
    // date as UTC midnight — i.e. the two fields are derived from a single
    // Date instance.
    const data = buildDefaultNdaFormData();
    expect(data.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(data.effectiveDateDisplay).toBe(
      formatLongDateUtc(new Date(`${data.effectiveDate}T00:00:00Z`)),
    );
  });
});