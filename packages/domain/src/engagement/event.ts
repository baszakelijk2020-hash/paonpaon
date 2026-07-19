import type { CustomerId, EventId, RetailerId } from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

export type EventVisibility = "public" | "invite_only" | "vip_tier";

/** A retailer-hosted event (trunk show, VIP evening, launch). */
export interface RetailerEvent extends Timestamps {
  readonly id: EventId;
  readonly retailerId: RetailerId;
  readonly name: string;
  readonly description: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly locationId?: string;
  readonly visibility: EventVisibility;
  readonly capacity?: number;
}

export interface EventRsvp {
  readonly eventId: EventId;
  readonly customerId: CustomerId;
  readonly status: "invited" | "attending" | "declined" | "attended";
  readonly respondedAt?: string;
}
