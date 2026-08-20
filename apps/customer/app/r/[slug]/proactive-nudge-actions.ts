"use server";

import {
  AnalyticsRepository,
  KnowledgeRepository,
  MetadataRepository,
} from "@paon/database";
import {
  asId,
  rankKnowledgeDiscovery,
  type KnowledgeTopic,
  type MetadataConceptId,
  type ProductId,
} from "@paon/domain";

import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const RECENT_EVENT_LIMIT = 20;
const MIN_PRODUCT_VIEWS = 3;
const MAX_PRODUCTS_CONSIDERED = 8;
const FREQUENCY_CAP_HOURS = 24;

export async function getProactiveNudge(retailerId: string): Promise<{
  knowledgeObjectId: string;
  title: string;
  teaser: string;
  topic: KnowledgeTopic;
} | null> {
  const session = await getSession();

  if (!session || session.accountType !== "customer") {
    return null;
  }

  const supabase = await getSupabaseServerClient();
  const rId = asId<"RetailerId">(retailerId);

  try {
    const { CustomerRepository } = await import("@paon/database");
    const customers = await new CustomerRepository(supabase).findByUserId(
      session.userId,
    );
    const customer = customers.find((c) => c.retailerId === rId);
    if (!customer) {
      return null;
    }

    const { data: recentImpressions, error: impressionError } = await supabase
      .from("customer_popup_impressions")
      .select("id")
      .eq("customer_id", customer.id)
      .eq("popup_kind", "advisor_nudge")
      .gt(
        "shown_at",
        new Date(
          Date.now() - FREQUENCY_CAP_HOURS * 60 * 60 * 1000,
        ).toISOString(),
      )
      .limit(1);

    if (impressionError) throw impressionError;
    if (recentImpressions && recentImpressions.length > 0) {
      return null;
    }

    const analyticsRepo = new AnalyticsRepository(supabase);
    const recentEvents = await analyticsRepo.findRecentByCustomer(
      rId,
      customer.id,
      RECENT_EVENT_LIMIT,
    );

    const productViewedEvents = recentEvents.filter(
      (e) => e.name === "product_viewed",
    );
    if (productViewedEvents.length < MIN_PRODUCT_VIEWS) {
      return null;
    }

    const recentProductIds: ProductId[] = [];
    const seenProductIds = new Set<string>();
    for (const event of productViewedEvents) {
      const props = event.properties as Record<string, unknown>;
      const productId = props.productId;
      if (
        typeof productId === "string" &&
        !seenProductIds.has(productId) &&
        recentProductIds.length < MAX_PRODUCTS_CONSIDERED
      ) {
        seenProductIds.add(productId);
        recentProductIds.push(asId<"ProductId">(productId));
      }
    }
    if (recentProductIds.length === 0) {
      return null;
    }

    // Real per-product attribute signal (mill/fibre/weave/construction/etc.),
    // the same lookup the PDP Discover panel uses — not a guess from event
    // property strings, which only ever carry productId/productName.
    const metadataRepo = new MetadataRepository(supabase);
    const conceptFrequency = new Map<MetadataConceptId, number>();
    for (const productId of recentProductIds) {
      const conceptIds = await metadataRepo.findAcceptedConceptIdsForProduct(
        rId,
        productId,
      );
      for (const conceptId of conceptIds) {
        conceptFrequency.set(
          conceptId,
          (conceptFrequency.get(conceptId) ?? 0) + 1,
        );
      }
    }
    if (conceptFrequency.size === 0) {
      return null;
    }

    const rankedConceptIds = Array.from(conceptFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([conceptId]) => conceptId);

    const knowledgeRepo = new KnowledgeRepository(supabase);
    const candidates = await knowledgeRepo.projectDiscoveryCandidates(
      rId,
      rankedConceptIds,
    );
    if (candidates.length === 0) {
      return null;
    }

    const [best] = rankKnowledgeDiscovery(
      {
        retailerId: rId,
        acceptedProductConceptIds: rankedConceptIds,
        journey: "advisor",
        minResults: 1,
        maxResults: 1,
      },
      candidates,
    );
    if (!best) {
      return null;
    }

    const { error: recordError } = await supabase.rpc(
      "record_popup_impression",
      {
        p_retailer_id: rId,
        p_customer_id: customer.id,
        p_popup_kind: "advisor_nudge",
        p_knowledge_object_id: best.knowledgeObjectId,
      },
    );
    if (recordError) throw recordError;

    return {
      knowledgeObjectId: best.knowledgeObjectId,
      title: best.presentation.title,
      teaser: best.presentation.summary,
      topic: best.topic,
    };
  } catch {
    // Best-effort: nudge failures must not break browsing.
    return null;
  }
}
