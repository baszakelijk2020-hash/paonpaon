import type {
  CollectionId,
  ProductId,
  ProductVariantId,
  RetailerId,
} from "../shared/branded-id";
import type { Money } from "../shared/money";
import type { Timestamps } from "../shared/timestamps";

export type ProductStatus = "draft" | "active" | "archived";

/**
 * A Product is the sellable concept (e.g. "Bespoke Wool Overcoat").
 * Price, SKU, size and stock live on ProductVariant — a Product never
 * has a price of its own, matching how made-to-order and alterable
 * luxury goods are actually sold.
 */
export interface Product extends Timestamps {
  readonly id: ProductId;
  readonly retailerId: RetailerId;
  readonly name: string;
  readonly slug: string;
  readonly description: string;
  readonly status: ProductStatus;
  readonly isMadeToOrder: boolean;
  readonly isAlterable: boolean;
  readonly collectionIds: readonly CollectionId[];
  readonly primaryImageUrl?: string;
  /** A distinct fabric/texture close-up — paon.html's detail view shows
   * this separately from the main photo. Falls back to primaryImageUrl
   * when unset, not a required second upload. */
  readonly swatchImageUrl?: string;
}

export interface ProductVariant extends Timestamps {
  readonly id: ProductVariantId;
  readonly productId: ProductId;
  readonly sku: string;
  readonly size?: string;
  readonly color?: string;
  readonly price: Money;
  readonly compareAtPrice?: Money;
  readonly inventoryQuantity: number;
  readonly leadTimeDays?: number;
}

export interface Collection extends Timestamps {
  readonly id: CollectionId;
  readonly retailerId: RetailerId;
  readonly name: string;
  readonly slug: string;
  readonly season?: string;
}
