/**
 * Preferred Tailoring and HighMaintenance concierge operations
 * (SERV-001, SERV-002, LONG-001 / PHASE 5.3 / ADR-062).
 *
 * Dedicated service plans, non-monetary entitlements, bookings, fulfilment,
 * care/repair, collection/delivery, and operational cost recording. Billing
 * may later fund plans but never owns operational state. Compose appointments
 * and alterations — do not overload Order.
 */

import type { AppointmentType } from "../appointments/appointment";
import type {
  AlterationId,
  AppointmentId,
  CustomerId,
  PhysicalGarmentId,
  RetailerId,
  ServiceBookingId,
  ServiceCareRecordId,
  ServiceCostRecordId,
  ServiceEntitlementEntryId,
  ServiceEntitlementId,
  ServiceFulfilmentEventId,
  ServiceHistoryEventId,
  ServiceMembershipId,
  ServicePlanId,
  ServiceWeeklyPlanDayId,
  ServiceWeeklyPlanId,
  StaffId,
  WardrobeItemId,
} from "../shared/branded-id";
import type { CurrencyCode, Money } from "../shared/money";

export const SERVICE_KINDS = [
  "preferred_tailoring",
  "high_maintenance",
] as const;

export type ServiceKind = (typeof SERVICE_KINDS)[number];

export const SERVICE_KIND_LABELS: Record<ServiceKind, string> = {
  preferred_tailoring: "Preferred Tailoring",
  high_maintenance: "HighMaintenance",
};

export const SERVICE_PLAN_STATUSES = [
  "draft",
  "active",
  "paused",
  "archived",
] as const;

export type ServicePlanStatus = (typeof SERVICE_PLAN_STATUSES)[number];

export const SERVICE_MEMBERSHIP_STATUSES = [
  "active",
  "paused",
  "ended",
] as const;

export type ServiceMembershipStatus =
  (typeof SERVICE_MEMBERSHIP_STATUSES)[number];

/** Non-monetary operational credits — never stored value or tender. */
export const SERVICE_ENTITLEMENT_KINDS = [
  "planning_session",
  "wardrobe_review",
  "pressing_visit",
  "cleaning_visit",
  "repair_visit",
  "collection_delivery",
  "size_check",
  "button_pleat_check",
  "general_care",
] as const;

export type ServiceEntitlementKind = (typeof SERVICE_ENTITLEMENT_KINDS)[number];

export const SERVICE_ENTITLEMENT_KIND_LABELS: Record<
  ServiceEntitlementKind,
  string
> = {
  planning_session: "Planning session",
  wardrobe_review: "Wardrobe review",
  pressing_visit: "Pressing visit",
  cleaning_visit: "Cleaning visit",
  repair_visit: "Repair visit",
  collection_delivery: "Collection / delivery",
  size_check: "Size check",
  button_pleat_check: "Button & pleat check",
  general_care: "General care",
};

export const SERVICE_ENTITLEMENT_ENTRY_KINDS = [
  "grant",
  "consume",
  "adjust",
] as const;

export type ServiceEntitlementEntryKind =
  (typeof SERVICE_ENTITLEMENT_ENTRY_KINDS)[number];

export const SERVICE_BOOKING_KINDS = [
  "planning",
  "wardrobe_review",
  "pressing",
  "cleaning",
  "repair",
  "collection",
  "delivery",
  "size_check",
  "button_check",
  "care",
] as const;

export type ServiceBookingKind = (typeof SERVICE_BOOKING_KINDS)[number];

export const SERVICE_BOOKING_KIND_LABELS: Record<ServiceBookingKind, string> = {
  planning: "Wardrobe planning",
  wardrobe_review: "Wardrobe review",
  pressing: "Pressing",
  cleaning: "Cleaning",
  repair: "Repair",
  collection: "Collection",
  delivery: "Delivery",
  size_check: "Size check",
  button_check: "Button check",
  care: "Care visit",
};

export const SERVICE_BOOKING_STATUSES = [
  "requested",
  "confirmed",
  "in_progress",
  "fulfilled",
  "canceled",
] as const;

export type ServiceBookingStatus = (typeof SERVICE_BOOKING_STATUSES)[number];

export const SERVICE_BOOKING_STATUS_LABELS: Record<
  ServiceBookingStatus,
  string
> = {
  requested: "Requested",
  confirmed: "Confirmed",
  in_progress: "In progress",
  fulfilled: "Fulfilled",
  canceled: "Canceled",
};

export const SERVICE_BOOKING_STATUS_TRANSITIONS: Readonly<
  Record<ServiceBookingStatus, readonly ServiceBookingStatus[]>
> = {
  requested: ["confirmed", "canceled"],
  confirmed: ["in_progress", "canceled"],
  in_progress: ["fulfilled", "canceled"],
  fulfilled: [],
  canceled: [],
};

