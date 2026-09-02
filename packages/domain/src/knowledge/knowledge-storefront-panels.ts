import type { KnowledgeObjectId } from "../shared/branded-id";

import type { KnowledgeTopic } from "./knowledge";
import {
  rankKnowledgeDiscovery,
  type KnowledgeDiscoveryCandidate,
  type KnowledgeDiscoveryRequest,
  type KnowledgeDiscoveryResult,
} from "./knowledge-discovery";

/**
 * Founder PDP information areas that receive EDU-003 knowledge cards.
 * Mapping is explicit so ranking stays panel-agnostic (ADR-060) while
 * mounts stay narrow (ADR-052).
 */
export type StorefrontKnowledgePanel =
  "archetype" | "fabric" | "sizing" | "discover";

export interface StorefrontKnowledgeCard {
  readonly id: KnowledgeObjectId;
  readonly topic: KnowledgeTopic;
  readonly panel: StorefrontKnowledgePanel;
  readonly title: string;
  readonly summary: string;
  readonly imageUrl: string | null;
  readonly body?: string;
}

export interface StorefrontKnowledgePanels {
  readonly archetype: readonly StorefrontKnowledgeCard[];
  readonly fabric: readonly StorefrontKnowledgeCard[];
  readonly sizing: readonly StorefrontKnowledgeCard[];
  readonly discover: readonly StorefrontKnowledgeCard[];
}

const TOPIC_TO_PANEL: Record<KnowledgeTopic, StorefrontKnowledgePanel> = {
  mill: "fabric",
  fibre: "fabric",
  fabric: "fabric",
  weave: "fabric",
  performance: "fabric",
  styling: "archetype",
  occasion: "archetype",
  value: "archetype",
  tradeoff: "archetype",
  construction: "sizing",
  collar: "sizing",
  care: "sizing",
};

const PANEL_TOPICS: Record<
  StorefrontKnowledgePanel,
  readonly KnowledgeTopic[]
> = {
  archetype: ["styling", "occasion", "value", "tradeoff"],
  fabric: ["mill", "fibre", "fabric", "weave", "performance"],
  sizing: ["construction", "collar", "care"],
  discover: [
    "styling",
    "occasion",
    "value",
    "tradeoff",
    "mill",
    "fibre",
    "fabric",
    "weave",
    "performance",
    "construction",
    "collar",
    "care",
  ],
};

const MAX_CARDS_PER_PANEL = 2;

export const EMPTY_STOREFRONT_KNOWLEDGE_PANELS: StorefrontKnowledgePanels = {
  archetype: [],
  fabric: [],
  sizing: [],
  discover: [],
};

export function knowledgeTopicsForStorefrontPanel(
  panel: StorefrontKnowledgePanel,
): readonly KnowledgeTopic[] {
  return PANEL_TOPICS[panel];
}

export function knowledgeTopicToStorefrontPanel(
  topic: KnowledgeTopic,
): StorefrontKnowledgePanel {
  return TOPIC_TO_PANEL[topic];
}

export function toStorefrontKnowledgeCard(
  result: KnowledgeDiscoveryResult,
): StorefrontKnowledgeCard {
  return {
    id: result.knowledgeObjectId,
    topic: result.topic,
    panel: knowledgeTopicToStorefrontPanel(result.topic),
    title: result.presentation.title,
    summary: result.presentation.summary,
    imageUrl: result.presentation.imageUrl ?? null,
  };
}

/**
 * Partitions a ranked discovery set into founder Archetype / Fabric /
 * Sizing mounts. Empty panels leave founder fallback copy intact.
 */
export function partitionStorefrontKnowledgePanels(
  results: readonly KnowledgeDiscoveryResult[],
): StorefrontKnowledgePanels {
  const archetype: StorefrontKnowledgeCard[] = [];
  const fabric: StorefrontKnowledgeCard[] = [];
  const sizing: StorefrontKnowledgeCard[] = [];
  const discover: StorefrontKnowledgeCard[] = [];

  for (const result of results) {
    const card = toStorefrontKnowledgeCard(result);
    switch (card.panel) {
      case "archetype":
        archetype.push(card);
        break;
      case "fabric":
        fabric.push(card);
        break;
      case "sizing":
        sizing.push(card);
        break;
      case "discover":
        discover.push(card);
        break;
    }
  }

  return { archetype, fabric, sizing, discover };
}

export function storefrontKnowledgePanelsHaveCards(
  panels: StorefrontKnowledgePanels,
): boolean {
  return (
    panels.archetype.length > 0 ||
    panels.fabric.length > 0 ||
    panels.sizing.length > 0 ||
    panels.discover.length > 0
  );
}

/**
 * Ranks ADR-060 discovery separately per founder panel so shared
 * diversity buckets cannot empty Archetype when Sizing already selected
 * care (same style/occasion bucket as styling/occasion).
 */
export function rankStorefrontKnowledgePanels(
  request: Omit<KnowledgeDiscoveryRequest, "minResults" | "maxResults">,
  candidates: readonly KnowledgeDiscoveryCandidate[],
): StorefrontKnowledgePanels {
  // Build a map of knowledgeObjectId -> body for discover panel
  const bodyByObjectId = new Map<string, string | undefined>();
  for (const candidate of candidates) {
    bodyByObjectId.set(candidate.object.id, candidate.object.body);
  }

  const panels: {
    archetype: StorefrontKnowledgeCard[];
    fabric: StorefrontKnowledgeCard[];
    sizing: StorefrontKnowledgeCard[];
    discover: StorefrontKnowledgeCard[];
  } = {
    archetype: [],
    fabric: [],
    sizing: [],
    discover: [],
  };

  for (const panel of ["archetype", "fabric", "sizing"] as const) {
    const topics = new Set(PANEL_TOPICS[panel]);
    const panelCandidates = candidates.filter((candidate) =>
      topics.has(candidate.object.topic),
    );
    if (panelCandidates.length === 0) {
      continue;
    }
    const ranked = rankKnowledgeDiscovery(
      {
        ...request,
        minResults: 1,
        maxResults: MAX_CARDS_PER_PANEL,
      },
      panelCandidates,
    );
    panels[panel] = ranked.map((result) => {
      const card = toStorefrontKnowledgeCard(result);
      const body = bodyByObjectId.get(result.knowledgeObjectId);
      return body ? { ...card, body } : card;
    });
  }

  // Discover panel: all matched knowledge objects across all topics, with body
  const allRanked = rankKnowledgeDiscovery(
    {
      ...request,
      minResults: 0,
      maxResults: 4,
    },
    candidates,
  );
  panels.discover = allRanked.map((result) => {
    const baseCard = toStorefrontKnowledgeCard(result);
    const body = bodyByObjectId.get(result.knowledgeObjectId);
    return {
      ...baseCard,
      panel: "discover" as const,
      ...(body ? { body } : {}),
    };
  });

  return panels;
}

/**
 * JSON payload keyed by storefront product id (slug) for
 * `__PAON_KNOWLEDGE_BY_PRODUCT_JSON__`.
 */
export function buildStorefrontKnowledgeByProduct(
  panelsByProductSlug: ReadonlyMap<string, StorefrontKnowledgePanels>,
): Record<string, StorefrontKnowledgePanels> {
  const payload: Record<string, StorefrontKnowledgePanels> = {};
  for (const [slug, panels] of panelsByProductSlug) {
    payload[slug] = panels;
  }
  return payload;
}
