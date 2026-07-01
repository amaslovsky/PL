import { describe, it, expect } from "vitest";
import { ALIASES } from "./registry";
import { getDocument, type DocId } from "./registry";

describe("closest-match aliases", () => {
  it("maps known colloquial names to real docs", () => {
    expect(ALIASES.mou).toBe("mnda");
    expect(ALIASES.hipaa).toBe("business-associate-agreement");
    expect(ALIASES.baa).toBe("business-associate-agreement");
    expect(ALIASES.gdpr).toBe("data-processing-agreement");
    expect(ALIASES.sow).toBe("professional-services-agreement");
    expect(ALIASES.csa).toBe("cloud-service-agreement");
    expect(ALIASES.sla).toBe("service-level-agreement");
  });

  it("all alias targets resolve to a registered document", () => {
    for (const [alias, target] of Object.entries(ALIASES)) {
      const doc = getDocument(target as DocId);
      expect(doc, `alias "${alias}" -> "${target}"`).toBeDefined();
    }
  });
});
