/**
 * Order-to-delivery Honeymoon Phase projector (CMP-106 / PHASE 10.2).
 * Milestones expose preparation, collection, and aftercare actions with
 * stock/lead-time truth and contact-pressure suppression.
 */

import type { OrderStatus } from "../commerce/order";
import { isContactPressureActive } from "../intelligence/clienteling-opportunity";

export const HONEYMOON_PHASE_PROJECTOR_VERSION = "honeymoon-phase-v1";

export const HONEYMOON_MILESTONE_KINDS = [
  "preparation",
  "collection",
  "aftercare",
] as const;

export type HoneymoonMilestoneKind = (typeof HONEYMOON_MILESTONE_KINDS)[number];

export const HONEYMOON_MILESTONE_STATUSES = [
  "pending",
  "available",
  "completed",
  "dismissed",
  "suppressed",
] as const;

export type HoneymoonMilestoneStatus =
  (typeof HONEYMOON_MILESTONE_STATUSES)[number];

export const HONEYMOON_ACTION_KINDS = [
  "book_appointment",
  "view_care",
  "prepare_wardrobe",
  "collection_plan",
  "review_fit",
] as const;

export type HoneymoonActionKind = (typeof HONEYMOON_ACTION_KINDS)[number];

export interface HoneymoonOrderLineContext {
  readonly productVariantId: string;
  readonly sku?: string;
  readonly quantity: number;
  readonly requiresProduction: boolean;
  readonly requiresAlteration: boolean;
  readonly leadTimeDays?: number | null;
  readonly inventoryQuantity?: number | null;
}

export interface ProjectHoneymoonMilestonesInput {
  readonly orderId: string;
  readonly orderStatus: OrderStatus;
  readonly placedAt?: string;
  readonly lines: readonly HoneymoonOrderLineContext[];
  readonly nowUtcIso: string;
  readonly recentTouchCount: number;
  readonly cooldownUntil?: string;
}

export interface HoneymoonMilestoneDraft {
  readonly kind: HoneymoonMilestoneKind;
  readonly status: HoneymoonMilestoneStatus;
  readonly title: string;
  readonly explanation: string;
  readonly actionKind: HoneymoonActionKind;
  readonly actionHref?: string;
  readonly dueAt?: string;
  readonly stockTruth?: string;
  readonly leadTimeTruth?: string;
  readonly suppressReason?: string;
  readonly displayOrder: number;
}

const TRACKABLE_STATUSES: readonly OrderStatus[] = [
  "placed",
  "in_production",
  "ready_for_fulfillment",
  "shipped",
  "delivered",
  "completed",
];

function maxLeadTimeDays(
  lines: readonly HoneymoonOrderLineContext[],
): number | null {
  const values = lines
    .map((line) => line.leadTimeDays)
    .filter((value): value is number => value !== undefined && value !== null);
  if (values.length === 0) return null;
  return Math.max(...values);
}

function leadTimeTruth(
  lines: readonly HoneymoonOrderLineContext[],
): string | undefined {
  const maxLead = maxLeadTimeDays(lines);
  if (maxLead === null) return undefined;
  const production = lines.some((line) => line.requiresProduction);
  if (production) {
    return `Made-to-measure lines carry up to ${maxLead} day production lead time.`;
  }
  return `Longest variant lead time is ${maxLead} days.`;
}

function stockTruth(
  lines: readonly HoneymoonOrderLineContext[],
): string | undefined {
  const lowStock = lines.filter(
    (line) =>
      line.inventoryQuantity !== undefined &&
      line.inventoryQuantity !== null &&
      line.inventoryQuantity <= 2,
  );
  if (lowStock.length === 0) return "Stock levels are healthy for ordered lines.";
  return `${lowStock.length} line(s) are low stock — your advisor confirms availability before suggesting add-ons.`;
}

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Deterministic milestone drafts from order status, lead time, and contact pressure.
 */
export function projectHoneymoonMilestones(
  input: ProjectHoneymoonMilestonesInput,
): readonly HoneymoonMilestoneDraft[] {
  if (!TRACKABLE_STATUSES.includes(input.orderStatus)) {
    return [];
  }

  const pressure = isContactPressureActive({
    recentTouchCount: input.recentTouchCount,
    now: input.nowUtcIso,
    ...(input.cooldownUntil ? { cooldownUntil: input.cooldownUntil } : {}),
  });

  const placedAt = input.placedAt ?? input.nowUtcIso;
  const leadTruth = leadTimeTruth(input.lines);
  const stock = stockTruth(input.lines);
  const milestones: HoneymoonMilestoneDraft[] = [];
  let order = 0;

  const push = (draft: Omit<HoneymoonMilestoneDraft, "displayOrder">): void => {
    order += 1;
    milestones.push({ ...draft, displayOrder: order });
  };

  if (input.orderStatus === "placed" || input.orderStatus === "in_production") {
    push({
      kind: "preparation",
      status: pressure ? "suppressed" : "available",
      title: "Prepare your wardrobe",
      explanation:
        "Review owned pieces that pair with this order and note any gaps before collection.",
      actionKind: "prepare_wardrobe",
      actionHref: "/wardrobe",
      dueAt: addDays(placedAt, 3),
      ...(leadTruth ? { leadTimeTruth: leadTruth } : {}),
      ...(stock ? { stockTruth: stock } : {}),
      ...(pressure
        ? {
            suppressReason:
              "Contact pressure limit reached — preparation remains available in-app without outreach.",
          }
        : {}),
    });
  }

  if (
    input.orderStatus === "in_production" ||
    input.orderStatus === "ready_for_fulfillment"
  ) {
    push({
      kind: "preparation",
      status: pressure ? "suppressed" : "available",
      title: "Book a fit appointment",
      explanation:
        "Schedule a fitting while production completes so collection is smooth.",
      actionKind: "book_appointment",
      actionHref: "/appointments/new",
      dueAt: addDays(placedAt, 7),
      ...(leadTruth ? { leadTimeTruth: leadTruth } : {}),
      ...(pressure ? { suppressReason: "Advisor outreach paused under contact pressure." } : {}),
    });
  }

  if (
    input.orderStatus === "ready_for_fulfillment" ||
    input.orderStatus === "shipped"
  ) {
    push({
      kind: "collection",
      status: "available",
      title: "Plan your collection",
      explanation:
        "Confirm collection timing and what to bring from your existing wardrobe.",
      actionKind: "collection_plan",
      actionHref: `/orders/${input.orderId}`,
      ...(stock ? { stockTruth: stock } : {}),
    });
  }

  if (
    input.orderStatus === "delivered" ||
    input.orderStatus === "completed"
  ) {
    push({
      kind: "aftercare",
      status: pressure ? "suppressed" : "available",
      title: "Care and first wear",
      explanation:
        "Review care guidance and how this piece fits your wardrobe roadmap.",
      actionKind: "view_care",
      actionHref: "/wardrobe",
      ...(pressure
        ? { suppressReason: "Aftercare nudges paused — open wardrobe anytime." }
        : {}),
    });

    if (input.lines.some((line) => line.requiresAlteration)) {
      push({
        kind: "aftercare",
        status: "available",
        title: "Review tailoring progress",
        explanation:
          "Alteration lines are tracked separately — confirm fit notes with your advisor.",
        actionKind: "review_fit",
        actionHref: `/orders/${input.orderId}`,
      });
    }
  }

  return milestones;
}
