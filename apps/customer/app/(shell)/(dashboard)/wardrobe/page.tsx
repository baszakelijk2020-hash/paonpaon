import {
  ProductRepository,
  ProductVariantRepository,
  RetailerRepository,
  WardrobeRepository,
  WardrobeRoadmapRepository,
  WishlistRepository,
} from "@paon/database";
import type { WardrobeOwnershipEvent } from "@paon/domain";

import "./wardrobe-environment.css";

import { FittingRoomModule } from "../digital-fitting-room/fitting-room-module";
import { loadFittingRoomData } from "../digital-fitting-room/load-fitting-room-data";
import { loadStyleQuizData } from "../style-quiz/load-style-quiz-data";
import { StyleQuizFlow } from "../style-quiz/style-quiz-flow";

import { buildCategorizedCatalogue } from "./complete-the-look-catalogue";
import { buildItemSpecificCompleteTheLookSuggestionsByCategory } from "./item-specific-complete-the-look-data";
import { SuggestedLookTile } from "./suggested-look-tile";
import { WardrobeFavoriteTile } from "./wardrobe-favorite-tile";
import { WardrobeFourWeekCalendar } from "./wardrobe-four-week-calendar";
import {
  WardrobeRailsPanel,
  type AdvisorSelectionAlternative,
  type OwnedCardModel,
} from "./wardrobe-panel";

import { canonicalCategoryFor } from "@/app/(shell)/r/[slug]/canonical-category";
import { getCustomersForUser } from "@/lib/customer-context";
import { getGuestRetailerId } from "@/lib/guest-house";
import { getViewerSession } from "@/lib/session";
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

/** Active suits and jackets, the pieces the four-week calendar is dressed in. */
function calendarImagesFrom(
  products: Awaited<ReturnType<ProductRepository["findByRetailer"]>>,
): string[] {
  return products.flatMap((product) => {
    if (product.status !== "active" || !product.primaryImageUrl) return [];
    const category = canonicalCategoryFor(
      product.name,
      undefined,
      product.primaryImageUrl,
    );
    return category === "Suits" || category === "Jackets"
      ? [product.primaryImageUrl]
      : [];
  });
}

type WardrobeGroup = Awaited<ReturnType<typeof loadWardrobeGroups>>[number];

interface WishlistItem {
  id: string;
  name: string;
  primaryImageUrl: string | undefined;
  variantId: string;
}

