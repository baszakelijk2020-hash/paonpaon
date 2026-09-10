export const CANONICAL_CATEGORIES = [
  "Suits",
  "Jackets",
  "Pants",
  "Knits",
  "Shoes",
  "Shirts",
  "Outerwear",
  "Evening",
  "Wedding",
  "Accessories",
] as const;

export const CATEGORY_KEYWORDS: Record<
  (typeof CANONICAL_CATEGORIES)[number],
  readonly string[]
> = {
  // "suit" only — weave-pattern words (twill/houndstooth/glencheck/mélange)
  // used to live here too, but those describe jacket fabrics just as often
  // as suit fabrics (see the id-range fallback below), so keeping them
  // here was mis-sorting real jacket fabrics into Suits by coincidence of
  // wording, not garment type.
  Suits: ["suit"],
  Jackets: ["jacket", "blazer", "sport coat", "sportcoat"],
  // "broek" still matches trouser slugs (`…-broek1`); display names follow
  // the product photography (e.g. "Khaki Cotton Trousers").
  Pants: ["pant", "trouser", "chino", "broek"],
  // "cashmere" used to live here too, but that's a fiber, not a garment —
  // a cashmere-blend SUITING fabric (e.g. "Silk, Wool & Cashmere
  // Glencheck") was winning this check before the id-range fallback ever
  // ran, mis-sorting real suit/jacket fabrics into Knits by coincidence
  // of material, not garment type. Same class of bug the "mélange" removal
  // above already fixed once.
  // "merino" used to live here too, and it is a fiber rather than a garment
  // in exactly the way "cashmere" and "mélange" were before it — a merino
  // SUITING cloth ("Smoke Grey Mélange S130 Merino Wool Twill") was landing in
  // Knitwear on the strength of the wool it is woven from.
  Knits: [
    "knit",
    "sweater",
    "cardigan",
    "jumper",
    "roll neck",
    "rollneck",
    "turtleneck",
    "crew",
    "polo",
    "quarter-zip",
    "cable",
  ],
  Shoes: ["shoe", "loafer", "oxford", "derby", "boot", "sneaker"],
  Shirts: ["shirt"],
  Outerwear: ["overcoat", "parka", "topcoat"],
  Evening: ["tuxedo", "evening", "black tie", "dinner jacket"],
  Wedding: ["wedding", "groom"],
  // Names with no real garment type — worn/carried extras. Kept in sync with
  // NON_GARMENT_NAME_HINTS below (same list, single source).
  Accessories: [
    "pocket square",
    "tie",
    "cufflink",
    "belt",
    "briefcase",
    "bag",
    "wallet",
    "satchel",
    "tote",
    "pouch",
    "watch",
    "sunglasses",
    "hat",
    "scarf",
    "glove",
    "sock",
  ],
};

/**
 * Categories with an unambiguous name-keyword, in the order their keywords are
 * checked — all of them before the Suits/Jackets id-range fallback, so an
 * explicit garment word (a "Sport Coat" or "Overcoat" that happens to reuse a
 * suit fabric's own product photo) always wins over which numbered fabric
 * photo it reuses.
 *
 * The order is by how much of the garment each list's words actually name, not
 * the display order. Words for the shape of the thing come first and words for
 * how it is made come last: "Navy Knit Lifestyle Sneaker" is a shoe that
 * happens to be knitted, and Knits used to claim it because "knit" was read
 * before "sneaker". "Dinner jacket" is evening wear for the same reason.
 * Suits is absent on purpose — "suit" appears in the name of every suiting
 * cloth, so it is only consulted once nothing else has settled the garment.
 */
const UNAMBIGUOUS_CATEGORY_ORDER = [
  "Accessories",
  "Shoes",
  "Evening",
  "Wedding",
  "Outerwear",
  "Shirts",
  "Pants",
  "Jackets",
  "Knits",
] as const satisfies readonly (typeof CANONICAL_CATEGORIES)[number][];

/** Names with no real garment type at all (accessories) shouldn't fall
 * into the Suits/Jackets id-range guess just because they reuse one of
 * those fabrics' product photography. */
const NON_GARMENT_NAME_HINTS = CATEGORY_KEYWORDS.Accessories;

/**
 * The founder's own real catalog (`paon.html`) numbers suit fabrics
 * below 8000 and jacket fabrics at or above it (its own `getCat()`:
 * `parseInt(id) < 8000 ? 'Suits' : 'Jackets'`) — the demo seed reuses
 * those exact numbered photos (`smaller/9177.webp`, etc.) for several
 * products, some of which are misleadingly named "X Suiting Fabric"
 * even when the numbered photo is actually a jacket fabric (id ≥ 8000).
 * No keyword list can recover the right category from a name that says
 * "Suiting Fabric" on a jacket fabric — only the founder's own id
 * scheme can, so it's consulted directly as a fallback once no explicit
 * garment word settles it.
 */
function suitOrJacketFromImageId(imagePath: string): string | null {
  const match = /(\d{4})\.\w+(?:$|\?)/.exec(imagePath);
  if (!match?.[1]) return null;
  const id = Number(match[1]);
  if (id < 6000 || id > 9999) return null; // outside the founder's fabric-id range entirely
  return id < 8000 ? "Suits" : "Jackets";
}

/** Maps to the template's fixed filter taxonomy — "" is that taxonomy's
 * own catch-all bucket, not a made-up fallback. */
export function canonicalCategoryFor(
  productName: string,
  collectionName: string | undefined,
  imagePath: string,
): string {
  const haystack = `${productName} ${collectionName ?? ""}`.toLowerCase();

  for (const category of UNAMBIGUOUS_CATEGORY_ORDER) {
    if (
      CATEGORY_KEYWORDS[category].some((keyword) => haystack.includes(keyword))
    ) {
      return category;
    }
  }

  if (!NON_GARMENT_NAME_HINTS.some((hint) => haystack.includes(hint))) {
    const byImageId = suitOrJacketFromImageId(imagePath);
    if (byImageId) return byImageId;
  }

  if (CATEGORY_KEYWORDS.Suits.some((keyword) => haystack.includes(keyword))) {
    return "Suits";
  }

  return "";
}
