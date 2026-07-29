import type { CustomerId, EventId, RetailerId } from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

export type EventVisibility = "public" | "invite_only" | "vip_tier";
export type EventStatus = "draft" | "published" | "cancelled" | "completed";

export const EVENT_VISIBILITY_LABELS: Record<EventVisibility, string> = {
  public: "Public",
  invite_only: "Invite only",
  vip_tier: "VIP clients",
};

export const EVENT_RSVP_STATUS_LABELS: Record<
  "invited" | "attending" | "declined" | "attended",
  string
> = {
  invited: "Invited",
  attending: "Attending",
  declined: "Declined",
  attended: "Attended",
};

/** A retailer-hosted event (trunk show, VIP evening, launch). */
export interface RetailerEvent extends Timestamps {
  readonly id: EventId;
  readonly retailerId: RetailerId;
  readonly name: string;
  readonly description: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly venueName: string;
  readonly venueAddress?: string;
  readonly visibility: EventVisibility;
  readonly status: EventStatus;
  readonly capacity?: number;
}

export interface EventRsvp {
  readonly eventId: EventId;
  readonly customerId: CustomerId;
  readonly status: "invited" | "attending" | "declined" | "attended";
  readonly respondedAt?: string;
  readonly createdAt: string;
}
