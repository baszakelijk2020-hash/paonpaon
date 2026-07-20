import type {
  CustomerId,
  RetailerId,
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

export type WeddingPartyMemberRole =
  "groom" | "best_man" | "groomsman" | "father_of_groom" | "other";

export const WEDDING_PARTY_MEMBER_ROLES: readonly WeddingPartyMemberRole[] = [
  "groom",
  "best_man",
  "groomsman",
  "father_of_groom",
  "other",
];

export type WeddingPartyMemberFittingStatus =
  "invited" | "scheduled" | "fitted" | "completed";

export const WEDDING_PARTY_MEMBER_FITTING_STATUSES: readonly WeddingPartyMemberFittingStatus[] =
  ["invited", "scheduled", "fitted", "completed"];

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
  readonly venueName?: string;
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
}
