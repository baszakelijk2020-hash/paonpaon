import { describe, expect, it } from "vitest";

import type { MetadataConcept } from "../metadata/metadata";
import { asId } from "../shared/branded-id";

import {
  buildStyleQuizArchetypes,
  buildStyleQuizTweakQuestions,
  hasChosenStyleArchetype,
} from "./style-quiz";

function concept(input: {
  id: string;
  kind: MetadataConcept["kind"];
  slug: string;
  canonicalName: string;
  attributes?: Record<string, unknown>;
}): MetadataConcept {
  return {
    id: asId<"MetadataConceptId">(input.id),
    retailerId: null,
    kind: input.kind,
    slug: input.slug,
    canonicalName: input.canonicalName,
    attributes: input.attributes ?? {},
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("buildStyleQuizArchetypes", () => {
  it("keeps only style concepts flagged isArchetype, sorted by order", () => {
    const concepts: MetadataConcept[] = [
      concept({
        id: "00000000-0000-4000-8000-000000000002",
        kind: "style",
        slug: "archetype-b",
        canonicalName: "Archetype B",
        attributes: { isArchetype: true, order: 2, emoji: "🎩" },
      }),
      concept({
        id: "00000000-0000-4000-8000-000000000001",
        kind: "style",
        slug: "archetype-a",
        canonicalName: "Archetype A",
        attributes: { isArchetype: true, order: 1, emoji: "🧵" },
      }),
      concept({
        id: "00000000-0000-4000-8000-000000000099",
        kind: "style",
        slug: "not-an-archetype",
        canonicalName: "Unrelated style concept",
        attributes: {},
      }),
    ];

    const archetypes = buildStyleQuizArchetypes(concepts);

    expect(archetypes.map((a) => a.slug)).toEqual([
      "archetype-a",
      "archetype-b",
    ]);
    expect(archetypes[0]?.emoji).toBe("🧵");
  });
});

describe("buildStyleQuizTweakQuestions", () => {
  it("groups tweak concepts by tweakGroup and sorts groups and options", () => {
    const concepts: MetadataConcept[] = [
      concept({
        id: "00000000-0000-4000-8000-000000000011",
        kind: "fit",
        slug: "fit-regular",
        canonicalName: "Regular",
        attributes: {
          tweakGroup: "fit",
          question: "How do you like your fit?",
          groupOrder: 1,
          order: 2,
        },
      }),
      concept({
        id: "00000000-0000-4000-8000-000000000010",
        kind: "fit",
        slug: "fit-slim",
        canonicalName: "Slim",
        attributes: {
          tweakGroup: "fit",
          question: "How do you like your fit?",
          groupOrder: 1,
          order: 1,
        },
      }),
      concept({
        id: "00000000-0000-4000-8000-000000000020",
        kind: "colour",
        slug: "colour-neutral",
        canonicalName: "Neutral tones",
        attributes: {
          tweakGroup: "colour",
          question: "What's your colour comfort zone?",
          groupOrder: 2,
          order: 1,
        },
      }),
      concept({
        id: "00000000-0000-4000-8000-000000000099",
        kind: "colour",
        slug: "not-a-tweak",
        canonicalName: "Unrelated colour concept",
        attributes: {},
      }),
    ];

    const questions = buildStyleQuizTweakQuestions(concepts);

    expect(questions).toHaveLength(2);
    expect(questions[0]?.group).toBe("fit");
    expect(questions[0]?.options.map((o) => o.slug)).toEqual([
      "fit-slim",
      "fit-regular",
    ]);
    expect(questions[1]?.group).toBe("colour");
    expect(questions[1]?.options).toHaveLength(1);
  });
});

describe("hasChosenStyleArchetype", () => {
  it("is true only when a declared concept id matches an archetype", () => {
    const archetypes = buildStyleQuizArchetypes([
      concept({
        id: "00000000-0000-4000-8000-000000000001",
        kind: "style",
        slug: "archetype-a",
        canonicalName: "Archetype A",
        attributes: { isArchetype: true, order: 1 },
      }),
    ]);

    expect(
      hasChosenStyleArchetype(
        archetypes,
        new Set(["00000000-0000-4000-8000-000000000001"]),
      ),
    ).toBe(true);
    expect(
      hasChosenStyleArchetype(
        archetypes,
        new Set(["00000000-0000-4000-8000-000000000999"]),
      ),
    ).toBe(false);
  });
});
