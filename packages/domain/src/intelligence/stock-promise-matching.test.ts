import { describe, expect, it } from "vitest";

import { matchStockNewsToPromises } from "./stock-promise-matching";

const baseCandidate = {
  id: "opp-1",
  type: "advisor_commitment",
  status: "accepted",
  whyNow: "Promised to call about linen jackets arriving",
  suggestedAction: "Call once the linen jackets are in",
};

describe("matchStockNewsToPromises", () => {
  it("matches a stock update sharing real words with an open promise", () => {
    const result = matchStockNewsToPromises({
      stockUpdateText: "New linen jackets arrived, sizes 40-44",
      candidates: [baseCandidate],
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.opportunityId).toBe("opp-1");
    expect(result[0]!.overlappingWords).toContain("linen");
    expect(result[0]!.overlappingWords).toContain("jackets");
  });

  it("never matches when nothing overlaps", () => {
    const result = matchStockNewsToPromises({
      stockUpdateText: "New silk pocket squares arrived",
      candidates: [baseCandidate],
    });
    expect(result).toEqual([]);
  });

  it("ignores a dismissed opportunity even if the words overlap", () => {
    const result = matchStockNewsToPromises({
      stockUpdateText: "New linen jackets arrived",
      candidates: [{ ...baseCandidate, status: "dismissed" }],
    });
    expect(result).toEqual([]);
  });

  it("ignores a completed opportunity even if the words overlap", () => {
    const result = matchStockNewsToPromises({
      stockUpdateText: "New linen jackets arrived",
      candidates: [{ ...baseCandidate, status: "completed" }],
    });
    expect(result).toEqual([]);
  });

  it("ignores an opportunity type not named in this item's own owner boundary", () => {
    const result = matchStockNewsToPromises({
      stockUpdateText: "New linen jackets arrived",
      candidates: [{ ...baseCandidate, type: "wardrobe_gap" }],
    });
    expect(result).toEqual([]);
  });

  it("ranks a stronger overlap above a weaker one", () => {
    const weak = {
      ...baseCandidate,
      id: "opp-weak",
      whyNow: "Mentioned interest in jackets once",
      suggestedAction: "Follow up sometime",
    };
    const strong = {
      ...baseCandidate,
      id: "opp-strong",
      whyNow: "Promised a call about linen jackets specifically",
      suggestedAction: "Call about linen jackets the moment they arrive",
    };
    const result = matchStockNewsToPromises({
      stockUpdateText: "New linen jackets arrived",
      candidates: [weak, strong],
    });
    expect(result[0]!.opportunityId).toBe("opp-strong");
  });

  it("returns nothing for a blank stock update", () => {
    expect(
      matchStockNewsToPromises({
        stockUpdateText: "   ",
        candidates: [baseCandidate],
      }),
    ).toEqual([]);
  });
});
