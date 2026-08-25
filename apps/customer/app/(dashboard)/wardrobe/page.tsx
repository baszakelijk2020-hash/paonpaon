import {
  CustomerRepository,
  ProductRepository,
  RetailerRepository,
  WardrobeRepository,
  WardrobeRoadmapRepository,
} from "@paon/database";
import type { WardrobeOwnershipEvent } from "@paon/domain";
import Link from "next/link";

import { buildCategorizedCatalogue } from "./complete-the-look-catalogue";
import { buildItemSpecificCompleteTheLookSuggestionsByCategory } from "./item-specific-complete-the-look-data";
import {
  WardrobeRailsPanel,
  type AdvisorSelectionAlternative,
  type OwnedCardModel,
} from "./wardrobe-panel";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const PURCHASE_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function purchasedOnLabel(
  acquiredAt: string | undefined,
  nowIso: string,
): string {
  if (!acquiredAt) return "Purchase date unavailable";
  const acquired = Date.parse(acquiredAt);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(acquired) || !Number.isFinite(now)) {
    return "Purchase date unavailable";
  }
  const days = Math.max(
    0,
    Math.floor((now - acquired) / (24 * 60 * 60 * 1000)),
  );
  return `Purchased on ${PURCHASE_DATE_FORMATTER.format(new Date(acquiredAt))} · ${days} day${days === 1 ? "" : "s"} in your wardrobe`;
}