export const SERVICE_FULFILMENT_METHODS = [
  "in_store",
  "pickup",
  "collection",
  "delivery",
] as const;

export type ServiceFulfilmentMethod =
  (typeof SERVICE_FULFILMENT_METHODS)[number];

export const SERVICE_FULFILMENT_METHOD_LABELS: Record<
  ServiceFulfilmentMethod,
  string
> = {
  in_store: "In store",
  pickup: "Customer pickup",
  collection: "House collection",
  delivery: "House delivery",
};

export const SERVICE_FULFILMENT_STATUSES = [
  "scheduled",
  "in_transit",
  "received",
  "returned",
  "completed",
  "canceled",
] as const;

export type ServiceFulfilmentStatus =
  (typeof SERVICE_FULFILMENT_STATUSES)[number];

export const SERVICE_FULFILMENT_STATUS_LABELS: Record<
  ServiceFulfilmentStatus,
  string
> = {
  scheduled: "Scheduled",
  in_transit: "In transit",
  received: "Received",
  returned: "Returned",
  completed: "Completed",
  canceled: "Canceled",
};

export const SERVICE_CARE_KINDS = [
  "pressing",
  "cleaning",
  "repair",
  "button_check",
  "pleat_maintenance",
  "size_check",
  "care_note",
] as const;

export type ServiceCareKind = (typeof SERVICE_CARE_KINDS)[number];

export const SERVICE_CARE_KIND_LABELS: Record<ServiceCareKind, string> = {
  pressing: "Pressing",
  cleaning: "Cleaning",
  repair: "Repair",
  button_check: "Button check",
  pleat_maintenance: "Pleat maintenance",
  size_check: "Size check",
  care_note: "Care note",
};

export const SERVICE_HISTORY_KINDS = [
  "plan_created",
  "membership_opened",
  "membership_paused",
  "membership_ended",
  "entitlement_granted",
  "entitlement_consumed",
  "booking_requested",
  "booking_confirmed",
  "booking_fulfilled",
  "booking_canceled",
  "fulfilment_recorded",
  "care_recorded",
  "cost_recorded",
  "appointment_linked",
  "alteration_linked",
  "advisor_assigned",
  "weekly_plan_proposed",
  "weekly_plan_accepted",
  "weekly_plan_declined",
] as const;

export type ServiceHistoryKind = (typeof SERVICE_HISTORY_KINDS)[number];

/** FT-14 Preferred Tailoring: versioned weekly wardrobe plan. */
export const SERVICE_WEEKLY_PLAN_STATUSES = [
  "draft",
  "proposed",
  "customer_accepted",
  "customer_declined",
] as const;

export type ServiceWeeklyPlanStatus =
  (typeof SERVICE_WEEKLY_PLAN_STATUSES)[number];

export const SERVICE_WEEKLY_PLAN_STATUS_LABELS: Record<
  ServiceWeeklyPlanStatus,
  string
> = {
  draft: "Draft",
  proposed: "Awaiting your decision",
  customer_accepted: "Accepted",
  customer_declined: "Declined",
};

/** Day-level occasion pacing — the vocabulary `pag3.html`'s Preferred
 * Tailoring narrative itself uses for how formal each day's wardrobe is. */
export const SERVICE_WEEKLY_PLAN_OCCASION_TAGS = [
  "distinguished",
  "refined",
  "elevated",
  "neutral",
] as const;

export type ServiceWeeklyPlanOccasionTag =
  (typeof SERVICE_WEEKLY_PLAN_OCCASION_TAGS)[number];

export const SERVICE_WEEKLY_PLAN_OCCASION_TAG_LABELS: Record<
  ServiceWeeklyPlanOccasionTag,
  string
> = {
  distinguished: "Distinguished",
  refined: "Refined",
  elevated: "Elevated",
  neutral: "Neutral",
};

