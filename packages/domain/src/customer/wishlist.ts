import type {
  CustomerId,
  ProductVariantId,
  WishlistId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

export interface Wishlist extends Timestamps {
  readonly id: WishlistId;
  readonly customerId: CustomerId;
  readonly name: string;
  readonly isDefault: boolean;
}

export interface WishlistItem {
  readonly wishlistId: WishlistId;
  readonly productVariantId: ProductVariantId;
  readonly addedAt: string;
  readonly note?: string;
}
