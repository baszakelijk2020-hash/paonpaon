import { describe, expect, it } from "vitest";

import type { MetadataConcept } from "../metadata/metadata";
import { asId } from "../shared/branded-id";

import { resolveCatalogueIntent } from "./catalogue-intent";

const retailerId = asId<"RetailerId">("00000000-0000-4000-8000-0000000000a1");

function concept(
  partial: Pick<MetadataConcept, "id" | "kind" | "slug" | "canonicalName"> &
    Partial<MetadataConcept>,
): MetadataConcept {
  return {
    retailerId: null,
    attributes: {},
    active: true,
    createdAt: "2026-07-30T00:00:00.000Z",
    updatedAt: "2026-07-30T00:00:00.000Z",
    deletedAt: null,
    ...partial,
  };
}

const wrinkle = concept({
  id: asId<"MetadataConceptId">("00000000-0000-4000-8000-0000000000c1"),
  kind: "performance",
  slug: "wrinkle-resistant",
  canonicalName: "Wrinkle resistant",
});
const wedding = concept({
  id: asId<"MetadataConceptId">("00000000-0000-4000-8000-0000000000c2"),
  kind: "occasion",
  slug: "wedding",
  canonicalName: "Wedding",
});
const humid = concept({
  id: asId<"MetadataConceptId">("00000000-0000-4000-8000-0000000000c3"),
  kind: "climate",
  slug: "humid",
  canonicalName: "Humid climate",
});
const softFibre = concept({
  id: asId<"MetadataConceptId">("00000000-0000-4000-8000-0000000000c4"),
  kind: "fibre",
  slug: "cashmere",
  canonicalName: "Cashmere",
});
const navy = concept({
  id: asId<"MetadataConceptId">("00000000-0000-4000-8000-0000000000c5"),
  kind: "colour",
  slug: "navy",
  canonicalName: "Navy",
});
const inactive = concept({
  id: asId<"MetadataConceptId">("00000000-0000-4000-8000-0000000000c6"),
  kind: "performance",
  slug: "travel-ready",
  canonicalName: "Travel ready",
  active: false,
});

const catalogue = [wrinkle, wedding, humid, softFibre, navy, inactive];

describe("resolveCatalogueIntent", () => {
  it("maps known intents to explainable concept filters and ranges", () => {
    const result = resolveCatalogueIntent("summer wedding", catalogue);
    expect(result.matches.map((m) => m.phrase)).toContain("summer wedding");
    expect(result.resolvedConceptIds).toContain(wedding.id);
    expect(result.ranges.maxWeight).toBe(280);
    expect(result.unresolvedTokens).toEqual([]);
    expect(result.sortHint).toBe("relevance");
  });

  it("maps wrinkles, humidity, travel, formality, and softness", () => {
    expect(
      resolveCatalogueIntent("I dislike wrinkles", catalogue)
        .resolvedConceptIds,
    ).toContain(wrinkle.id);
    expect(
      resolveCatalogueIntent("humidity", catalogue).resolvedConceptIds,
    ).toContain(humid.id);
    expect(
      resolveCatalogueIntent("softness", catalogue).resolvedConceptIds,
    ).toContain(softFibre.id);
  });

  it("matches approved concept tokens without fabricating unknowns", () => {
    const result = resolveCatalogueIntent("navy unicorn fabric", catalogue);
    expect(result.resolvedConceptIds).toContain(navy.id);
    expect(result.unresolvedTokens).toEqual(
      expect.arrayContaining(["unicorn", "fabric"]),
    );
  });

  it("reports fully unresolved language without inventing matches", () => {
    const result = resolveCatalogueIntent("purple spaceship tuxedo", catalogue);
    expect(result.resolvedConceptIds).toEqual([]);
    expect(result.matches).toEqual([]);
    expect(result.unresolvedTokens).toEqual(
      expect.arrayContaining(["purple", "spaceship", "tuxedo"]),
    );
    expect(result.sortHint).toBe("newest");
  });

  it("ignores inactive concepts", () => {
    const result = resolveCatalogueIntent("travel", catalogue);
    expect(result.resolvedConceptIds).not.toContain(inactive.id);
    void retailerId;
  });
});
