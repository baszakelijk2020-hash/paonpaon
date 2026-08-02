import type {
  CustomerId,
  RetailerId,
  WeddingAftercarePlanId,
  WeddingGroupFittingId,
  WeddingInspirationItemId,
  WeddingPartyId,
  WeddingPartyMemberId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

export type WeddingPartyStatus =
  "planning" | "confirmed" | "completed" | "cancelled";

export const WEDDING_PARTY_STATUSES: readonly WeddingPartyStatus[] = [
  "planning",
  "confirmed",
  "completed",
  "cancelled",
];

export const WEDDING_PARTY_STATUS_LABELS: Record<WeddingPartyStatus, string> = {
  planning: "Planning",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

export type WeddingPartyMemberRole =
  "groom" | "best_man" | "groomsman" | "father_of_groom" | "other";

export const WEDDING_PARTY_MEMBER_ROLES: readonly WeddingPartyMemberRole[] = [
  "groom",
  "best_man",
  "groomsman",
  "father_of_groom",
  "other",
];

export const WEDDING_PARTY_MEMBER_ROLE_LABELS: Record<
  WeddingPartyMemberRole,
  string
> = {
  groom: "Groom",
  best_man: "Best man",
  groomsman: "Groomsman",
  father_of_groom: "Father of the groom",
  other: "Other",
};

export type WeddingPartyMemberFittingStatus =
  "invited" | "scheduled" | "fitted" | "completed";

export const WEDDING_PARTY_MEMBER_FITTING_STATUSES: readonly WeddingPartyMemberFittingStatus[] =
  ["invited", "scheduled", "fitted", "completed"];

export const WEDDING_PARTY_MEMBER_FITTING_STATUS_LABELS: Record<
  WeddingPartyMemberFittingStatus,
  string
> = {
  invited: "Invited",
  scheduled: "Scheduled",
  fitted: "Fitted",
  completed: "Completed",
};

/**
 * Coordination for a wedding's tailoring needs (ADR-035, overriding
 * ADR-034's earlier deferral of the deck's "Moonstruck" concept) —
 * one organizer, several invited members, staff tracking the group.
 * Scoped to coordination, not a lead-generation funnel.
 */
export interface WeddingParty extends Timestamps {
  readonly id: WeddingPartyId;
  readonly retailerId: RetailerId;
  readonly organizerCustomerId: CustomerId;
  readonly eventDate?: string;
  /** Local wall-clock time for the fitting (`HH:MM` or `HH:MM:SS`). */
  readonly eventTime?: string;
  readonly venueName?: string;
  /** Free-text shop / atelier address for the fitting — not the wedding
   * venue. `Location` is not modelled yet (ROADMAP Phase 1). */
  readonly fittingLocation?: string;
  /** Public URL of the party cover image in the `party-photos` bucket. */
  readonly coverPhotoUrl?: string;
  readonly status: WeddingPartyStatus;
  readonly notes?: string;
  /** The shareable join link's token — the organizer sends
   * `/r/{slug}/wedding-parties/join/{inviteToken}` to the whole party
   * instead of a sales associate typing in every member by hand. */
  readonly inviteToken: string;
}

/** Every member is a real `Customer` — find-or-created by email the
 * same way TableService creates a guest customer (ADR-034) — so a
 * member's fitting history lives on the same record their portal
 * login (if they ever create one) links to. */
export interface WeddingPartyMember extends Timestamps {
  readonly id: WeddingPartyMemberId;
  readonly weddingPartyId: WeddingPartyId;
  readonly customerId: CustomerId;
  readonly name: string;
  readonly role: WeddingPartyMemberRole;
  readonly fittingStatus: WeddingPartyMemberFittingStatus;
  /** Public URL of the member's photo in the `party-photos` bucket. */
  readonly photoUrl?: string;
  /** Self-reported height in cm — party-scoped prep data (ADR-055),
   * not a CustomerFitProfile. */
  readonly heightCm?: number;
  /** Self-reported weight in kg — party-scoped prep data (ADR-055). */
  readonly weightKg?: number;
}

/** Post-order "delivery and pickup readiness" instruction (FT-13). A null
 * `weddingPartyMemberId` means it applies to the whole party (e.g. "return
 * rentals within 3 days"); a set one is scoped to that member only. */
export interface WeddingAftercarePlan {
  readonly id: WeddingAftercarePlanId;
  readonly weddingPartyId: WeddingPartyId;
  readonly weddingPartyMemberId?: WeddingPartyMemberId;
  readonly instruction: string;
  readonly dueOn?: string;
  readonly completedAt?: string;
  readonly createdAt: string;
}

/** A single scheduled group fitting session for the whole party (FT-13).
 * No per-member RSVP/registration exists in the schema — this is a
 * scheduled slot with a capacity, not a booking system. */
export interface WeddingGroupFitting {
  readonly id: WeddingGroupFittingId;
  readonly weddingPartyId: WeddingPartyId;
  readonly scheduledAt: string;
  readonly capacity: number;
  readonly createdAt: string;
}

/** A pinned inspiration photo/note (FT-13). `addedByCustomerId` is absent
 * when the record predates a customer link; `internalOnly` defaults true —
 * a couple pinning a magazine photo is not licensed for publication. */
export interface WeddingInspirationItem {
  readonly id: WeddingInspirationItemId;
  readonly weddingPartyId: WeddingPartyId;
  readonly addedByCustomerId?: CustomerId;
  readonly imageRef?: string;
  readonly note?: string;
  readonly internalOnly: boolean;
  readonly createdAt: string;
}
