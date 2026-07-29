/**
 * Preferred Tailoring and HighMaintenance concierge operations
 * (SERV-001, SERV-002, LONG-001 / PHASE 5.3 / ADR-062).
 *
 * Service plans, entitlements, bookings, and fulfilment are separate from
 * payments. Operational state composes appointments, alterations, and wardrobe
 * without overloading order or alteration statuses.
 */

import type { RetailerRole } from "../identity/role";
import { retailerRoleAtLeast } from "../identity/role";
import type {
  AlterationId,
  AppointmentId,
  ConciergeBookingId,
  ConciergeBookingItemId,
  ConciergeCostRecordId,
  ConciergeEntitlementConsumptionId,
  ConciergeEntitlementId,
  ConciergePlanDefinitionId,
  ConciergeServiceEnrollmentId,
  ConciergeStatusHistoryId,
  CustomerId,
  PhysicalGarmentId,
  RetailerId,
  StaffId,
  WardrobeItemId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

export const CONCIERGE_SERVICE_KINDS = [
  "preferred_tailoring",
  "high_maintenance",
] as const;

export type ConciergeServiceKind = (typeof CONCIERGE_SERVICE_KINDS)[number];

export const CONCIERGE_ENROLLMENT_STATUSES = [
  "draft",
  "active",
  "paused",
  "ended",
] as const;

export type ConciergeEnrollmentStatus =
  (typeof CONCIERGE_ENROLLMENT_STATUSES)[number];

export const CONCIERGE_BOOKING_STATUSES = [
  "requested",
  "scheduled",
  "in_progress",
  "fulfilled",
  "completed",
  "canceled",
] as const;

export type ConciergeBookingStatus =
  (typeof CONCIERGE_BOOKING_STATUSES)[number];

export const CONCIERGE_OPERATION_KINDS = [
  "planning_session",
  "pressing",
  "cleaning",
  "repair",
  "collection",
  "delivery",
  "size_check",
] as const;

export type ConciergeOperationKind = (typeof CONCIERGE_OPERATION_KINDS)[number];

export const CONCIERGE_ENTITLEMENT_KINDS = [
  "planning_sessions",
  "pressing_visits",
  "collection_trips",
  "repair_credits",
] as const;

export type ConciergeEntitlementKind =
  (typeof CONCIERGE_ENTITLEMENT_KINDS)[number];

export const CONCIERGE_BOOKING_TRANSITIONS = [
  "schedule",
  "start",
  "fulfill",
  "complete",
  "cancel",
] as const;

export type ConciergeBookingTransition =
  (typeof CONCIERGE_BOOKING_TRANSITIONS)[number];

export const CONCIERGE_SERVICE_KIND_LABELS: Record<
  ConciergeServiceKind,
  string
> = {
  preferred_tailoring: "Preferred Tailoring",
  high_maintenance: "HighMaintenance",
};

export const CONCIERGE_OPERATION_KIND_LABELS: Record<
  ConciergeOperationKind,
  string
> = {
  planning_session: "Wardrobe planning session",
  pressing: "Shirt pressing",
  cleaning: "Garment cleaning",
  repair: "Repair and mending",
  collection: "Collection",
  delivery: "Delivery",
  size_check: "Size and fit check",
};

/** Default entitlements seeded per service kind. */
export const CONCIERGE_DEFAULT_ENTITLEMENTS: Record<
  ConciergeServiceKind,
  readonly {
    kind: ConciergeEntitlementKind;
    allowance: number;
    label: string;
  }[]
> = {
  preferred_tailoring: [
    {
      kind: "planning_sessions",
      allowance: 4,
      label: "Executive planning sessions per year",
    },
  ],
  high_maintenance: [
    {
      kind: "pressing_visits",
      allowance: 52,
      label: "Weekly pressing visits",
    },
    {
      kind: "collection_trips",
      allowance: 26,
      label: "Collection and delivery trips",
    },
    {
      kind: "repair_credits",
      allowance: 6,
      label: "Repair credits",
    },
  ],
};

export interface ConciergePlanDefinition extends Timestamps {
  readonly id: ConciergePlanDefinitionId;
  readonly retailerId: RetailerId;
  readonly serviceKind: ConciergeServiceKind;
  readonly label: string;
  readonly summary: string;
  readonly active: boolean;
}

export interface ConciergeServiceEnrollment extends Timestamps {
  readonly id: ConciergeServiceEnrollmentId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly planDefinitionId: ConciergePlanDefinitionId;
  readonly serviceKind: ConciergeServiceKind;
  readonly status: ConciergeEnrollmentStatus;
  readonly advisorStaffId?: StaffId;
  readonly commitmentNote?: string;
  readonly startedAt?: string;
  readonly endedAt?: string;
}

export interface ConciergeEntitlement extends Timestamps {
  readonly id: ConciergeEntitlementId;
  readonly enrollmentId: ConciergeServiceEnrollmentId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly kind: ConciergeEntitlementKind;
  readonly label: string;
  readonly allowance: number;
  readonly consumed: number;
}

export interface ConciergeEntitlementConsumption {
  readonly id: ConciergeEntitlementConsumptionId;
  readonly entitlementId: ConciergeEntitlementId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly bookingId: ConciergeBookingId;
  readonly idempotencyKey: string;
  readonly units: number;
  readonly consumedAt: string;
}

export interface ConciergeServiceBooking extends Timestamps {
  readonly id: ConciergeBookingId;
  readonly enrollmentId: ConciergeServiceEnrollmentId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly serviceKind: ConciergeServiceKind;
  readonly status: ConciergeBookingStatus;
  readonly title: string;
  readonly notes?: string;
  readonly scheduledAt?: string;
  readonly advisorStaffId?: StaffId;
  readonly appointmentId?: AppointmentId;
  readonly alterationId?: AlterationId;
  readonly physicalGarmentId?: PhysicalGarmentId;
  readonly wardrobeItemId?: WardrobeItemId;
}

export interface ConciergeBookingItem {
  readonly id: ConciergeBookingItemId;
  readonly bookingId: ConciergeBookingId;
  readonly retailerId: RetailerId;
  readonly operationKind: ConciergeOperationKind;
  readonly label: string;
  readonly notes?: string;
  readonly wardrobeItemId?: WardrobeItemId;
  readonly physicalGarmentId?: PhysicalGarmentId;
}

export interface ConciergeStatusHistoryEntry {
  readonly id: ConciergeStatusHistoryId;
  readonly bookingId: ConciergeBookingId;
  readonly retailerId: RetailerId;
  readonly fromStatus?: ConciergeBookingStatus;
  readonly toStatus: ConciergeBookingStatus;
  readonly actorKind: "customer" | "advisor" | "system";
  readonly actorStaffId?: StaffId;
  readonly note?: string;
  readonly recordedAt: string;
}

export interface ConciergeCostRecord {
  readonly id: ConciergeCostRecordId;
  readonly bookingId: ConciergeBookingId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly amountMinor: number;
  readonly currency: string;
  readonly description: string;
  readonly recordedAt: string;
  readonly recordedByStaffId?: StaffId;
}

export type ConciergeTransitionIssue =
  | "invalid_from_status"
  | "advisor_only"
  | "customer_only"
  | "cross_tenant"
  | "enrollment_inactive"
  | "missing_schedule_time"
  | "entitlement_exhausted";

const BOOKING_TRANSITION_TARGETS: Record<
  ConciergeBookingTransition,
  ConciergeBookingStatus
> = {
  schedule: "scheduled",
  start: "in_progress",
  fulfill: "fulfilled",
  complete: "completed",
  cancel: "canceled",
};

const VALID_FROM_STATUSES: Record<
  ConciergeBookingTransition,
  readonly ConciergeBookingStatus[]
> = {
  schedule: ["requested"],
  start: ["scheduled"],
  fulfill: ["in_progress"],
  complete: ["fulfilled"],
  cancel: ["requested", "scheduled", "in_progress", "fulfilled"],
};

export function bookingTransitionTarget(
  transition: ConciergeBookingTransition,
): ConciergeBookingStatus {
  return BOOKING_TRANSITION_TARGETS[transition];
}

export function conciergeBookingTransitionIssues(params: {
  readonly transition: ConciergeBookingTransition;
  readonly currentStatus: ConciergeBookingStatus;
  readonly enrollmentStatus: ConciergeEnrollmentStatus;
  readonly bookingRetailerId: RetailerId;
  readonly bookingCustomerId: CustomerId;
  readonly scheduledAt?: string;
  readonly actor:
    | {
        readonly kind: "customer";
        readonly customerId: CustomerId;
        readonly retailerId: RetailerId;
      }
    | {
        readonly kind: "advisor";
        readonly retailerId: RetailerId;
        readonly role: RetailerRole;
      };
}): readonly ConciergeTransitionIssue[] {
  const issues: ConciergeTransitionIssue[] = [];

  if (
    params.bookingRetailerId !== params.actor.retailerId ||
    (params.actor.kind === "customer" &&
      params.bookingCustomerId !== params.actor.customerId)
  ) {
    issues.push("cross_tenant");
  }

  if (params.enrollmentStatus !== "active" && params.transition !== "cancel") {
    issues.push("enrollment_inactive");
  }

  if (!VALID_FROM_STATUSES[params.transition].includes(params.currentStatus)) {
    issues.push("invalid_from_status");
  }

  if (params.transition === "schedule" && !params.scheduledAt) {
    issues.push("missing_schedule_time");
  }

  const advisorOnly: readonly ConciergeBookingTransition[] = [
    "schedule",
    "start",
    "fulfill",
    "complete",
  ];
  const customerAllowed: readonly ConciergeBookingTransition[] = [
    "cancel",
    "complete",
  ];

  if (
    params.actor.kind === "customer" &&
    !customerAllowed.includes(params.transition)
  ) {
    issues.push("customer_only");
  }

  if (
    params.actor.kind === "advisor" &&
    advisorOnly.includes(params.transition) &&
    !retailerRoleAtLeast(params.actor.role, "sales_associate")
  ) {
    issues.push("advisor_only");
  }

  return issues;
}

/** Maps operation kinds to entitlement consumption for idempotent debits. */
export function entitlementKindForOperation(
  operationKind: ConciergeOperationKind,
): ConciergeEntitlementKind | null {
  switch (operationKind) {
    case "planning_session":
      return "planning_sessions";
    case "pressing":
    case "cleaning":
      return "pressing_visits";
    case "collection":
    case "delivery":
      return "collection_trips";
    case "repair":
      return "repair_credits";
    case "size_check":
      return null;
    default: {
      const _exhaustive: never = operationKind;
      return _exhaustive;
    }
  }
}

export function canConsumeEntitlement(params: {
  readonly entitlement: Pick<
    ConciergeEntitlement,
    "allowance" | "consumed" | "kind"
  >;
  readonly operationKind: ConciergeOperationKind;
  readonly units?: number;
}): boolean {
  const kind = entitlementKindForOperation(params.operationKind);
  if (!kind || kind !== params.entitlement.kind) return false;
  const units = params.units ?? 1;
  return params.entitlement.consumed + units <= params.entitlement.allowance;
}

export type ConciergeHandoffKind = "appointment" | "alteration" | "none";

/** Determines which existing aggregate a booking should compose. */
export function resolveServiceHandoff(params: {
  readonly serviceKind: ConciergeServiceKind;
  readonly operationKinds: readonly ConciergeOperationKind[];
}): ConciergeHandoffKind {
  if (params.serviceKind === "preferred_tailoring") {
    return params.operationKinds.includes("planning_session")
      ? "appointment"
      : "none";
  }
  if (
    params.operationKinds.some((kind) =>
      (["repair", "pressing", "cleaning"] as const).includes(
        kind as "repair" | "pressing" | "cleaning",
      ),
    )
  ) {
    return "alteration";
  }
  return "none";
}

export function operationsForServiceKind(
  serviceKind: ConciergeServiceKind,
): readonly ConciergeOperationKind[] {
  if (serviceKind === "preferred_tailoring") {
    return ["planning_session", "size_check"];
  }
  return [
    "pressing",
    "cleaning",
    "repair",
    "collection",
    "delivery",
    "size_check",
  ];
}

export function bookingStatusLabel(status: ConciergeBookingStatus): string {
  switch (status) {
    case "requested":
      return "Requested";
    case "scheduled":
      return "Scheduled";
    case "in_progress":
      return "In progress";
    case "fulfilled":
      return "Fulfilled";
    case "completed":
      return "Completed";
    case "canceled":
      return "Canceled";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
