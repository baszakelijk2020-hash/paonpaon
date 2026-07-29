import type { KnowledgeTopic } from "./knowledge";
import type { KnowledgeDiscoveryResult } from "./knowledge-discovery";

export type StorefrontKnowledgeSection = "archetype" | "fabric" | "sizing";

export interface StorefrontKnowledgeCard {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly imageUrl: string;
  readonly topic: KnowledgeTopic;
}

export interface StorefrontKnowledgeBySection {
  readonly archetype: readonly StorefrontKnowledgeCard[];
  readonly fabric: readonly StorefrontKnowledgeCard[];
  readonly sizing: readonly StorefrontKnowledgeCard[];
}

export const STOREFRONT_KNOWLEDGE_FALLBACK_IMAGE =
  "https://www.nebelspiegel.com/images/smaller/6088.webp";

export const STOREFRONT_KNOWLEDGE_CARD_CLASS_NAMES = [
  "paon-knowledge-cards",
  "paon-knowledge-card",
  "paon-knowledge-card-img",
  "paon-knowledge-card-copy",
  "paon-knowledge-card-title",
  "paon-knowledge-card-summary",
] as const;

const MAX_CARDS_PER_SECTION = 2;

const TOPIC_SECTION: Record<KnowledgeTopic, StorefrontKnowledgeSection> = {
  styling: "archetype",
  occasion: "archetype",
  value: "archetype",
  tradeoff: "archetype",
  mill: "fabric",
  fibre: "fabric",
  fabric: "fabric",
  weave: "fabric",
  performance: "fabric",
  construction: "sizing",
  collar: "sizing",
  care: "sizing",
};

export function storefrontSectionForTopic(
  topic: KnowledgeTopic,
): StorefrontKnowledgeSection {
  return TOPIC_SECTION[topic];
}

export function toStorefrontKnowledgeCard(
  result: KnowledgeDiscoveryResult,
  fallbackImageUrl: string = STOREFRONT_KNOWLEDGE_FALLBACK_IMAGE,
): StorefrontKnowledgeCard {
  return {
    id: result.knowledgeObjectId,
    title: result.presentation.title,
    summary: result.presentation.summary,
    imageUrl: result.presentation.imageUrl ?? fallbackImageUrl,
    topic: result.topic,
  };
}

export function partitionDiscoveryForStorefront(
  results: readonly KnowledgeDiscoveryResult[],
  fallbackImageUrl: string = STOREFRONT_KNOWLEDGE_FALLBACK_IMAGE,
): StorefrontKnowledgeBySection {
  const sections: Record<
    StorefrontKnowledgeSection,
    StorefrontKnowledgeCard[]
  > = {
    archetype: [],
    fabric: [],
    sizing: [],
  };

  for (const result of results) {
    const section = storefrontSectionForTopic(result.topic);
    if (sections[section].length >= MAX_CARDS_PER_SECTION) {
      continue;
    }
    sections[section].push(toStorefrontKnowledgeCard(result, fallbackImageUrl));
  }

  return sections;
}

export function emptyStorefrontKnowledgeBySection(): StorefrontKnowledgeBySection {
  return {
    archetype: [],
    fabric: [],
    sizing: [],
  };
}
