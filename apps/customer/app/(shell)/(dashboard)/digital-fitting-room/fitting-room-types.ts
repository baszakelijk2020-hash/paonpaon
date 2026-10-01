import type { OutfitSlotKind } from "@paon/domain";

/** One piece the customer can put into a try-on look. Wardrobe pieces are
 * owned garments; product pieces come from the catalogue via the wishlist
 * ("favorites"). */
export interface ComposableItem {
  readonly key: string;
  readonly kind: "wardrobe" | "product";
  readonly id: string;
  readonly label: string;
  readonly imageUrl?: string;
  readonly suggestedSlotKind?: OutfitSlotKind;
}

/** A catalogue product the customer has not saved yet, offered by the
 * "Find more" picker in the tray card. `variantId` is the variant the
 * wishlist RPC saves (the first one). */
export interface SaveableProduct {
  readonly productId: string;
  readonly variantId: string;
  readonly name: string;
  readonly imageUrl?: string;
  readonly suggestedSlotKind?: OutfitSlotKind;
}

export const SLOT_LABELS: Readonly<Record<OutfitSlotKind, string>> = {
  jacket: "Jacket",
  trousers: "Trousers",
  shirt: "Shirt",
  shoes: "Shoes",
  accessories: "Accessory",
  pocket_square: "Pocket square",
};

const SLOT_KEYWORDS: ReadonlyArray<readonly [OutfitSlotKind, RegExp]> = [
  ["pocket_square", /pocket\s*square|handkerchief/i],
  [
    "jacket",
    /jacket|blazer|coat|suit|tuxedo|dinner|waistcoat|vest|cardigan|overcoat|parka/i,
  ],
  ["trousers", /trouser|pant|chino|jean|short|slack/i],
  [
    "shoes",
    /shoe|boot|loafer|oxford|derby|brogue|sneaker|monk|sandal|slipper/i,
  ],
  [
    "accessories",
    /tie|scarf|belt|watch|cufflink|glove|hat|cap|bag|braces|sock|bow/i,
  ],
  ["shirt", /shirt|tee|t-shirt|polo|knit|sweater|jumper|turtleneck|blouse/i],
];

/** Best-effort slot guess from a product name — a suggestion only, the
 * customer can always change the slot in the look builder. */
export function inferSlotKindFromName(
  name: string,
): OutfitSlotKind | undefined {
  for (const [slot, pattern] of SLOT_KEYWORDS) {
    if (pattern.test(name)) return slot;
  }
  return undefined;
}
