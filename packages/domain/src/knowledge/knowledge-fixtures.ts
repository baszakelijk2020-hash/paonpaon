import { asId } from "../shared/branded-id";

import type { KnowledgeObject, KnowledgeTopic } from "./knowledge";

/**
 * Neutral, reviewed-shape canonical fixtures for every EDU-001 topic.
 * Copy is intentionally generic so missing founder editorial assets do not
 * block contracts; inactive rows mark unapproved editorial placeholders.
 *
 * Stable UUIDs keep SQL seed and TypeScript fixtures idempotent.
 */
export interface CanonicalKnowledgeFixture {
  readonly id: string;
  readonly topic: KnowledgeTopic;
  readonly title: string;
  readonly slug: string;
  readonly summary: string;
  readonly body: string;
  readonly displayTypes: KnowledgeObject["displayTypes"];
  readonly commercialIntent: KnowledgeObject["commercialIntent"];
  readonly priority: number;
  readonly active: boolean;
  readonly conceptSlug: string;
  readonly conceptKind: string;
  readonly conceptId: string;
  readonly conceptJoinId: string;
  readonly matchStrength: number;
}

const FIXTURE_NAMESPACE = "a1000000-0000-4000-8000";

function fixtureId(suffix: string): string {
  return `${FIXTURE_NAMESPACE}-${suffix}`;
}

