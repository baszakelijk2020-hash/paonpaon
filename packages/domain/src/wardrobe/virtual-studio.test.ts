import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import {
  buildFitArchetypeOptions,
  canCancelWardrobeVisualizationJob,
  canGenerateWardrobeVisualization,
  canonicalizeWardrobeVisualizationInput,
  deriveTailoringAttributesFromFitArchetype,
  isPositiveWardrobeVisualizationSignal,
  isPresetSafeForGeneration,
  isStylePortraitTerminal,
  isWardrobeVisualizationJobTerminal,
  stylePortraitTransitionIssues,
  type WardrobeVisualizationInputSnapshot,
} from "./virtual-studio";

describe("canGenerateWardrobeVisualization", () => {
  it("requires both a granted status and acknowledged disclosures", () => {
    expect(
      canGenerateWardrobeVisualization({
        retailerId: asId("retailer-1"),
        customerId: asId("customer-1"),
        status: "granted",
        disclosuresAcknowledged: true,
      }),
    ).toBe(true);
  });

  it("refuses when granted but disclosures were never shown", () => {
    expect(
      canGenerateWardrobeVisualization({
        retailerId: asId("retailer-1"),
        customerId: asId("customer-1"),
        status: "granted",
        disclosuresAcknowledged: false,
      }),
    ).toBe(false);
  });

  it("refuses when withdrawn even if disclosures were once acknowledged", () => {
    expect(
      canGenerateWardrobeVisualization({
        retailerId: asId("retailer-1"),
        customerId: asId("customer-1"),
        status: "withdrawn",
        disclosuresAcknowledged: true,
      }),
    ).toBe(false);
  });
});

describe("stylePortraitTransitionIssues", () => {
  it("allows generating a preview from draft with both required references", () => {
    expect(
      stylePortraitTransitionIssues({
        action: "generate_preview",
        currentStatus: "draft",
        hasFaceReference: true,
        hasFullBodyReference: true,
      }),
    ).toEqual([]);
  });

  it("refuses generating a preview without a face or full-body reference", () => {
    const issues = stylePortraitTransitionIssues({
      action: "generate_preview",
      currentStatus: "draft",
      hasFaceReference: false,
      hasFullBodyReference: false,
    });
    expect(issues).toContain("missing_face_reference");
    expect(issues).toContain("missing_full_body_reference");
  });

  it("refuses approving from draft (must have a generated preview first)", () => {
    expect(
      stylePortraitTransitionIssues({
        action: "approve",
        currentStatus: "draft",
        hasFaceReference: true,
        hasFullBodyReference: true,
      }),
    ).toEqual(["invalid_from_status"]);
  });

  it("allows superseding only from approved", () => {
    expect(
      stylePortraitTransitionIssues({
        action: "supersede",
        currentStatus: "approved",
        hasFaceReference: true,
        hasFullBodyReference: true,
      }),
    ).toEqual([]);
  });
});

describe("isStylePortraitTerminal", () => {
  it("is terminal only for rejected/superseded", () => {
    expect(isStylePortraitTerminal("rejected")).toBe(true);
    expect(isStylePortraitTerminal("superseded")).toBe(true);
    expect(isStylePortraitTerminal("draft")).toBe(false);
    expect(isStylePortraitTerminal("approved")).toBe(false);
  });
});

describe("deriveTailoringAttributesFromFitArchetype", () => {
  it("gives every archetype a distinct, deterministic attribute set", () => {
    const slim = deriveTailoringAttributesFromFitArchetype("slim");
    const fashionWide =
      deriveTailoringAttributesFromFitArchetype("fashion_wide");
    expect(slim.lapelWidth).toBe("narrow");
    expect(fashionWide.lapelWidth).toBe("wide");
    expect(slim).not.toEqual(fashionWide);
    // Deterministic: same input always produces the same object shape.
    expect(deriveTailoringAttributesFromFitArchetype("slim")).toEqual(slim);
  });

  it("covers every declared archetype slug", () => {
    for (const slug of [
      "slim",
      "classic",
      "contemporary",
      "fashion_wide",
    ] as const) {
      expect(() =>
        deriveTailoringAttributesFromFitArchetype(slug),
      ).not.toThrow();
    }
  });
});

describe("isPresetSafeForGeneration", () => {
  it("is true only when bodyModificationProhibited is literally true", () => {
    expect(
      isPresetSafeForGeneration({ bodyModificationProhibited: true }),
    ).toBe(true);
  });
});

