import type {
  MetadataConceptId,
  ProductId,
  ProductVariantId,
  RetailerId,
} from "../shared/branded-id";
import type { Money } from "../shared/money";

/**
 * Tie-Mate (TIE-001) — pure discovery deck for phone-scale fabric exploration.
 *
 * Modelled on Hermès Tie Break's practical core: browse neckwear fabrics at
 * true phone-screen scale, hold the phone against a shirt to judge match,
 * then save / buy / ask an advisor. PAON does **not** invent customer-side
 * computer-vision fabric recognition. Retailers (or the founder) feed sharp
 * fabric close-ups into the catalogue — preferentially `swatchImageUrl`
 * (ADR-049) — and Tie-Mate surfaces those assets with live stock truth.
 */

/** Role of the image used for phone-scale exploration. */
export type TieMateFabricPhotoRole = "swatch_closeup" | "primary_fallback";

/**
 * Capture guidance for retailer/admin fabric photos fed into PAON.
 * Not enforced at runtime; documents the operational contract.
 */
export const TIE_MATE_FABRIC_PHOTO_GUIDANCE = {
  role: "sharp_fabric_closeup",
  preferredField: "swatchImageUrl",
  requirements: [
    "Sharp, evenly lit close-up of the woven/printed face (not a mannequin hero)",
    "Fill the frame with fabric so phone-scale preview feels true-to-hand",
    "Colour-accurate; avoid heavy filters or lifestyle props",
    "One primary close-up per sellable tie product (variant differences use variant facts)",
  ],
} as const;

export interface TieMateFabricCandidate {
  readonly productId: ProductId;
  readonly productSlug: string;
  readonly name: string;
  readonly status: "draft" | "active" | "archived";
  readonly primaryImageUrl?: string;
  /** Preferred sharp fabric close-up (ADR-049). */
  readonly swatchImageUrl?: string;
  readonly variantId: ProductVariantId;
  readonly price: Money;
  readonly inventoryQuantity: number;
  readonly acceptedConceptIds: readonly MetadataConceptId[];
  readonly isMadeToOrder?: boolean;
}

export interface TieMateDeckOptions {
  readonly retailerId: RetailerId;
  readonly slug: string;
  /** Accepted `garment_type` (or equivalent) concept IDs that mean neckwear/tie. */
  readonly tieConceptIds: ReadonlySet<MetadataConceptId>;
  readonly requireInStock?: boolean;
  readonly maxCards?: number;
  /** Optional shortlist / pinned order — those products appear first when eligible. */
  readonly pinnedProductIds?: readonly ProductId[];
}

export interface TieMateFabricCard {
  readonly productId: ProductId;
  readonly productSlug: string;
  readonly name: string;
  readonly variantId: ProductVariantId;
  readonly price: Money;
  readonly inventoryQuantity: number;
  readonly inStock: boolean;
  /** Absolute URL used for full-bleed phone-scale exploration. */
  readonly fabricImageUrl: string;
  readonly fabricPhotoRole: TieMateFabricPhotoRole;
  readonly matchedTieConceptIds: readonly MetadataConceptId[];
}

export interface TieMateActionPaths {
  readonly deckPath: string;
  readonly productPath: string;
  readonly orderPath: string;
  readonly wishlistHint: "wishlist_via_swipe_save";
  readonly appointmentPath: string;
  readonly messagesPath: string;
  readonly swipeHandoffPath: string;
}

export interface TieMateDeck {
  readonly retailerId: RetailerId;
  readonly slug: string;
  readonly cards: readonly TieMateFabricCard[];
  readonly skippedWithoutPhoto: number;
  readonly skippedOutOfStock: number;
  readonly skippedNotTie: number;
  readonly skippedInactive: number;
}

/**
 * Prefer the retailer-fed sharp close-up (`swatchImageUrl`); fall back to the
 * primary product image only when no swatch exists.
 */
export function resolveTieMateFabricImage(candidate: {
  readonly swatchImageUrl?: string;
  readonly primaryImageUrl?: string;
}):
  { readonly url: string; readonly role: TieMateFabricPhotoRole } | undefined {
  const swatch = candidate.swatchImageUrl?.trim();
  if (swatch && swatch.length > 0) {
    return { url: swatch, role: "swatch_closeup" };
  }
  const primary = candidate.primaryImageUrl?.trim();
  if (primary && primary.length > 0) {
    return { url: primary, role: "primary_fallback" };
  }
  return undefined;
}

export function candidateMatchesTieConcepts(
  candidate: Pick<TieMateFabricCandidate, "acceptedConceptIds">,
  tieConceptIds: ReadonlySet<MetadataConceptId>,
): readonly MetadataConceptId[] {
  if (tieConceptIds.size === 0) {
    return [];
  }
  return candidate.acceptedConceptIds.filter((id) => tieConceptIds.has(id));
}

function isInStock(candidate: TieMateFabricCandidate): boolean {
  if (candidate.isMadeToOrder === true) {
    return true;
  }
  return candidate.inventoryQuantity > 0;
}

