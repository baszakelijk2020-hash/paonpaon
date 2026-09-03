import { OrderRepository } from "@paon/database";
import {
  asId,
  composeSevenDayOwnedFirstPlan,
  garmentCategoryToOutfitSlot,
  ORDER_STATUS_LABELS,
  type OwnedWardrobeCandidate,
  type SuggestedCatalogueCandidate,
} from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Card } from "@paon/ui/components/Card";
import { notFound } from "next/navigation";

import {
  buildCategorizedCatalogue,
  buildWardrobeCandidates,
} from "../../../wardrobe/complete-the-look-catalogue";

import { SevenDayPlanCard } from "./seven-day-plan-card";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Seven-Day Wardrobe challenge look (PHASE 10.2 / CMP-105 / WRD-104), the
 * customer-facing UI `upsert_campaign_challenge_look`'s missing follow-up
 * flagged in PHASE.md: renders `composeSevenDayOwnedFirstPlan`'s real
 * owned-first-vs-catalogue-fallback-vs-cited-gap composition for THIS
 * order's customer, never a decorative mock. Uses the session-scoped
 * client (not admin) so RLS — not this page — is what stops a customer
 * from ever seeing another customer's order or wardrobe.
 */
export default async function HoneymoonCampaignChallengeLookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const supabase = await getSupabaseServerClient();

  const orderRepo = new OrderRepository(supabase);
  const order = await orderRepo.findById(asId<"OrderId">(id));
  if (!order) {
    notFound();
  }
  if (!order.customerId) {
    notFound();
  }

  const [wardrobeCandidates, catalogueCandidates] = await Promise.all([
    buildWardrobeCandidates({ supabase, customerId: order.customerId }),
    buildCategorizedCatalogue({ supabase, retailerId: order.retailerId }),
  ]);

  const owned: OwnedWardrobeCandidate[] = [];
  for (const item of wardrobeCandidates) {
    if (item.deletedAt) continue;
    if (item.retiredAt) continue;
    const slotKind = garmentCategoryToOutfitSlot(item.categoryCode);
    if (!slotKind) continue;
    owned.push({
      wardrobeItemId: item.wardrobeItemId,
      slotKind,
      label: item.displayName,
    });
  }

  const suggested: SuggestedCatalogueCandidate[] = [];
  for (const product of catalogueCandidates) {
    if (!product.categoryCode) continue;
    const slotKind = garmentCategoryToOutfitSlot(product.categoryCode);
    if (!slotKind) continue;
    suggested.push({
      productId: String(product.productId),
      slotKind,
      label: product.displayName,
      inStock: product.available,
    });
  }

  const plan = composeSevenDayOwnedFirstPlan({ owned, suggested });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
            Seven-Day Wardrobe
          </h1>
          <Badge tone="warning">{ORDER_STATUS_LABELS[order.status]}</Badge>
        </div>
        <p className="text-sm text-[var(--color-stone-500)]">
          Order {order.orderNumber} &middot; owned pieces first, catalogue
          fallback where needed, honest gaps where stock is unavailable.
        </p>
      </div>

      {plan.gaps.length > 0 ? (
        <Card className="paon-reveal bg-[var(--color-stone-50)]">
          <p className="text-sm font-medium text-[var(--color-stone-900)]">
            {plan.gaps.length} slot{plan.gaps.length === 1 ? "" : "s"} without
            an owned or in-stock item
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--color-stone-600)]">
            Shown below as gaps rather than filled with a guess. Your Style
            Advisor can help close these.
          </p>
        </Card>
      ) : null}

      <SevenDayPlanCard slots={plan.slots} />
    </div>
  );
}
