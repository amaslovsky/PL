import { ndaTermPhrase, confidentialityTermPhrase } from "@/utils/terms";
import { makeData } from "@/__tests__/makeData";

describe("ndaTermPhrase", () => {
  it("uses singular 'year' when n=1", () => {
    expect(ndaTermPhrase(makeData({ ndaTerm: { mode: "expires", years: 1 } })))
      .toBe("1 year period");
  });

  it("uses plural 'year' when n>1", () => {
    expect(ndaTermPhrase(makeData({ ndaTerm: { mode: "expires", years: 3 } })))
      .toBe("3 year period");
  });

  it("returns 'term' regardless of years in continues mode", () => {
    expect(ndaTermPhrase(makeData({ ndaTerm: { mode: "continues", years: 5 } })))
      .toBe("term");
  });
});

describe("confidentialityTermPhrase", () => {
  it("uses singular 'year' when n=1", () => {
    expect(confidentialityTermPhrase(
      makeData({ confidentialityTerm: { mode: "years", years: 1 } }),
    )).toBe("1 year term");
  });

  it("uses plural 'year' when n>1", () => {
    expect(confidentialityTermPhrase(
      makeData({ confidentialityTerm: { mode: "years", years: 5 } }),
    )).toBe("5 year term");
  });

  it("returns 'perpetual term' regardless of years in perpetuity mode", () => {
    expect(confidentialityTermPhrase(
      makeData({ confidentialityTerm: { mode: "perpetuity", years: 99 } }),
    )).toBe("perpetual term");
  });
});