import type {
  MicroCapsuleDropId,
  MicroCapsuleDropProductId,
  ProductId,
  RetailerId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

/** A staff-curated weekly capsule of products, published when ready. */
export interface MicroCapsuleDrop extends Timestamps {
  readonly id: MicroCapsuleDropId;
  readonly retailerId: RetailerId;
  readonly title: string;
  readonly theme?: string;
  readonly weekStart: string;
  readonly published: boolean;
}

/** Ordered product membership of a drop; rank is display order, 1-based. */
export interface MicroCapsuleDropProduct {
  readonly id: MicroCapsuleDropProductId;
  readonly dropId: MicroCapsuleDropId;
  readonly productId: ProductId;
  readonly rank: number;
}
