import type { OrderStatus } from "./order";

/**
 * Which status an order may move to next.
 *
 * Staff previously had one dropdown listing every status with no server-side
 * check, so an order could jump from `pending_payment` straight to
 * `completed`, or be un-cancelled back into production. The customer reads the
 * same status vocabulary, so an impossible jump is visible to them too.
 *
 * Cancelling is staff-only by design — a customer cannot cancel their own
 * order, they take it up with the shop.
 *
 * `draft` only ever exists between `place_order`'s own steps.
 */
const NEXT_STATUSES: Record<OrderStatus, readonly OrderStatus[]> = {
  draft: ["pending_payment", "canceled"],
  pending_payment: ["placed", "canceled"],
  placed: ["in_production", "ready_for_fulfillment", "canceled"],
  in_production: ["ready_for_fulfillment", "canceled"],
  ready_for_fulfillment: ["shipped", "delivered", "canceled"],
  shipped: ["delivered", "canceled"],
  delivered: ["completed", "refunded"],
  completed: ["refunded"],
  // Terminal.
  canceled: [],
  refunded: [],
};

/** The statuses `from` may legally become. Empty means terminal. */
export function allowedOrderTransitions(
  from: OrderStatus,
): readonly OrderStatus[] {
  return NEXT_STATUSES[from];
}

export function canTransitionOrder(
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  return from === to || NEXT_STATUSES[from].includes(to);
}
