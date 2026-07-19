import type { CustomerId, RetailerId } from "../shared/branded-id";

/**
 * The single event shape fed into analytics and AI personalisation.
 * Every customer-facing interaction worth analyzing emits one of these
 * rather than a bespoke table — keeps the personalisation feature set
 * additive instead of requiring new schema per signal.
 */
export interface BehavioralEvent {
  readonly retailerId: RetailerId;
  readonly customerId?: CustomerId;
  readonly name: string;
  readonly properties: Record<string, unknown>;
  readonly occurredAt: string;
  readonly source: "customer_portal" | "retailer_portal" | "admin" | "server";
}
