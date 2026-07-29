/**
 * Customer self-scan reports (FIT-001, FIT-003). Explicitly separate from
 * official garment fitting observations (ADR-016/055).
 */

import type { OrderStatus } from "../commerce/order";
import type {
  CustomerId,
  OrderLineId,
  PhysicalGarmentId,
  RetailerId,
  WardrobeAttachmentId,
  WardrobeItemId,
  WardrobeSelfReportId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

import type { WardrobeFitPerception, WardrobeItem } from "./wardrobe";

export const WARDROBE_SELF_REPORT_PROVENANCE =
  "customer_self_reported" as const;

export type WardrobeSelfReportProvenance =
  typeof WARDROBE_SELF_REPORT_PROVENANCE;

/** Order statuses that permit self-scan for a linked purchase line. */
export const SELF_SCAN_ELIGIBLE_ORDER_STATUSES = [
  "ready_for_fulfillment",
  "shipped",
  "delivered",
  "completed",
] as const satisfies readonly OrderStatus[];

export type SelfScanEligibleOrderStatus =
  (typeof SELF_SCAN_ELIGIBLE_ORDER_STATUSES)[number];

export interface WardrobeSelfReport extends Timestamps {
  readonly id: WardrobeSelfReportId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly wardrobeItemId: WardrobeItemId;
  readonly provenance: WardrobeSelfReportProvenance;
  readonly notes?: string;
  readonly fitPerception?: WardrobeFitPerception;
  readonly attachmentId?: WardrobeAttachmentId;
  readonly orderLineId?: OrderLineId;
  readonly physicalGarmentId?: PhysicalGarmentId;
  readonly reportedAt: string;
}

export interface WardrobeAttachment {
  readonly id: WardrobeAttachmentId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly wardrobeItemId: WardrobeItemId;
  readonly selfReportId?: WardrobeSelfReportId;
  readonly storageBucket: string;
  readonly storagePath: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly createdAt: string;
}

export interface SelfScanEligibilityInput {
  readonly item: Pick<
    WardrobeItem,
    | "id"
    | "customerId"
    | "retailerId"
    | "ownershipKind"
    | "orderLineId"
    | "physicalGarmentId"
    | "condition"
    | "retiredAt"
  >;
  readonly customerId: CustomerId;
  readonly orderStatus?: OrderStatus | null;
}

export type SelfScanIneligibilityReason =
  | "not_owner"
  | "retired"
  | "external_without_service_link"
  | "order_not_fulfilled";

export interface SelfScanEligibilityResult {
  readonly eligible: boolean;
  readonly reason?: SelfScanIneligibilityReason;
}

export function isSelfScanEligible(
  input: SelfScanEligibilityInput,
): SelfScanEligibilityResult {
  if (input.item.customerId !== input.customerId) {
    return { eligible: false, reason: "not_owner" };
  }

  if (
    input.item.condition === "retired" ||
    (input.item.retiredAt !== undefined && input.item.retiredAt !== null)
  ) {
    return { eligible: false, reason: "retired" };
  }

  const hasPurchaseLink =
    input.item.ownershipKind === "retailer_purchased" ||
    input.item.orderLineId !== undefined ||
    input.item.physicalGarmentId !== undefined;

  if (!hasPurchaseLink) {
    return { eligible: false, reason: "external_without_service_link" };
  }

  if (input.item.orderLineId) {
    const status = input.orderStatus ?? null;
    if (
      !status ||
      !SELF_SCAN_ELIGIBLE_ORDER_STATUSES.includes(
        status as SelfScanEligibleOrderStatus,
      )
    ) {
      return { eligible: false, reason: "order_not_fulfilled" };
    }
  }

  return { eligible: true };
}

/**
 * Guard that self-report payloads cannot be mapped to official observations.
 * Used in tests and repository boundaries.
 */
export function selfReportToOfficialObservationForbidden(
  report: Pick<WardrobeSelfReport, "provenance" | "notes">,
): boolean {
  return (
    report.provenance === WARDROBE_SELF_REPORT_PROVENANCE &&
    report.notes !== undefined
  );
}
