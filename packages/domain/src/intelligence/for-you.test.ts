import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import {
  forYouHumanCopy,
  rankForYouCandidates,
  type ForYouCandidateProduct,
} from "./for-you";

const retailerId = asId<"RetailerId">("11111111-1111-4111-8111-111111111111");

function candidate(
  overrides: Partial<ForYouCandidateProduct> &
    Pick<ForYouCandidateProduct, "productId" | "title">,
): ForYouCandidateProduct {
  return {
    retailerId,
    conceptLabels: [],
    inStock: true,
    owned: false,
    rejected: false,
    onWishlist: false,
    tieMateSaved: false,
    advisorMatched: false,
    declaredMatched: false,
    interestMatched: false,
    wardrobeGapMatched: false,
    occasionMatched: false,
    recentBehaviourMatched: false,
    ...overrides,
  };
}

describe("rankForYouCandidates", () => {
  it("suppresses owned, rejected, and out-of-stock products", () => {
    const projection = rankForYouCandidates({
      candidates: [
        candidate({
          productId: asId<"ProductId">("aaaaaaaa-aaaa-4aaa-8aaa-000000000001"),
          title: "Owned suit",
          owned: true,
          onWishlist: true,
        }),
        candidate({
          productId: asId<"ProductId">("aaaaaaaa-aaaa-4aaa-8aaa-000000000002"),
          title: "Rejected jacket",
          rejected: true,
          interestMatched: true,
        }),
        candidate({
          productId: asId<"ProductId">("aaaaaaaa-aaaa-4aaa-8aaa-000000000003"),
          title: "OOS shirt",
          inStock: false,
          onWishlist: true,
        }),
        candidate({
          productId: asId<"ProductId">("aaaaaaaa-aaaa-4aaa-8aaa-000000000004"),
          title: "Brown linen",
          onWishlist: true,
          interestMatched: true,
        }),
      ],
    });
    expect(projection.items).toHaveLength(1);
    expect(projection.items[0]?.title).toBe("Brown linen");
    expect(projection.suppressedOwned).toBe(1);
    expect(projection.suppressedRejected).toBe(1);
    expect(projection.suppressedOutOfStock).toBe(1);
    expect(projection.items[0]?.primaryReason).toBe("Because you saved this");
  });

  it("sorts deterministically and emits reason copy", () => {
    const projection = rankForYouCandidates({
      candidates: [
        candidate({
          productId: asId<"ProductId">("aaaaaaaa-aaaa-4aaa-8aaa-000000000010"),
          title: "A",
          interestMatched: true,
        }),
        candidate({
          productId: asId<"ProductId">("aaaaaaaa-aaaa-4aaa-8aaa-000000000009"),
          title: "B",
          onWishlist: true,
        }),
      ],
    });
    expect(projection.items[0]?.title).toBe("B");
    expect(projection.items[0]?.reasonCodes).toContain("wishlist_saved");
    expect(
      forYouHumanCopy({
        reasonCodes: ["recent_interest"],
        conceptHint: "brown linen tailoring",
      }),
    ).toBe("Because you have been exploring brown linen tailoring");
  });
});