describe("canonicalizeWardrobeVisualizationInput", () => {
  const baseSnapshot: WardrobeVisualizationInputSnapshot = {
    outfitId: asId("outfit-1"),
    stylePortraitId: asId("portrait-1"),
    stylePortraitVersion: 2,
    retailerVisualPresetId: asId("preset-1"),
    tailoringAttributes: deriveTailoringAttributesFromFitArchetype("classic"),
    providerName: "openai",
    model: "test-model",
  };

  it("is stable regardless of tailoring-attribute key construction order", () => {
    const reordered: WardrobeVisualizationInputSnapshot = {
      ...baseSnapshot,
      tailoringAttributes: {
        trouserBreak: baseSnapshot.tailoringAttributes.trouserBreak,
        legWidth: baseSnapshot.tailoringAttributes.legWidth,
        thighEase: baseSnapshot.tailoringAttributes.thighEase,
        trouserRise: baseSnapshot.tailoringAttributes.trouserRise,
        sleeveWidth: baseSnapshot.tailoringAttributes.sleeveWidth,
        shoulderExpression: baseSnapshot.tailoringAttributes.shoulderExpression,
        jacketLength: baseSnapshot.tailoringAttributes.jacketLength,
        waistSuppression: baseSnapshot.tailoringAttributes.waistSuppression,
        lapelWidth: baseSnapshot.tailoringAttributes.lapelWidth,
      },
    };
    expect(canonicalizeWardrobeVisualizationInput(baseSnapshot)).toBe(
      canonicalizeWardrobeVisualizationInput(reordered),
    );
  });

  it("changes when the outfit differs", () => {
    const different: WardrobeVisualizationInputSnapshot = {
      ...baseSnapshot,
      outfitId: asId("outfit-2"),
    };
    expect(canonicalizeWardrobeVisualizationInput(baseSnapshot)).not.toBe(
      canonicalizeWardrobeVisualizationInput(different),
    );
  });

  it("treats absent written instructions the same as an empty string", () => {
    const withEmpty: WardrobeVisualizationInputSnapshot = {
      ...baseSnapshot,
      writtenInstructions: "",
    };
    expect(canonicalizeWardrobeVisualizationInput(baseSnapshot)).toBe(
      canonicalizeWardrobeVisualizationInput(withEmpty),
    );
  });
});

describe("wardrobe visualization job status helpers", () => {
  it("treats ready/failed/cancelled as terminal", () => {
    expect(isWardrobeVisualizationJobTerminal("ready")).toBe(true);
    expect(isWardrobeVisualizationJobTerminal("failed")).toBe(true);
    expect(isWardrobeVisualizationJobTerminal("cancelled")).toBe(true);
    expect(isWardrobeVisualizationJobTerminal("queued")).toBe(false);
    expect(isWardrobeVisualizationJobTerminal("generating")).toBe(false);
  });

  it("only allows cancellation while queued", () => {
    expect(canCancelWardrobeVisualizationJob("queued")).toBe(true);
    expect(canCancelWardrobeVisualizationJob("generating")).toBe(false);
    expect(canCancelWardrobeVisualizationJob("ready")).toBe(false);
  });
});

describe("isPositiveWardrobeVisualizationSignal", () => {
  it("treats love_it and save as positive", () => {
    expect(isPositiveWardrobeVisualizationSignal("love_it")).toBe(true);
    expect(isPositiveWardrobeVisualizationSignal("save")).toBe(true);
  });

  it("treats everything else as not positive", () => {
    expect(isPositiveWardrobeVisualizationSignal("not_for_me")).toBe(false);
    expect(isPositiveWardrobeVisualizationSignal("fit_correction")).toBe(false);
    expect(isPositiveWardrobeVisualizationSignal("looks_like_me_no")).toBe(
      false,
    );
  });
});

describe("buildFitArchetypeOptions", () => {
  const concepts = [
    {
      id: asId<"MetadataConceptId">("concept-slim"),
      slug: "fit-archetype-slim",
      canonicalName: "Slim",
      attributes: { isFitArchetype: true, order: 1, description: "Close cut." },
    },
    {
      id: asId<"MetadataConceptId">("concept-fashion-wide"),
      slug: "fit-archetype-fashion-wide",
      canonicalName: "Fashion Wide",
      attributes: {
        isFitArchetype: true,
        order: 4,
        description: "Expressive.",
      },
    },
    {
      id: asId<"MetadataConceptId">("concept-regular"),
      slug: "fit-regular",
      canonicalName: "Regular",
      attributes: {},
    },
  ];

  it("only includes concepts flagged isFitArchetype", () => {
    const options = buildFitArchetypeOptions(concepts);
    expect(options).toHaveLength(2);
    expect(options.every((option) => option.slug !== undefined)).toBe(true);
  });

  it("maps the slug prefix to the FitArchetypeSlug, converting hyphens", () => {
    const options = buildFitArchetypeOptions(concepts);
    const fashionWide = options.find(
      (option) => option.label === "Fashion Wide",
    );
    expect(fashionWide?.slug).toBe("fashion_wide");
  });

  it("sorts by declared order", () => {
    const options = buildFitArchetypeOptions(concepts);
    expect(options.map((option) => option.label)).toEqual([
      "Slim",
      "Fashion Wide",
    ]);
  });
});
