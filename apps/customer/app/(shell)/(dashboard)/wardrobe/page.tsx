import {
  ProductRepository,
  RetailerRepository,
  WardrobeRepository,
  WardrobeRoadmapRepository,
} from "@paon/database";
import type { WardrobeOwnershipEvent } from "@paon/domain";
import Link from "next/link";

import "./wardrobe-environment.css";

import { buildCategorizedCatalogue } from "./complete-the-look-catalogue";
import { buildItemSpecificCompleteTheLookSuggestionsByCategory } from "./item-specific-complete-the-look-data";
import { WardrobeFourWeekCalendar } from "./wardrobe-four-week-calendar";
import {
  WardrobeRailsPanel,
  type AdvisorSelectionAlternative,
  type OwnedCardModel,
} from "./wardrobe-panel";

import { getCustomersForUser } from "@/lib/customer-context";
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

  const customers = await getCustomersForUser(session.userId);
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
      const calendarImageUrls = categorizedCatalogue.flatMap((candidate) => {
        const imageUrl = candidate.primaryImageUrl;
        return imageUrl &&
          /(?:suit|jacket|blazer)/i.test(candidate.categoryCode ?? "")
          ? [imageUrl]
          : [];
      });

      const historyEntries = await Promise.all(
        active.map(async (item) => {
          const events = await wardrobeRepo.listOwnershipHistory(item.id);
          return [item.id, events] as const;
        }),
      );
      const historyByItemId: Record<string, readonly WardrobeOwnershipEvent[]> =
        Object.fromEntries(historyEntries);

      // "The size is perfect" (order-again) must land on the real retailer
      // product-detail route, never a fabricated one — so resolve each
      // owned item's linked product to its live slug here, server-side,
      // where the real retailer slug and repository are available. A
      // missing retailer slug, missing productId, or a product that no
      // longer exists (deleted/unavailable) yields no href, and the UI
      // falls back to the real "Ask your advisor to reorder" action.
      const ownedProductIds = [
        ...new Set(
          active
            .map((item) => item.productId)
            .filter((id): id is NonNullable<typeof id> => Boolean(id)),
        ),
      ];
      const ownedProducts = await Promise.all(
        ownedProductIds.map((productId) => productRepo.findById(productId)),
      );
      const ownedProductById = Object.fromEntries(
        ownedProducts
          .filter((product): product is NonNullable<typeof product> =>
            Boolean(product),
          )
          .map((product) => [product.id, product]),
      );

      const ownedCards: OwnedCardModel[] = active.map((item) => {
        const linkedProduct = item.productId
          ? ownedProductById[item.productId]
          : undefined;
        // The real product-detail route (`/r/[slug]/products/[productSlug]`)
        // redirects to the storefront root unless `?legacy=1` is present —
        // it exists only as the canonical signed-in action target, not the
        // default shopping surface (see that route's own file comment). It
        // also 404s a product whose status isn't "active". Matching both
        // here is what makes this a real, working destination rather than a
        // silent bounce back to the generic storefront home.
        const productDetailHref =
          retailer && linkedProduct && linkedProduct.status === "active"
            ? `/r/${retailer.slug}/products/${linkedProduct.slug}?legacy=1`
            : undefined;
        return {
          item,
          history: historyByItemId[item.id] ?? [],
          completeTheLookSuggestions:
            completeTheLookByCategory[item.categoryCode] ?? [],
          purchasedOnLabel: purchasedOnLabel(item.acquiredAt, nowIso),
          ...(productDetailHref ? { productDetailHref } : {}),
        };
      });

      const approvedRoadmap = roadmaps.find(
        (roadmap) => roadmap.status === "approved",
      );
      // Phase 20.17 — a customer can remove an advisor selection from their
      // own wardrobe plan. The advisor-authored roadmap is untouched; the
      // removed gap is simply filtered out of the wardrobe presentation.
      const removedGapIds = approvedRoadmap
        ? new Set(await roadmapRepo.listRemovedGapIdsForCustomer(customer.id))
        : new Set<string>();
      const openGaps = (approvedRoadmap?.gaps ?? []).filter(
        (gap) =>
          !gap.filledByProductId &&
          !gap.filledByWardrobeItemId &&
          !removedGapIds.has(gap.id),
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
        calendarImageUrls,
      };
    }),
  );
  const calendarImageUrls = [
    ...new Set(groups.flatMap((group) => group.calendarImageUrls)),
  ];

  return (
    <div className="paon-wardrobe-scene">
      <div className="paon-wardrobe-stack">
        <WardrobeFourWeekCalendar
          nowIso={nowIso}
          imageUrls={calendarImageUrls}
        />
        <header className="paon-glass paon-glass-pad paon-wardrobe-head">
          <div>
            <p className="paon-wardrobe-kicker">
              Pieces you own and pieces to consider
            </p>
            <h1>Wardrobe</h1>
            <p>
              Every garment, its care and fit actions, the fitting room, and the
              selections your advisor is building for you.
            </p>
          </div>
          <nav aria-label="Wardrobe tools" className="paon-wardrobe-tools">
            <Link href="/wishlist" className="paon-glass-pill">
              Saved pieces
            </Link>
            <Link href="/capsule" className="paon-glass-pill">
              Capsule
            </Link>
          </nav>
        </header>

        <div className="paon-wardrobe-windows">
          <Link
            href="/digital-fitting-room"
            className="paon-glass paon-glass-pad paon-wardrobe-window"
            data-pe-card
          >
            <div>
              <svg
                className="paon-wardrobe-window-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="6" y="2" width="12" height="18" rx="6" />
                <path d="M9 23h6m-3-3v3m-3-15 5-3m-5 7 6-4" />
              </svg>
              <h2>Digital fitting room</h2>
              <p>
                Try pieces on your own portrait and see how a silhouette sits
                before it is cut.
              </p>
            </div>
            <span className="paon-glass-pill paon-glass-pill-solid">
              Open the fitting room
            </span>
          </Link>
          <Link
            href="/style-quiz"
            className="paon-glass paon-glass-pad paon-wardrobe-window"
            data-pe-card
          >
            <div>
              <svg
                className="paon-wardrobe-window-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
              </svg>
              <h2>Style quiz</h2>
              <p>
                Sixty seconds that make every advisor selection feel more like
                you.
              </p>
            </div>
            <span className="paon-glass-pill">Take the quiz</span>
          </Link>
          <Link
            href="/capsule"
            className="paon-glass paon-glass-pad paon-wardrobe-window"
            data-pe-card
          >
            <div>
              <svg
                className="paon-wardrobe-window-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="7" height="7" rx="2" />
                <rect x="14" y="3" width="7" height="7" rx="2" />
                <rect x="3" y="14" width="7" height="7" rx="2" />
                <rect x="14" y="14" width="7" height="7" rx="2" />
              </svg>
              <h2>Capsule</h2>
              <p>
                The pieces that work together this season, and what would
                complete them.
              </p>
            </div>
            <span className="paon-glass-pill">Open the capsule</span>
          </Link>
        </div>

        {groups.length === 0 ? (
          <div
            className="paon-glass paon-glass-pad text-center text-white/60"
            role="status"
          >
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
              <div
                key={customer.id}
                className="paon-glass paon-glass-pad paon-wardrobe-rails"
              >
                <WardrobeRailsPanel
                  retailerId={customer.retailerId}
                  ownedCards={ownedCards}
                  openGaps={openGaps}
                  suggestedProductIdByGapId={suggestedProductIdByGapId}
                  suggestedProductById={Object.fromEntries(
                    Object.entries(suggestedProductById).map(
                      ([id, product]) => [
                        id,
                        {
                          id: product.id,
                          slug: product.slug,
                          name: product.name,
                          ...(product.primaryImageUrl
                            ? { primaryImageUrl: product.primaryImageUrl }
                            : {}),
                        },
                      ],
                    ),
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
              </div>
            ),
          )
        )}
      </div>
    </div>
  );
}
