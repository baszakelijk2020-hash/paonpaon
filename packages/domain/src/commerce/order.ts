import type { Address } from "../shared/address";
import type {
  CustomerId,
  OrderId,
  OrderLineId,
  ProductVariantId,
  RetailerId,
} from "../shared/branded-id";
import type { Money } from "../shared/money";
import type { Timestamps } from "../shared/timestamps";

export type OrderStatus =
  | "draft"
  | "placed"
  | "in_production"
  | "ready_for_fulfillment"
  | "shipped"
  | "delivered"
  | "completed"
  | "canceled"
  | "refunded";

export type OrderChannel = "online" | "in_store" | "clienteling" | "phone";

/**
 * An Order is the commercial record. It does not itself track
 * manufacturing or alteration progress — those are separate
 * ProductionOrder / Alteration entities linked 1:1 to an order line,
 * because an order can ship complete while one alteration line is
 * still in progress (see PRODUCT.md, "Order vs. Production").
 */
export interface Order extends Timestamps {
  readonly id: OrderId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly orderNumber: string;
  readonly status: OrderStatus;
  readonly channel: OrderChannel;
  readonly currency: string;
  readonly subtotal: Money;
  readonly total: Money;
  readonly shippingAddress?: Address;
  readonly placedAt?: string;
  readonly staffId?: string;
}

export interface OrderLine {
  readonly id: OrderLineId;
  readonly orderId: OrderId;
  readonly productVariantId: ProductVariantId;
  readonly quantity: number;
  readonly unitPrice: Money;
  readonly requiresProduction: boolean;
  readonly requiresAlteration: boolean;
}

export type PaymentStatus =
  "pending" | "authorized" | "captured" | "refunded" | "failed";

export interface Payment {
  readonly orderId: OrderId;
  readonly amount: Money;
  readonly status: PaymentStatus;
  readonly provider: string;
  readonly providerReference: string;
  readonly capturedAt?: string;
}
