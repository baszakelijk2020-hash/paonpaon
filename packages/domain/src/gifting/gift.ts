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
  "pending" | "opened" | "redeemed" | "expired" | "revoked";

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
  readonly createdAt: string;
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
