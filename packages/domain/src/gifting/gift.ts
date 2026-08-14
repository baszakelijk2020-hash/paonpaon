import type {
  GiftCuratedItemId,
  GiftExperienceId,
  GiftInvitationId,
  ProductVariantId,
  RetailerId,
  StaffId,
} from "../shared/branded-id";
import type { Money } from "../shared/money";

export type GiftExperienceStatus = "draft" | "active" | "expired" | "revoked";

export type GiftInvitationStatus =
  "pending" | "opened" | "redeemed" | "expired" | "revoked" | "refunded";

export const GIFT_EXPERIENCE_STATUS_LABELS: Record<
  GiftExperienceStatus,
  string
> = {
  draft: "Draft",
  active: "Active",
  expired: "Expired",
  revoked: "Revoked",
};

export const GIFT_INVITATION_STATUS_LABELS: Record<
  GiftInvitationStatus,
  string
> = {
  pending: "Not yet opened",
  opened: "Opened",
  redeemed: "Redeemed",
  expired: "Expired",
  revoked: "Revoked",
  refunded: "Refunded",
};

/** A retailer-curated gift experience — FT-10 Inspiration Box / gift
 * booklet (docs/FOUNDER_TOOL_BLUEPRINTS.md). One experience holds the
 * curated pieces a giver sends; each invitation is one recipient's opaque
 * link into it. */
export interface GiftExperience {
  readonly id: GiftExperienceId;
  readonly retailerId: RetailerId;
  readonly createdByStaffId?: StaffId;
  readonly title: string;
  readonly introMessage: string;
  readonly status: GiftExperienceStatus;
  readonly expiresAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface GiftCuratedItem {
  readonly id: GiftCuratedItemId;
  readonly giftExperienceId: GiftExperienceId;
  readonly productVariantId: ProductVariantId;
  readonly note?: string;
  readonly sortOrder: number;
}

/** A recipient's own row, resolved only through its opaque token — never
 * listed by a customer-facing query (ADR-034). */
export interface GiftInvitation {
  readonly id: GiftInvitationId;
  readonly giftExperienceId: GiftExperienceId;
  readonly inviteToken: string;
  readonly recipientName?: string;
  readonly recipientEmail?: string;
  readonly status: GiftInvitationStatus;
  readonly openedAt?: string;
  readonly redeemedAt?: string;
  readonly redeemedCuratedItemId?: GiftCuratedItemId;
  readonly emailSentAt?: string;
  readonly expiresAt?: string;
  readonly revokedAt?: string;
  readonly refundAmountMinorUnits?: number;
  readonly refundReason?: string;
  readonly createdAt: string;
}

/** One append-only row of `gift_invitation_state_history` — every
 * expiry/revocation/refund transition an invitation goes through. Never
 * updated or deleted once written (see the migration that created the
 * table); a correction is always a new row, not an edit. */
export interface GiftInvitationStateHistory {
  readonly id: string;
  readonly giftInvitationId: GiftInvitationId;
  readonly fromStatus?: GiftInvitationStatus;
  readonly toStatus: GiftInvitationStatus;
  readonly reason?: string;
  readonly refundAmountMinorUnits?: number;
  readonly actorStaffId?: StaffId;
  readonly createdAt: string;
}

/** Whether `invitation` has lapsed on either its own `expiresAt` or its
 * parent experience's `expiresAt`. Mirrors the check
 * `expire_gift_invitation` makes in the database — this is the
 * client-side predicate for fast-fail UX (e.g. graying out a "Revoke"
 * button); the database call is what actually enforces it. Only
 * pending/opened invitations can be expired — anything already
 * redeemed/revoked/refunded/expired is untouched by expiry. */
export function checkInvitationExpiry(
  invitation: Pick<GiftInvitation, "status" | "expiresAt">,
  experience: Pick<GiftExperience, "expiresAt">,
  now: Date = new Date(),
): boolean {
  if (invitation.status !== "pending" && invitation.status !== "opened") {
    return false;
  }
  const invitationExpiry = invitation.expiresAt
    ? new Date(invitation.expiresAt)
    : null;
  const experienceExpiry = experience.expiresAt
    ? new Date(experience.expiresAt)
    : null;
  return (
    (invitationExpiry !== null && invitationExpiry < now) ||
    (experienceExpiry !== null && experienceExpiry < now)
  );
}

/** Whether a manager could call `revoke_gift_invitation` on `invitation`
 * right now — only a still-live (pending/opened) invitation can be
 * revoked. Mirrors `revoke_gift_invitation`'s own guard. */
export function canRevoke(invitation: Pick<GiftInvitation, "status">): boolean {
  return invitation.status === "pending" || invitation.status === "opened";
}

/** Whether a manager could call `mark_gift_invitation_refunded` on
 * `invitation` right now — only a redeemed invitation that has not
 * already been refunded. Mirrors `mark_gift_invitation_refunded`'s own
 * guard, which is what actually prevents a double refund. */
export function canRefund(
  invitation: Pick<GiftInvitation, "status" | "refundAmountMinorUnits">,
): boolean {
  return (
    invitation.status === "redeemed" &&
    invitation.refundAmountMinorUnits == null
  );
}

/** One curated item as the recipient sees it — the RPC's live-authority
 * read of price/name/image, not the retailer's edit-time snapshot. */
export interface GiftRevealItem {
  readonly curatedItemId: GiftCuratedItemId;
  readonly productVariantId: ProductVariantId;
  readonly productName: string;
  readonly variantLabel?: string;
  readonly price: Money;
  readonly primaryImageUrl?: string;
  readonly note?: string;
}

/** The full payload `resolve_gift_invitation` returns to an anonymous
 * recipient — everything the reveal page needs and nothing more. */
export interface GiftReveal {
  readonly retailerDisplayName: string;
  readonly retailerSlug: string;
  readonly title: string;
  readonly introMessage: string;
  readonly status: GiftInvitationStatus;
  readonly redeemedCuratedItemId?: GiftCuratedItemId;
  readonly items: readonly GiftRevealItem[];
}