/**
 * Build a stock-truthful Tie-Mate deck from catalogue candidates.
 * Does not invent products, fabric photos, or parallel catalogues.
 */
export function buildTieMateDeck(
  candidates: readonly TieMateFabricCandidate[],
  options: TieMateDeckOptions,
): TieMateDeck {
  const requireInStock = options.requireInStock !== false;
  const maxCards = options.maxCards ?? Number.POSITIVE_INFINITY;

  let skippedWithoutPhoto = 0;
  let skippedOutOfStock = 0;
  let skippedNotTie = 0;
  let skippedInactive = 0;

  const eligible: TieMateFabricCard[] = [];

  for (const candidate of candidates) {
    if (candidate.status !== "active") {
      skippedInactive += 1;
      continue;
    }

    const matchedTieConceptIds = candidateMatchesTieConcepts(
      candidate,
      options.tieConceptIds,
    );
    if (matchedTieConceptIds.length === 0) {
      skippedNotTie += 1;
      continue;
    }

    // Phone-scale exploration requires a fabric image; prefer swatch close-up.
    const fabric = resolveTieMateFabricImage(candidate);
    if (!fabric) {
      skippedWithoutPhoto += 1;
      continue;
    }

    const inStock = isInStock(candidate);
    if (requireInStock && !inStock) {
      skippedOutOfStock += 1;
      continue;
    }

    eligible.push({
      productId: candidate.productId,
      productSlug: candidate.productSlug,
      name: candidate.name,
      variantId: candidate.variantId,
      price: candidate.price,
      inventoryQuantity: candidate.inventoryQuantity,
      inStock,
      fabricImageUrl: fabric.url,
      fabricPhotoRole: fabric.role,
      matchedTieConceptIds,
    });
  }

  const pinned = options.pinnedProductIds ?? [];
  const pinnedSet = new Set(pinned);
  const ordered = [
    ...pinned.flatMap((id) => eligible.filter((card) => card.productId === id)),
    ...eligible.filter((card) => !pinnedSet.has(card.productId)),
  ];

  // Deduplicate if a pinned id appears twice in input order.
  const seen = new Set<ProductId>();
  const cards: TieMateFabricCard[] = [];
  for (const card of ordered) {
    if (seen.has(card.productId)) continue;
    seen.add(card.productId);
    cards.push(card);
    if (cards.length >= maxCards) break;
  }

  return {
    retailerId: options.retailerId,
    slug: options.slug,
    cards,
    skippedWithoutPhoto,
    skippedOutOfStock,
    skippedNotTie,
    skippedInactive,
  };
}

/**
 * Narrow handoff paths into existing Customer surfaces — no parallel catalogue.
 */
export function buildTieMateActionPaths(args: {
  readonly slug: string;
  readonly productSlug: string;
  readonly productId: ProductId;
  readonly productIdsForSwipe?: readonly ProductId[];
}): TieMateActionPaths {
  const productIds =
    args.productIdsForSwipe && args.productIdsForSwipe.length > 0
      ? args.productIdsForSwipe
      : [args.productId];
  const swipeQuery = new URLSearchParams({
    products: productIds.map(String).join(","),
  });
  const appointmentQuery = new URLSearchParams({
    occasion: "Tie-Mate fabric exploration",
    shortlist: productIds.map(String).join(","),
  });

  return {
    deckPath: `/r/${args.slug}/tie-mate`,
    productPath: `/r/${args.slug}/products/${args.productSlug}`,
    orderPath: `/r/${args.slug}/products/${args.productSlug}`,
    wishlistHint: "wishlist_via_swipe_save",
    appointmentPath: `/r/${args.slug}/appointments?${appointmentQuery.toString()}`,
    messagesPath: `/messages`,
    swipeHandoffPath: `/r/${args.slug}/swipe?${swipeQuery.toString()}`,
  };
}

/**
 * Resolve neckwear/tie concept IDs from an accepted concept catalogue by
 * garment_type slug/label heuristics. Callers pass reviewed concepts only.
 */
export function resolveTieConceptIds(args: {
  readonly concepts: readonly {
    readonly id: MetadataConceptId;
    readonly kind: string;
    readonly slug: string;
    readonly label: string;
    readonly reviewState?: string;
  }[];
}): ReadonlySet<MetadataConceptId> {
  const ids = new Set<MetadataConceptId>();
  for (const concept of args.concepts) {
    if (concept.kind !== "garment_type") continue;
    if (
      concept.reviewState !== undefined &&
      concept.reviewState !== "accepted"
    ) {
      continue;
    }
    const haystack = `${concept.slug} ${concept.label}`.toLowerCase();
    if (
      haystack.includes("tie") ||
      haystack.includes("neckwear") ||
      haystack.includes("bowtie") ||
      haystack.includes("bow-tie") ||
      haystack.includes("cravat")
    ) {
      ids.add(concept.id);
    }
  }
  return ids;
}