export const SERVICE_WEEKLY_PLAN_DAY_LABELS: readonly string[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/** Default non-monetary credits seeded when a plan activates. */
export const DEFAULT_PLAN_ENTITLEMENTS: Record<
  ServiceKind,
  readonly { kind: ServiceEntitlementKind; quantity: number }[]
> = {
  preferred_tailoring: [
    { kind: "planning_session", quantity: 4 },
    { kind: "wardrobe_review", quantity: 2 },
  ],
  high_maintenance: [
    { kind: "pressing_visit", quantity: 8 },
    { kind: "cleaning_visit", quantity: 4 },
    { kind: "repair_visit", quantity: 2 },
    { kind: "collection_delivery", quantity: 8 },
    { kind: "size_check", quantity: 2 },
    { kind: "button_pleat_check", quantity: 4 },
  ],
};

/** Which booking kinds belong to each named service. */
export const BOOKING_KINDS_BY_SERVICE: Record<
  ServiceKind,
  readonly ServiceBookingKind[]
> = {
  preferred_tailoring: ["planning", "wardrobe_review"],
  high_maintenance: [
    "pressing",
    "cleaning",
    "repair",
    "collection",
    "delivery",
    "size_check",
    "button_check",
    "care",
  ],
};

/** Entitlement consumed when a booking is confirmed (if any). */
export const ENTITLEMENT_FOR_BOOKING: Partial<
  Record<ServiceBookingKind, ServiceEntitlementKind>
> = {
  planning: "planning_session",
  wardrobe_review: "wardrobe_review",
  pressing: "pressing_visit",
  cleaning: "cleaning_visit",
  repair: "repair_visit",
  collection: "collection_delivery",
  delivery: "collection_delivery",
  size_check: "size_check",
  button_check: "button_pleat_check",
  care: "general_care",
};

/** Appointment composition — Preferred Tailoring planning uses consultation. */
export const APPOINTMENT_TYPE_FOR_BOOKING: Partial<
  Record<ServiceBookingKind, AppointmentType>
> = {
  planning: "styling_consultation",
  wardrobe_review: "styling_consultation",
  size_check: "fitting",
  repair: "alteration_fitting",
};

/** Care kinds that may compose an alteration work order. */
export const CARE_KINDS_REQUIRING_ALTERATION: readonly ServiceCareKind[] = [
  "repair",
  "size_check",
];

export interface ServicePlan {
  readonly id: ServicePlanId;
  readonly retailerId: RetailerId;
  readonly kind: ServiceKind;
  readonly status: ServicePlanStatus;
  readonly title: string;
  readonly summary: string;
  readonly explanation: string;
  readonly createdByStaffId?: StaffId;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ServiceMembership {
  readonly id: ServiceMembershipId;
  readonly planId: ServicePlanId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly advisorStaffId?: StaffId;
  readonly status: ServiceMembershipStatus;
  readonly commitmentNotes?: string;
  readonly startedAt: string;
  readonly endedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ServiceEntitlement {
  readonly id: ServiceEntitlementId;
  readonly membershipId: ServiceMembershipId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly kind: ServiceEntitlementKind;
  readonly remainingQuantity: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ServiceEntitlementEntry {
  readonly id: ServiceEntitlementEntryId;
  readonly entitlementId: ServiceEntitlementId;
  readonly membershipId: ServiceMembershipId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly entryKind: ServiceEntitlementEntryKind;
  readonly quantity: number;
  readonly idempotencyKey: string;
  readonly bookingId?: ServiceBookingId;
  readonly notes?: string;
  readonly createdByStaffId?: StaffId;
  readonly createdAt: string;
}

export interface ServiceBooking {
  readonly id: ServiceBookingId;
  readonly membershipId: ServiceMembershipId;
  readonly planId: ServicePlanId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly advisorStaffId?: StaffId;
  readonly kind: ServiceBookingKind;
  readonly status: ServiceBookingStatus;
  readonly requestedFor?: string;
  readonly notes?: string;
  readonly commitmentNotes?: string;
  readonly appointmentId?: AppointmentId;
  readonly entitlementEntryId?: ServiceEntitlementEntryId;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ServiceFulfilmentEvent {
  readonly id: ServiceFulfilmentEventId;
  readonly bookingId: ServiceBookingId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly method: ServiceFulfilmentMethod;
  readonly status: ServiceFulfilmentStatus;
  readonly scheduledFor?: string;
  readonly notes?: string;
  readonly recordedByStaffId?: StaffId;
  readonly createdAt: string;
}

export interface ServiceCareRecord {
  readonly id: ServiceCareRecordId;
  readonly bookingId?: ServiceBookingId;
  readonly membershipId: ServiceMembershipId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly careKind: ServiceCareKind;
  readonly summary: string;
  readonly wardrobeItemId?: WardrobeItemId;
  readonly physicalGarmentId?: PhysicalGarmentId;
  readonly alterationId?: AlterationId;
  readonly recordedByStaffId?: StaffId;
  readonly createdAt: string;
}

export interface ServiceCostRecord {
  readonly id: ServiceCostRecordId;
  readonly bookingId?: ServiceBookingId;
  readonly membershipId: ServiceMembershipId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly label: string;
  readonly amountMinorUnits: number;
  readonly currency: CurrencyCode;
  readonly notes?: string;
  readonly recordedByStaffId?: StaffId;
  readonly createdAt: string;
}

export interface ServiceHistoryEvent {
  readonly id: ServiceHistoryEventId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly membershipId?: ServiceMembershipId;
  readonly bookingId?: ServiceBookingId;
  readonly kind: ServiceHistoryKind;
  readonly summary: string;
  readonly recordedByStaffId?: StaffId;
  readonly createdAt: string;
}

export interface ServiceWeeklyPlanDay {
  readonly id: ServiceWeeklyPlanDayId;
  readonly weeklyPlanId: ServiceWeeklyPlanId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly dayOfWeek: number;
  readonly occasionTag: ServiceWeeklyPlanOccasionTag;
  readonly outfitNotes: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ServiceWeeklyPlan {
  readonly id: ServiceWeeklyPlanId;
  readonly membershipId: ServiceMembershipId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly weekStartDate: string;
  readonly version: number;
  readonly status: ServiceWeeklyPlanStatus;
  readonly advisorNotes?: string;
  readonly declineReason?: string;
  readonly createdByStaffId?: StaffId;
  readonly proposedAt?: string;
  readonly decidedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function canDecideServiceWeeklyPlan(
  status: ServiceWeeklyPlanStatus,
): boolean {
  return status === "proposed";
}

export function canTransitionServiceBooking(
  from: ServiceBookingStatus,
  to: ServiceBookingStatus,
): boolean {
  return SERVICE_BOOKING_STATUS_TRANSITIONS[from].includes(to);
}

export function isBookingKindForService(
  serviceKind: ServiceKind,
  bookingKind: ServiceBookingKind,
): boolean {
  return BOOKING_KINDS_BY_SERVICE[serviceKind].includes(bookingKind);
}

export function entitlementKindForBooking(
  bookingKind: ServiceBookingKind,
): ServiceEntitlementKind | undefined {
  return ENTITLEMENT_FOR_BOOKING[bookingKind];
}

export function recommendedAppointmentType(
  bookingKind: ServiceBookingKind,
): AppointmentType | undefined {
  return APPOINTMENT_TYPE_FOR_BOOKING[bookingKind];
}

export function careRequiresAlterationHandoff(
  careKind: ServiceCareKind,
): boolean {
  return CARE_KINDS_REQUIRING_ALTERATION.includes(careKind);
}

export type ConsumeEntitlementResult =
  | {
      ok: true;
      remainingAfter: number;
      alreadyApplied: boolean;
    }
  | {
      ok: false;
      reason: "insufficient" | "inactive_membership" | "unknown_entitlement";
    };

/**
 * Pure entitlement consumption. Idempotent when `alreadyConsumed` is true
 * for the same idempotency key — returns success without double-debit.
 */
export function evaluateEntitlementConsumption(input: {
  readonly remainingQuantity: number;
  readonly quantity: number;
  readonly membershipActive: boolean;
  readonly alreadyConsumed: boolean;
}): ConsumeEntitlementResult {
  if (input.alreadyConsumed) {
    return {
      ok: true,
      remainingAfter: input.remainingQuantity,
      alreadyApplied: true,
    };
  }
  if (!input.membershipActive) {
    return { ok: false, reason: "inactive_membership" };
  }
  if (input.quantity <= 0) {
    return { ok: false, reason: "unknown_entitlement" };
  }
  if (input.remainingQuantity < input.quantity) {
    return { ok: false, reason: "insufficient" };
  }
  return {
    ok: true,
    remainingAfter: input.remainingQuantity - input.quantity,
    alreadyApplied: false,
  };
}

export function evaluateBookingTransition(input: {
  readonly from: ServiceBookingStatus;
  readonly to: ServiceBookingStatus;
  readonly serviceKind: ServiceKind;
  readonly bookingKind: ServiceBookingKind;
}): { ok: true } | { ok: false; reason: string } {
  if (!isBookingKindForService(input.serviceKind, input.bookingKind)) {
    return {
      ok: false,
      reason: `${input.bookingKind} is not part of ${input.serviceKind}`,
    };
  }
  if (!canTransitionServiceBooking(input.from, input.to)) {
    return {
      ok: false,
      reason: `Cannot move booking from ${input.from} to ${input.to}`,
    };
  }
  return { ok: true };
}

export function defaultEntitlementsForKind(
  kind: ServiceKind,
): readonly { kind: ServiceEntitlementKind; quantity: number }[] {
  return DEFAULT_PLAN_ENTITLEMENTS[kind];
}

export function costAsMoney(record: ServiceCostRecord): Money {
  return {
    amountMinorUnits: record.amountMinorUnits,
    currency: record.currency,
  };
}

export function servicePlanPresentation(plan: ServicePlan): {
  readonly title: string;
  readonly kindLabel: string;
  readonly statusLabel: string;
} {
  return {
    title: plan.title,
    kindLabel: SERVICE_KIND_LABELS[plan.kind],
    statusLabel: plan.status,
  };
}