/** One card in the grid: title row, optional meta, then its content. */
function Card({
  id,
  title,
  meta,
  span,
  compact,
  children,
}: {
  id: string;
  title: string;
  meta?: string;
  span?: "wide" | "full";
  compact?: boolean;
  children: React.ReactNode;
}) {
  const classes = [
    "paon-wardrobe-card",
    span === "wide" ? "paon-wardrobe-card-wide" : "",
    span === "full" ? "paon-wardrobe-card-full" : "",
    compact ? "paon-wardrobe-card-compact" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <section id={id} className={classes} aria-labelledby={`${id}-title`}>
      <div className="paon-wardrobe-card-head">
        <h2 id={`${id}-title`} className="paon-wardrobe-card-title">
          {title}
        </h2>
        {meta ? <span className="paon-wardrobe-card-meta">{meta}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Empty({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <div className="paon-wardrobe-empty" role="status">
      <div className="paon-wardrobe-placeholder-gallery" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div>
        <p>{children}</p>
        <p className="paon-wardrobe-placeholder-note">
          Your collection will appear here as it takes shape.
        </p>
      </div>
      {action ? (
        <a className="paon-wardrobe-empty-action" href={action.href}>
          {action.label}
        </a>
      ) : null}
    </div>
  );
}

function StyleQuizPreview() {
  return (
    <div className="paon-wardrobe-quiz-preview">
      <div>
        <p>Question 1 of 8</p>
        <h3>What should your wardrobe do for you first?</h3>
      </div>
      <div className="paon-wardrobe-quiz-options">
        <button type="button">Make daily dressing effortless</button>
        <button type="button">Help me look sharper at work</button>
        <button type="button">Prepare me for an occasion</button>
      </div>
    </div>
  );
}

function railsPanelProps(group: WardrobeGroup) {
  return {
    retailerId: group.customer.retailerId,
    suggestedProductIdByGapId: group.suggestedProductIdByGapId,
    suggestedProductById: Object.fromEntries(
      Object.entries(group.suggestedProductById).map(([id, product]) => [
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
    ),
    alternativesByCategory: group.alternativesByCategory,
  };
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export default async function WardrobePage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    fittingRoom_productSlug?: string;
    fittingRoom_addWardrobeItemId?: string;
  }>;
}) {
  // The page has no tabs; `tab` (and any other query) is ignored. Only the
  // two fitting-room preload params still matter.
  const { fittingRoom_productSlug, fittingRoom_addWardrobeItemId } =
    await searchParams;
  const session = await getViewerSession();
  const supabase = await getSupabaseServerClient();
  const nowIso = new Date().toISOString();

  const customers = await getCustomersForUser(session.userId);

  const [groups, fittingRoomGroups, styleQuizGroups, wishlistEntries] =
    await Promise.all([
      loadWardrobeGroups(supabase, customers, nowIso),
      loadFittingRoomData(
        supabase,
        customers,
        fittingRoom_productSlug,
        fittingRoom_addWardrobeItemId,
      ),
      loadStyleQuizData(supabase, customers),
      loadWishlists(supabase, customers),
    ]);
  const wishlistByCustomerId = Object.fromEntries(wishlistEntries);

  // A guest owns nothing yet; the calendar dresses them from the demo
  // house's public catalogue instead of standing empty.
  const productRepo = new ProductRepository(supabase);
  const guestRetailerId =
    session.isGuest && groups.length === 0 ? await getGuestRetailerId() : null;
  const calendarImageUrls = guestRetailerId
    ? calendarImagesFrom(
        await productRepo.findByRetailer(guestRetailerId).catch(() => []),
      )
    : [...new Set(groups.flatMap((group) => group.calendarImageUrls))];

  const ownedCount = groups.reduce(
    (sum, group) => sum + group.ownedCards.length,
    0,
  );
  const gapCount = groups.reduce(
    (sum, group) => sum + group.openGaps.length,
    0,
  );
  const favoriteCount = Object.values(wishlistByCustomerId).reduce(
    (sum, items) => sum + items.length,
    0,
  );

  const completeTheLookByGroup = groups.map((group) => {
    const seen = new Set<string>();
    return group.ownedCards
      .flatMap((card) => card.completeTheLookSuggestions)
      .filter((suggestion) => {
        if (seen.has(suggestion.productId)) return false;
        seen.add(suggestion.productId);
        return true;
      });
  });
  const lookCount = completeTheLookByGroup.reduce(
    (sum, list) => sum + list.length,
    0,
  );

  const favoritesCard = (
    <Card
      id="favorites"
      title="Favorites"
      meta={plural(favoriteCount, "piece")}
      compact
    >
      {favoriteCount === 0 ? (
        <Empty action={{ href: "#fitting-room", label: "Try pieces on" }}>
          Nothing saved yet.
        </Empty>
      ) : (
        customers.map((customer) => {
          const items = wishlistByCustomerId[customer.id] ?? [];
          if (items.length === 0) return null;
          return (
            <ul key={customer.id} className="paon-wardrobe-rail-row">
              {items.map((item) => (
                <WardrobeFavoriteTile
                  key={item.id}
                  retailerId={customer.retailerId}
                  favorite={item}
                />
              ))}
            </ul>
          );
        })
      )}
    </Card>
  );

  const completeCard = (
    <Card
      id="complete-the-look"
      title="Complete the look"
      meta={plural(lookCount, "suggestion")}
      compact
    >
      {groups.length === 0 || ownedCount === 0 ? (
        <Empty action={{ href: "#style-quiz", label: "Take the style quiz" }}>
          Add a piece to get suggestions.
        </Empty>
      ) : lookCount === 0 ? (
        <Empty>No suggestions for your pieces yet.</Empty>
      ) : (
        groups.map((group, index) => {
          const suggestions = completeTheLookByGroup[index] ?? [];
          if (suggestions.length === 0) return null;
          return (
            <ul key={group.customer.id} className="paon-wardrobe-rail-row">
              {suggestions.map((suggestion) => (
                <SuggestedLookTile
                  key={suggestion.productId}
                  retailerId={group.customer.retailerId}
                  suggestion={suggestion}
                  compact
                />
              ))}
            </ul>
          );
        })
      )}
    </Card>
  );

  return (
    <div className="paon-wardrobe-scene">
      <div className="paon-wardrobe-cards">
        <header className="paon-wardrobe-strip">
          <h1>Wardrobe</h1>
        </header>

        <div className="paon-wardrobe-top">
          <WardrobeFourWeekCalendar
            nowIso={nowIso}
            imageUrls={calendarImageUrls}
          />
          <div className="paon-wardrobe-side">
            {favoritesCard}
            {completeCard}
          </div>
        </div>

        <Card
          id="pieces"
          title="Pieces you own"
          meta={plural(ownedCount, "piece")}
          span="full"
        >
          {groups.length === 0 ? (
            <Empty>No garments are linked to your account yet.</Empty>
          ) : (
            groups.map((group) => (
              <div
                key={group.customer.id}
                className="paon-wardrobe-rails paon-wardrobe-embed"
              >
                <WardrobeRailsPanel
                  {...railsPanelProps(group)}
                  ownedCards={group.ownedCards}
                  openGaps={[]}
                  pendingApprovalRoadmap={undefined}
                />
              </div>
            ))
          )}
        </Card>

        <Card
          id="aspirational"
          title="Aspirational"
          meta={plural(gapCount, "advisor pick")}
          span="full"
          compact
        >
          {groups.length === 0 ? (
            <Empty>No advisor selections yet.</Empty>
          ) : (
            groups.map((group) => (
              <div
                key={group.customer.id}
                className="paon-wardrobe-rails paon-wardrobe-embed"
              >
                {group.openGaps.length === 0 &&
                !group.pendingApprovalRoadmap ? (
                  <Empty
                    action={{
                      href: "/concierge",
                      label: "Plan with your advisor",
                    }}
                  >
                    No open selections from your advisor.
                  </Empty>
                ) : (
                  <WardrobeRailsPanel
                    {...railsPanelProps(group)}
                    ownedCards={[]}
                    openGaps={group.openGaps}
                    pendingApprovalRoadmap={
                      group.pendingApprovalRoadmap
                        ? {
                            id: group.pendingApprovalRoadmap.id,
                            title: group.pendingApprovalRoadmap.title,
                          }
                        : undefined
                    }
                  />
                )}
              </div>
            ))
          )}
        </Card>

        <section
          id="fitting-room"
          className="paon-wardrobe-card-full paon-wardrobe-fitting"
          aria-label="Fitting room"
        >
          {fittingRoomGroups.length === 0 ? (
            <Empty>No retailer connections yet.</Empty>
          ) : (
            fittingRoomGroups.map((group) => (
              <FittingRoomModule
                key={group.customer.id}
                retailerId={group.customer.retailerId}
                retailerName={group.retailer?.displayName ?? "Retailer"}
                composableItems={group.composableItems}
                outfits={group.outfits}
                latestJobByOutfitId={group.latestJobByOutfitId}
                canGenerate={group.canGenerate}
                consent={group.consent}
                portrait={group.portrait}
                portraitPreviewJob={group.portraitPreviewJob}
                fitArchetypes={group.fitArchetypes}
                preloadKey={group.preloadKey}
                favorites={group.favorites}
                referencePreviews={group.referencePreviews}
              />
            ))
          )}
        </section>

        <Card id="style-quiz" title="Style quiz" span="full" compact>
          {styleQuizGroups.length === 0 ? (
            <StyleQuizPreview />
          ) : (
            styleQuizGroups.map(
              ({
                customer,
                retailer,
                archetypes,
                tweakQuestions,
                declaredConceptIds,
              }) => (
                <div key={customer.id} className="paon-wardrobe-embed">
                  <StyleQuizFlow
                    retailerId={customer.retailerId}
                    retailerName={retailer?.displayName ?? "Retailer"}
                    archetypes={archetypes}
                    tweakQuestions={tweakQuestions}
                    declaredConceptIds={declaredConceptIds}
                  />
                </div>
              ),
            )
          )}
        </Card>
      </div>
    </div>
  );
}

async function loadWishlists(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  customers: Awaited<ReturnType<typeof getCustomersForUser>>,
): Promise<Array<readonly [string, WishlistItem[]]>> {
  const wishlistRepo = new WishlistRepository(supabase);
  const variantRepo = new ProductVariantRepository(supabase);
  const productRepo = new ProductRepository(supabase);
  return Promise.all(
    customers.map(async (customer) => {
      const wishlist = await wishlistRepo.findByCustomer(customer.id);
      if (!wishlist) return [customer.id, []] as const;
      const wishlistItems = await wishlistRepo.findItems(wishlist.id);
      const resolved = await Promise.all(
        wishlistItems.map(
          async (wishlistItem): Promise<WishlistItem | null> => {
            const variant = await variantRepo.findById(
              wishlistItem.productVariantId,
            );
            if (!variant) return null;
            const product = await productRepo.findById(variant.productId);
            if (!product) return null;
            return {
              id: product.id,
              name: product.name,
              primaryImageUrl: product.primaryImageUrl,
              variantId: variant.id,
            };
          },
        ),
      );
      return [
        customer.id,
        resolved.filter((item): item is WishlistItem => item !== null),
      ] as const;
    }),
  );
}

async function loadWardrobeGroups(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  customers: Awaited<ReturnType<typeof getCustomersForUser>>,
  nowIso: string,
) {
  const retailerRepo = new RetailerRepository(supabase);
  const wardrobeRepo = new WardrobeRepository(supabase);
  const roadmapRepo = new WardrobeRoadmapRepository(supabase);
  const productRepo = new ProductRepository(supabase);

  return Promise.all(
    customers.map(async (customer) => {
      const retailer = await retailerRepo.findById(customer.retailerId);
      const items = await wardrobeRepo.findByCustomer(customer.id);
      const active = items.filter((item) => !item.retiredAt && !item.deletedAt);
      const ownedActiveCategories = [
        ...new Set(active.map((item) => item.categoryCode)),
      ];

      const [
        completeTheLookByCategory,
        categorizedCatalogue,
        roadmaps,
        retailerProducts,
      ] = await Promise.all([
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
        productRepo.findByRetailer(customer.retailerId),
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
      const calendarImageUrls = calendarImagesFrom(retailerProducts);

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
}
