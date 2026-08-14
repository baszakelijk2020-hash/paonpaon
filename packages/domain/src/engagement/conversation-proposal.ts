/**
 * FT-09 unified remote proposal (PHASE 10.3 / CLI-004 / CMP-103).
 *
 * An advisor turns a remote conversation into one concrete decision
 * artifact — selected products/looks, an explanation, price, alternatives,
 * an appointment option — that the customer can accept or decline. Reuses
 * `Conversation`/`Message`, not a second proposal/quote model.
 *
 * The one requirement that actually needed schema: "expiration/versioning
 * (a stale proposal is never silently treated as still valid)". Server-side
 * enforcement lives in the `create_conversation_proposal`/
 * `respond_to_conversation_proposal` RPCs (see the migration); this module
 * only mirrors that freshness rule in pure TypeScript so the UI can show
 * the same "expired"/"superseded" state without a round trip, not as the
 * actual trust boundary.
 */

import type {
  ConversationId,
  ConversationProposalId,
  RetailerId,
  StaffId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

export const CONVERSATION_PROPOSAL_STATUSES = [
  "active",
  "superseded",
  "accepted",
  "declined",
] as const;
export type ConversationProposalStatus =
  (typeof CONVERSATION_PROPOSAL_STATUSES)[number];

export interface ConversationProposalItem {
  readonly label: string;
  readonly productId?: string;
  readonly variantId?: string;
  readonly description?: string;
}

export interface ConversationProposal extends Timestamps {
  readonly id: ConversationProposalId;
  readonly retailerId: RetailerId;
  readonly conversationId: ConversationId;
  readonly createdByStaffId: StaffId;
  readonly version: number;
  readonly status: ConversationProposalStatus;
  readonly title: string;
  readonly advisorNote: string;
  readonly items: readonly ConversationProposalItem[];
  readonly alternatives: readonly ConversationProposalItem[];
  readonly priceMinorUnits?: number;
  readonly priceCurrency?: string;
  readonly appointmentOffered: boolean;
  readonly expiresAt: string;
  readonly respondedAt?: string;
  readonly response?: "accepted" | "declined";
}

/**
 * The same freshness rule the RPC enforces, mirrored for display purposes
 * only — a UI showing "this offer has expired" before the customer even
 * tries to respond is a courtesy, not the actual check. Never treat this
 * function's result as authorization; the RPC re-derives it server-side
 * from `now()` regardless of what the client believes the time is.
 */
export function isConversationProposalRespondable(
  proposal: Pick<ConversationProposal, "status" | "expiresAt">,
  nowIso: string,
): boolean {
  if (proposal.status !== "active") return false;
  return Date.parse(nowIso) <= Date.parse(proposal.expiresAt);
}