export const CANONICAL_KNOWLEDGE_FIXTURES: readonly CanonicalKnowledgeFixture[] =
  [
    {
      id: fixtureId("000000000001"),
      topic: "mill",
      title: "What a mill signals",
      slug: "what-a-mill-signals",
      summary:
        "A mill name is a provenance cue: cloth origin, finishing standards, and expected hand.",
      body: "Neutral fixture: mills explain why cloth provenance affects feel, longevity, and price without naming unapproved house copy.",
      displayTypes: ["information_card"],
      commercialIntent: "educate",
      priority: 100,
      active: true,
      conceptKind: "mill",
      conceptSlug: "knowledge-fixture-mill",
      conceptId: fixtureId("100000000001"),
      conceptJoinId: fixtureId("200000000001"),
      matchStrength: 1,
    },
    {
      id: fixtureId("000000000002"),
      topic: "fibre",
      title: "Why fibre composition matters",
      slug: "why-fibre-composition-matters",
      summary:
        "Fibre choice shapes breathability, drape, crease behaviour, and care demands.",
      body: "Neutral fixture: fibres explain who a cloth suits and what tradeoffs follow from wool, linen, silk, cotton, or blends.",
      displayTypes: ["information_card", "tooltip"],
      commercialIntent: "educate",
      priority: 90,
      active: true,
      conceptKind: "fibre",
      conceptSlug: "knowledge-fixture-fibre",
      conceptId: fixtureId("100000000002"),
      conceptJoinId: fixtureId("200000000002"),
      matchStrength: 1,
    },
    {
      id: fixtureId("000000000003"),
      topic: "fabric",
      title: "Reading a fabric profile",
      slug: "reading-a-fabric-profile",
      summary:
        "Weight, hand, and seasonality turn composition into a practical buying brief.",
      body: "Neutral fixture: fabric profiles connect composition and weight to climate and use without inventing product facts.",
      displayTypes: ["information_card", "accordion"],
      commercialIntent: "justify_premium",
      priority: 80,
      active: true,
      conceptKind: "fabric_collection",
      conceptSlug: "knowledge-fixture-fabric",
      conceptId: fixtureId("100000000003"),
      conceptJoinId: fixtureId("200000000003"),
      matchStrength: 0.9,
    },
    {
      id: fixtureId("000000000004"),
      topic: "weave",
      title: "Weave and pattern cues",
      slug: "weave-and-pattern-cues",
      summary:
        "Weave structure changes resilience, openness, and visual formality.",
      body: "Neutral fixture: weaves such as tropical, hopsack, or herringbone explain performance and styling effects.",
      displayTypes: ["information_card"],
      commercialIntent: "educate",
      priority: 70,
      active: true,
      conceptKind: "weave",
      conceptSlug: "knowledge-fixture-weave",
      conceptId: fixtureId("100000000004"),
      conceptJoinId: fixtureId("200000000004"),
      matchStrength: 1,
    },
    {
      id: fixtureId("000000000005"),
      topic: "construction",
      title: "Construction and comfort",
      slug: "construction-and-comfort",
      summary:
        "Canvas, lining, and soft construction decide shape retention versus ease.",
      body: "Neutral fixture: construction topics explain fit feel and longevity tradeoffs for tailored garments.",
      displayTypes: ["information_card", "comparison"],
      commercialIntent: "upgrade",
      priority: 60,
      active: true,
      conceptKind: "construction",
      conceptSlug: "knowledge-fixture-construction",
      conceptId: fixtureId("100000000005"),
      conceptJoinId: fixtureId("200000000005"),
      matchStrength: 1,
    },
    {
      id: fixtureId("000000000006"),
      topic: "collar",
      title: "Collar detail and shirt options",
      slug: "collar-detail-and-shirt-options",
      summary:
        "Collar geometry changes face framing, formality, and accessory pairing.",
      body: "Neutral fixture: collar education covers options such as one-piece constructions without unverified brand claims.",
      displayTypes: ["information_card", "tooltip"],
      commercialIntent: "cross_sell",
      priority: 50,
      active: true,
      conceptKind: "collar",
      conceptSlug: "knowledge-fixture-collar",
      conceptId: fixtureId("100000000006"),
      conceptJoinId: fixtureId("200000000006"),
      matchStrength: 1,
    },
    {
      id: fixtureId("000000000007"),
      topic: "styling",
      title: "Styling compatibility basics",
      slug: "styling-compatibility-basics",
      summary:
        "Compatible pairings keep formality, colour, and fabric weight coherent.",
      body: "Neutral fixture: styling cards outline complete-look guidance grounded in approved concepts.",
      displayTypes: ["information_card", "advisor_answer"],
      commercialIntent: "cross_sell",
      priority: 40,
      active: true,
      conceptKind: "style",
      conceptSlug: "knowledge-fixture-styling",
      conceptId: fixtureId("100000000007"),
      conceptJoinId: fixtureId("200000000007"),
      matchStrength: 0.85,
    },
    {
      id: fixtureId("000000000008"),
      topic: "care",
      title: "Care expectations",
      slug: "care-expectations",
      summary:
        "Care guidance protects cloth investment and sets honest ownership effort.",
      body: "Neutral fixture: care topics explain cleaning, pressing, and storage demands tied to fibre and finish.",
      displayTypes: ["accordion", "tooltip"],
      commercialIntent: "educate",
      priority: 30,
      active: true,
      conceptKind: "care",
      conceptSlug: "knowledge-fixture-care",
      conceptId: fixtureId("100000000008"),
      conceptJoinId: fixtureId("200000000008"),
      matchStrength: 1,
    },
    {
      id: fixtureId("000000000009"),
      topic: "performance",
      title: "Performance in real conditions",
      slug: "performance-in-real-conditions",
      summary:
        "Breathability, crease resistance, and travel behaviour follow weave and fibre.",
      body: "Neutral fixture: performance cards connect climate and use cases without inventing lab claims.",
      displayTypes: ["information_card", "comparison"],
      commercialIntent: "justify_premium",
      priority: 20,
      active: true,
      conceptKind: "performance",
      conceptSlug: "knowledge-fixture-performance",
      conceptId: fixtureId("100000000009"),
      conceptJoinId: fixtureId("200000000009"),
      matchStrength: 1,
    },
    {
      id: fixtureId("000000000010"),
      topic: "occasion",
      title: "Occasion and formality fit",
      slug: "occasion-and-formality-fit",
      summary:
        "Occasion cues translate dress codes into cloth, colour, and construction choices.",
      body: "Neutral fixture: occasion education supports wedding, travel, and business contexts from approved metadata.",
      displayTypes: ["information_card", "advisor_answer"],
      commercialIntent: "appointment",
      priority: 10,
      active: true,
      conceptKind: "occasion",
      conceptSlug: "knowledge-fixture-occasion",
      conceptId: fixtureId("100000000010"),
      conceptJoinId: fixtureId("200000000010"),
      matchStrength: 1,
    },
    {
      id: fixtureId("000000000011"),
      topic: "value",
      title: "Where value accumulates",
      slug: "where-value-accumulates",
      summary:
        "Value follows cloth quality, construction longevity, and reuse across occasions.",
      body: "Neutral fixture: value cards justify premium choices through durability and versatility, not discount framing.",
      displayTypes: ["information_card"],
      commercialIntent: "justify_premium",
      priority: 5,
      active: true,
      conceptKind: "compatibility",
      conceptSlug: "knowledge-fixture-value",
      conceptId: fixtureId("100000000011"),
      conceptJoinId: fixtureId("200000000011"),
      matchStrength: 0.75,
    },
    {
      id: fixtureId("000000000012"),
      topic: "tradeoff",
      title: "Honest tradeoffs",
      slug: "honest-tradeoffs",
      summary:
        "Every cloth and construction choice trades comfort, formality, or care effort.",
      body: "Neutral fixture: tradeoff cards keep recommendations explainable when two good options conflict.",
      displayTypes: ["comparison", "advisor_answer"],
      commercialIntent: "educate",
      priority: 0,
      active: true,
      conceptKind: "compatibility",
      conceptSlug: "knowledge-fixture-tradeoff",
      conceptId: fixtureId("100000000012"),
      conceptJoinId: fixtureId("200000000012"),
      matchStrength: 0.8,
    },
    {
      id: fixtureId("000000000013"),
      topic: "mill",
      title: "Unapproved mill editorial placeholder",
      slug: "unapproved-mill-editorial-placeholder",
      summary:
        "Placeholder reserved for founder-approved mill storytelling and imagery.",
      body: "Inactive until reviewed production copy and images are approved.",
      displayTypes: ["information_card"],
      commercialIntent: "educate",
      priority: -10,
      active: false,
      conceptKind: "mill",
      conceptSlug: "knowledge-fixture-mill",
      conceptId: fixtureId("100000000001"),
      conceptJoinId: fixtureId("200000000013"),
      matchStrength: 0.5,
    },
  ] as const;

export const CANONICAL_KNOWLEDGE_RELATION_FIXTURES = [
  {
    id: fixtureId("300000000001"),
    sourceKnowledgeObjectId: fixtureId("000000000002"),
    targetKnowledgeObjectId: fixtureId("000000000003"),
  },
  {
    id: fixtureId("300000000002"),
    sourceKnowledgeObjectId: fixtureId("000000000004"),
    targetKnowledgeObjectId: fixtureId("000000000009"),
  },
] as const;

export function toKnowledgeObjectFixture(
  fixture: CanonicalKnowledgeFixture,
): Omit<KnowledgeObject, "createdAt" | "updatedAt" | "deletedAt"> {
  return {
    id: asId<"KnowledgeObjectId">(fixture.id),
    retailerId: null,
    topic: fixture.topic,
    title: fixture.title,
    slug: fixture.slug,
    summary: fixture.summary,
    body: fixture.body,
    displayTypes: fixture.displayTypes,
    commercialIntent: fixture.commercialIntent,
    priority: fixture.priority,
    active: fixture.active,
  };
}