export default async function WardrobePage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const nowIso = new Date().toISOString();

  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const retailerRepo = new RetailerRepository(supabase);
  const wardrobeRepo = new WardrobeRepository(supabase);
  const roadmapRepo = new WardrobeRoadmapRepository(supabase);
  const productRepo = new ProductRepository(supabase);

  const groups = await Promise.all(
    customers.map(async (customer) => {
      const retailer = await retailerRepo.findById(customer.retailerId);
      const items = await wardrobeRepo.findByCustomer(customer.id);
      const active = items.filter((item) => !item.retiredAt && !item.deletedAt);
      const ownedActiveCategories = [
        ...new Set(active.map((item) => item.categoryCode)),
      ];

      const [completeTheLookByCategory, categorizedCatalogue, roadmaps] =
        await Promise.all([
          buildItemSpecificCompleteTheLookSuggestionsByCategory({
            supabase,
            retailerId: customer.retailerId,
            customerId: customer.id,
            ownedActiveCategories,
          }),
          buildCategorizedCatalogue({
            supabase,
            retailerId: customer.retailerId,
          }),
          roadmapRepo.findByCustomer(customer.id, {
            customerVisibleOnly: true,
          }),
        ]);

      const alternativesByCategory: Record<
        string,
        AdvisorSelectionAlternative[]
      > = {};
      for (const candidate of categorizedCatalogue) {
        if (!candidate.categoryCode) continue;
        (alternativesByCategory[candidate.categoryCode] ??= []).push({
          productId: candidate.productId,
          productSlug: candidate.productSlug,
          displayName: candidate.displayName,
          ...(candidate.primaryImageUrl
            ? { primaryImageUrl: candidate.primaryImageUrl }
            : {}),
        });
      }

      const historyEntries = await Promise.all(
        active.map(async (item) => {
          const events = await wardrobeRepo.listOwnershipHistory(item.id);
          return [item.id, events] as const;
        }),
      );
      const historyByItemId: Record<string, readonly WardrobeOwnershipEvent[]> =
        Object.fromEntries(historyEntries);

      const ownedCards: OwnedCardModel[] = active.map((item) => ({
        item,
        history: historyByItemId[item.id] ?? [],
        completeTheLookSuggestions:
          completeTheLookByCategory[item.categoryCode] ?? [],
        purchasedOnLabel: purchasedOnLabel(item.acquiredAt, nowIso),
      }));

      const approvedRoadmap = roadmaps.find(
        (roadmap) => roadmap.status === "approved",
      );
      const openGaps = (approvedRoadmap?.gaps ?? []).filter(
        (gap) => !gap.filledByProductId && !gap.filledByWardrobeItemId,
      );
      const suggestedProductIdByGapId: Record<string, string> = {};
      for (const stage of approvedRoadmap?.stages ?? []) {
        if (stage.gapId && stage.suggestedProductId) {
          suggestedProductIdByGapId[stage.gapId] = stage.suggestedProductId;
        }
      }
      const suggestedProducts = await Promise.all(
        [...new Set(Object.values(suggestedProductIdByGapId))].map(
          (productId) => productRepo.findById(productId as never),
        ),
      );
      const suggestedProductById = Object.fromEntries(
        suggestedProducts
          .filter((product): product is NonNullable<typeof product> =>
            Boolean(product),
          )
          .map((product) => [product.id, product]),
      );

      const pendingApprovalRoadmap = roadmaps.find(
        (roadmap) => roadmap.status === "pending_approval",
      );

      return {
        customer,
        retailer,
        ownedCards,
        openGaps,
        suggestedProductIdByGapId,
        suggestedProductById,
        alternativesByCategory,
        pendingApprovalRoadmap,
      };
    }),
  );

  return (
    <div className="-mx-4 flex min-h-full flex-col bg-[linear-gradient(105deg,#282a28_0%,#191a18_44%,#121310_100%)] text-white sm:-mx-7 lg:-mx-10 xl:-mx-14">
      <header className="border-b border-white/10 px-6 pb-7 pt-9 sm:px-10 lg:px-14">
        <h1 className="font-display text-4xl tracking-[-0.03em] text-white sm:text-5xl">
          Wardrobe
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-white/60">
          Your garments and advisor selections, organised by category.
        </p>
        <nav
          aria-label="Wardrobe tools"
          className="mt-5 flex items-center gap-5 text-sm"
        >
          <Link
            href="/wishlist"
            className="text-white/80 underline-offset-4 hover:text-white hover:underline"
          >
            Saved
          </Link>
          <Link
            href="/capsule"
            className="text-white/80 underline-offset-4 hover:text-white hover:underline"
          >
            Capsule
          </Link>
        </nav>
      </header>

      <Link
        href="/style-quiz"
        className="group flex items-center justify-between gap-6 border-b border-white/10 bg-[linear-gradient(90deg,rgba(175,190,167,0.22),rgba(175,190,167,0.06))] px-6 py-5 sm:px-10 lg:px-14"
      >
        <span className="text-sm text-white/85">
          A 60-second style quiz sharpens every suggestion in your wardrobe.
        </span>
        <span className="shrink-0 text-sm font-medium text-white underline-offset-4 group-hover:underline">
          Take the quiz →
        </span>
      </Link>

      {groups.length === 0 ? (
        <div className="px-6 py-16 text-center text-white/60" role="status">
          <p>No garments are linked to your account yet.</p>
        </div>
      ) : (
        groups.map(
          ({
            customer,
            ownedCards,
            openGaps,
            suggestedProductIdByGapId,
            suggestedProductById,
            alternativesByCategory,
            pendingApprovalRoadmap,
          }) => (
            <WardrobeRailsPanel
              key={customer.id}
              retailerId={customer.retailerId}
              ownedCards={ownedCards}
              openGaps={openGaps}
              suggestedProductIdByGapId={suggestedProductIdByGapId}
              suggestedProductById={Object.fromEntries(
                Object.entries(suggestedProductById).map(([id, product]) => [
                  id,
                  {
                    id: product.id,
                    slug: product.slug,
                    name: product.name,
                    ...(product.primaryImageUrl
                      ? { primaryImageUrl: product.primaryImageUrl }
                      : {}),
                  },
                ]),
              )}
              alternativesByCategory={alternativesByCategory}
              pendingApprovalRoadmap={
                pendingApprovalRoadmap
                  ? {
                      id: pendingApprovalRoadmap.id,
                      title: pendingApprovalRoadmap.title,
                    }
                  : undefined
              }
            />
          ),
        )
      )}
    </div>
  );
}
