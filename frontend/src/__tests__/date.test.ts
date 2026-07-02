import { formatIsoAsLongDateUtc, formatLongDateUtc, todayIsoUtc } from "@/utils/date";

// ============================================================================
// todayIsoUtc
// ============================================================================

describe("todayIsoUtc", () => {
  it("returns a yyyy-mm-dd string", () => {
    expect(todayIsoUtc()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("matches the UTC date portion of `new Date().toISOString()`", () => {
    expect(todayIsoUtc()).toBe(new Date().toISOString().slice(0, 10));
  });
});

// ============================================================================
// formatLongDateUtc
// ============================================================================

describe("formatLongDateUtc", () => {
  it("formats a known UTC date as 'Month D, YYYY'", () => {
    expect(formatLongDateUtc(new Date(Date.UTC(2026, 5, 30)))).toBe("June 30, 2026");
  });

  it("formats the first and last day of a month correctly", () => {
    expect(formatLongDateUtc(new Date(Date.UTC(2025, 0, 1)))).toBe("January 1, 2025");
    expect(formatLongDateUtc(new Date(Date.UTC(2025, 11, 31)))).toBe("December 31, 2025");
  });
});

// ============================================================================
// formatIsoAsLongDateUtc
// ============================================================================

describe("formatIsoAsLongDateUtc", () => {
  it("returns '' for an empty input", () => {
    expect(formatIsoAsLongDateUtc("")).toBe("");
  });

  it("formats ISO date strings in UTC", () => {
    expect(formatIsoAsLongDateUtc("2026-06-30")).toBe("June 30, 2026");
  });

  it("handles leap-year dates correctly", () => {
    expect(formatIsoAsLongDateUtc("2024-02-29")).toBe("February 29, 2024");
  });

  it("throws RangeError on malformed input (caller must validate)", () => {
    // Documents the current behaviour: there is no defensive coercion.
    // A future change to validate input would intentionally change this.
    expect(() => formatIsoAsLongDateUtc("not-a-date")).toThrow(RangeError);
  });
});