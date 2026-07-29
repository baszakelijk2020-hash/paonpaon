/**
 * Preferred Tailoring / HighMaintenance concierge repository (PHASE 5.3).
 */

import {
  asId,
  type AssignServiceAdvisorInput,
  type EnrollServiceMembershipInput,
  type GrantServiceEntitlementInput,
  type LinkServiceBookingAppointmentInput,
  type RecordServiceCareInput,
  type RecordServiceCostInput,
  type RecordServiceFulfilmentInput,
  type RequestServiceBookingInput,
  type ServiceBooking,
  type ServiceBookingKind,
  type ServiceBookingStatus,
  type ServiceCareKind,
  type ServiceCareRecord,
  type ServiceCostRecord,
  type ServiceEntitlement,
  type ServiceEntitlementEntry,
  type ServiceEntitlementEntryKind,
  type ServiceEntitlementKind,
  type ServiceFulfilmentEvent,
  type ServiceFulfilmentMethod,
  type ServiceFulfilmentStatus,
  type ServiceHistoryEvent,
  type ServiceHistoryKind,
  type ServiceKind,
  type ServiceMembership,
  type ServiceMembershipStatus,
  type ServicePlan,
  type ServicePlanId,
  type ServicePlanStatus,
  type SetServiceMembershipStatusInput,
  type TransitionServiceBookingInput,
  type UpsertServicePlanInput,
  type CurrencyCode,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type PlanRow = Database["public"]["Tables"]["service_plans"]["Row"];
type MembershipRow = Database["public"]["Tables"]["service_memberships"]["Row"];
type EntitlementRow =
  Database["public"]["Tables"]["service_entitlements"]["Row"];
type EntryRow =
  Database["public"]["Tables"]["service_entitlement_entries"]["Row"];
type BookingRow = Database["public"]["Tables"]["service_bookings"]["Row"];
type FulfilmentRow =
  Database["public"]["Tables"]["service_fulfilment_events"]["Row"];
type CareRow = Database["public"]["Tables"]["service_care_records"]["Row"];
type CostRow = Database["public"]["Tables"]["service_cost_records"]["Row"];
type HistoryRow = Database["public"]["Tables"]["service_history_events"]["Row"];

function toPlan(row: PlanRow): ServicePlan {
  return {
    id: asId<"ServicePlanId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    kind: row.kind as ServiceKind,
    status: row.status as ServicePlanStatus,
    title: row.title,
    summary: row.summary,
    explanation: row.explanation,
    ...(row.created_by_staff_id
      ? { createdByStaffId: asId<"StaffId">(row.created_by_staff_id) }
      : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toMembership(row: MembershipRow): ServiceMembership {
  return {
    id: asId<"ServiceMembershipId">(row.id),
    planId: asId<"ServicePlanId">(row.plan_id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    ...(row.advisor_staff_id
      ? { advisorStaffId: asId<"StaffId">(row.advisor_staff_id) }
      : {}),
    status: row.status as ServiceMembershipStatus,
    ...(row.commitment_notes ? { commitmentNotes: row.commitment_notes } : {}),
    startedAt: row.started_at,
    ...(row.ended_at ? { endedAt: row.ended_at } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toEntitlement(row: EntitlementRow): ServiceEntitlement {
  return {
    id: asId<"ServiceEntitlementId">(row.id),
    membershipId: asId<"ServiceMembershipId">(row.membership_id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    kind: row.kind as ServiceEntitlementKind,
    remainingQuantity: row.remaining_quantity,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toEntry(row: EntryRow): ServiceEntitlementEntry {
  return {
    id: asId<"ServiceEntitlementEntryId">(row.id),
    entitlementId: asId<"ServiceEntitlementId">(row.entitlement_id),
    membershipId: asId<"ServiceMembershipId">(row.membership_id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    entryKind: row.entry_kind as ServiceEntitlementEntryKind,
    quantity: row.quantity,
    idempotencyKey: row.idempotency_key,
    ...(row.booking_id
      ? { bookingId: asId<"ServiceBookingId">(row.booking_id) }
      : {}),
    ...(row.notes ? { notes: row.notes } : {}),
    ...(row.created_by_staff_id
      ? { createdByStaffId: asId<"StaffId">(row.created_by_staff_id) }
      : {}),
    createdAt: row.created_at,
  };
}

function toBooking(row: BookingRow): ServiceBooking {
  return {
    id: asId<"ServiceBookingId">(row.id),
    membershipId: asId<"ServiceMembershipId">(row.membership_id),
    planId: asId<"ServicePlanId">(row.plan_id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    ...(row.advisor_staff_id
      ? { advisorStaffId: asId<"StaffId">(row.advisor_staff_id) }
      : {}),
    kind: row.kind as ServiceBookingKind,
    status: row.status as ServiceBookingStatus,
    ...(row.requested_for ? { requestedFor: row.requested_for } : {}),
    ...(row.notes ? { notes: row.notes } : {}),
    ...(row.commitment_notes ? { commitmentNotes: row.commitment_notes } : {}),
    ...(row.appointment_id
      ? { appointmentId: asId<"AppointmentId">(row.appointment_id) }
      : {}),
    ...(row.entitlement_entry_id
      ? {
          entitlementEntryId: asId<"ServiceEntitlementEntryId">(
            row.entitlement_entry_id,
          ),
        }
      : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toFulfilment(row: FulfilmentRow): ServiceFulfilmentEvent {
  return {
    id: asId<"ServiceFulfilmentEventId">(row.id),
    bookingId: asId<"ServiceBookingId">(row.booking_id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    method: row.method as ServiceFulfilmentMethod,
    status: row.status as ServiceFulfilmentStatus,
    ...(row.scheduled_for ? { scheduledFor: row.scheduled_for } : {}),
    ...(row.notes ? { notes: row.notes } : {}),
    ...(row.recorded_by_staff_id
      ? { recordedByStaffId: asId<"StaffId">(row.recorded_by_staff_id) }
      : {}),
    createdAt: row.created_at,
  };
}

function toCare(row: CareRow): ServiceCareRecord {
  return {
    id: asId<"ServiceCareRecordId">(row.id),
    ...(row.booking_id
      ? { bookingId: asId<"ServiceBookingId">(row.booking_id) }
      : {}),
    membershipId: asId<"ServiceMembershipId">(row.membership_id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    careKind: row.care_kind as ServiceCareKind,
    summary: row.summary,
    ...(row.wardrobe_item_id
      ? { wardrobeItemId: asId<"WardrobeItemId">(row.wardrobe_item_id) }
      : {}),
    ...(row.physical_garment_id
      ? {
          physicalGarmentId: asId<"PhysicalGarmentId">(row.physical_garment_id),
        }
      : {}),
    ...(row.alteration_id
      ? { alterationId: asId<"AlterationId">(row.alteration_id) }
      : {}),
    ...(row.recorded_by_staff_id
      ? { recordedByStaffId: asId<"StaffId">(row.recorded_by_staff_id) }
      : {}),
    createdAt: row.created_at,
  };
}

function toCost(row: CostRow): ServiceCostRecord {
  return {
    id: asId<"ServiceCostRecordId">(row.id),
    ...(row.booking_id
      ? { bookingId: asId<"ServiceBookingId">(row.booking_id) }
      : {}),
    membershipId: asId<"ServiceMembershipId">(row.membership_id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    label: row.label,
    amountMinorUnits: row.amount_minor_units,
    currency: row.currency as CurrencyCode,
    ...(row.notes ? { notes: row.notes } : {}),
    ...(row.recorded_by_staff_id
      ? { recordedByStaffId: asId<"StaffId">(row.recorded_by_staff_id) }
      : {}),
    createdAt: row.created_at,
  };
}

function toHistory(row: HistoryRow): ServiceHistoryEvent {
  return {
    id: asId<"ServiceHistoryEventId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    ...(row.membership_id
      ? { membershipId: asId<"ServiceMembershipId">(row.membership_id) }
      : {}),
    ...(row.booking_id
      ? { bookingId: asId<"ServiceBookingId">(row.booking_id) }
      : {}),
    kind: row.kind as ServiceHistoryKind,
    summary: row.summary,
    ...(row.recorded_by_staff_id
      ? { recordedByStaffId: asId<"StaffId">(row.recorded_by_staff_id) }
      : {}),
    createdAt: row.created_at,
  };
}

export class ServicePlanRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async listPlansByRetailer(retailerId: string): Promise<ServicePlan[]> {
    const { data, error } = await this.client
      .from("service_plans")
      .select("*")
      .eq("retailer_id", retailerId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data.map(toPlan);
  }

  async listActivePlansByRetailer(retailerId: string): Promise<ServicePlan[]> {
    const { data, error } = await this.client
      .from("service_plans")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("status", "active")
      .order("kind", { ascending: true });
    if (error) throw error;
    return data.map(toPlan);
  }

  async findPlanById(planId: string): Promise<ServicePlan | null> {
    const { data, error } = await this.client
      .from("service_plans")
      .select("*")
      .eq("id", planId)
      .maybeSingle();
    if (error) throw error;
    return data ? toPlan(data) : null;
  }

  async upsertPlan(
    retailerId: string,
    input: UpsertServicePlanInput,
    staffId?: string,
  ): Promise<ServicePlanId> {
    const payload = {
      retailer_id: retailerId,
      kind: input.kind,
      status: input.status,
      title: input.title,
      summary: input.summary,
      explanation: input.explanation,
      ...(staffId ? { created_by_staff_id: staffId } : {}),
    };
    if (input.planId) {
      const { data, error } = await this.client
        .from("service_plans")
        .update(payload)
        .eq("id", input.planId)
        .eq("retailer_id", retailerId)
        .select("id")
        .single();
      if (error) throw error;
      return asId<"ServicePlanId">(data.id);
    }
    const { data, error } = await this.client
      .from("service_plans")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    return asId<"ServicePlanId">(data.id);
  }

  async setPlanStatus(
    retailerId: string,
    planId: string,
    status: ServicePlanStatus,
  ): Promise<void> {
    const { error } = await this.client
      .from("service_plans")
      .update({ status })
      .eq("id", planId)
      .eq("retailer_id", retailerId);
    if (error) throw error;
  }

  async listMembershipsByRetailer(
    retailerId: string,
  ): Promise<ServiceMembership[]> {
    const { data, error } = await this.client
      .from("service_memberships")
      .select("*")
      .eq("retailer_id", retailerId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data.map(toMembership);
  }

  async listMembershipsForCustomer(
    customerId: string,
  ): Promise<ServiceMembership[]> {
    const { data, error } = await this.client
      .from("service_memberships")
      .select("*")
      .eq("customer_id", customerId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data.map(toMembership);
  }

  async findMembershipById(
    membershipId: string,
  ): Promise<ServiceMembership | null> {
    const { data, error } = await this.client
      .from("service_memberships")
      .select("*")
      .eq("id", membershipId)
      .maybeSingle();
    if (error) throw error;
    return data ? toMembership(data) : null;
  }

  async enrollMembership(input: EnrollServiceMembershipInput): Promise<string> {
    const { data, error } = await this.client.rpc("enroll_service_membership", {
      p_plan_id: input.planId,
      p_customer_id: input.customerId,
      p_seed_default_entitlements: input.seedDefaultEntitlements,
      ...(input.advisorStaffId
        ? { p_advisor_staff_id: input.advisorStaffId }
        : {}),
      ...(input.commitmentNotes
        ? { p_commitment_notes: input.commitmentNotes }
        : {}),
    });
    if (error) throw error;
    return data;
  }

  async setMembershipStatus(
    input: SetServiceMembershipStatusInput,
  ): Promise<void> {
    const { error } = await this.client.rpc("set_service_membership_status", {
      p_membership_id: input.membershipId,
      p_status: input.status,
    });
    if (error) throw error;
  }

  async assignAdvisor(input: AssignServiceAdvisorInput): Promise<void> {
    const { error } = await this.client.rpc("assign_service_advisor", {
      p_membership_id: input.membershipId,
      p_advisor_staff_id: input.advisorStaffId,
    });
    if (error) throw error;
  }

  async listEntitlementsForMembership(
    membershipId: string,
  ): Promise<ServiceEntitlement[]> {
    const { data, error } = await this.client
      .from("service_entitlements")
      .select("*")
      .eq("membership_id", membershipId)
      .order("kind", { ascending: true });
    if (error) throw error;
    return data.map(toEntitlement);
  }

  async listEntitlementEntriesForMembership(
    membershipId: string,
  ): Promise<ServiceEntitlementEntry[]> {
    const { data, error } = await this.client
      .from("service_entitlement_entries")
      .select("*")
      .eq("membership_id", membershipId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toEntry);
  }

  async grantEntitlement(input: GrantServiceEntitlementInput): Promise<string> {
    const { data, error } = await this.client.rpc("grant_service_entitlement", {
      p_membership_id: input.membershipId,
      p_kind: input.kind,
      p_quantity: input.quantity,
      p_idempotency_key: input.idempotencyKey,
      ...(input.notes ? { p_notes: input.notes } : {}),
    });
    if (error) throw error;
    return data;
  }

  async listBookingsForMembership(
    membershipId: string,
  ): Promise<ServiceBooking[]> {
    const { data, error } = await this.client
      .from("service_bookings")
      .select("*")
      .eq("membership_id", membershipId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toBooking);
  }

  async listBookingsForCustomer(customerId: string): Promise<ServiceBooking[]> {
    const { data, error } = await this.client
      .from("service_bookings")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toBooking);
  }

  async listBookingsByRetailer(retailerId: string): Promise<ServiceBooking[]> {
    const { data, error } = await this.client
      .from("service_bookings")
      .select("*")
      .eq("retailer_id", retailerId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data.map(toBooking);
  }

  async requestBooking(input: RequestServiceBookingInput): Promise<string> {
    const { data, error } = await this.client.rpc("request_service_booking", {
      p_membership_id: input.membershipId,
      p_kind: input.kind,
      p_idempotency_key: input.idempotencyKey,
      ...(input.requestedFor ? { p_requested_for: input.requestedFor } : {}),
      ...(input.notes ? { p_notes: input.notes } : {}),
    });
    if (error) throw error;
    return data;
  }

  async transitionBooking(
    input: TransitionServiceBookingInput,
  ): Promise<string> {
    const { data, error } = await this.client.rpc(
      "transition_service_booking",
      {
        p_booking_id: input.bookingId,
        p_status: input.status,
        p_consume_entitlement: input.consumeEntitlement,
        ...(input.commitmentNotes
          ? { p_commitment_notes: input.commitmentNotes }
          : {}),
      },
    );
    if (error) throw error;
    return data;
  }

  async linkAppointment(
    input: LinkServiceBookingAppointmentInput,
  ): Promise<void> {
    const { error } = await this.client.rpc(
      "link_service_booking_appointment",
      {
        p_booking_id: input.bookingId,
        p_appointment_id: input.appointmentId,
      },
    );
    if (error) throw error;
  }

  async recordFulfilment(input: RecordServiceFulfilmentInput): Promise<string> {
    const { data, error } = await this.client.rpc("record_service_fulfilment", {
      p_booking_id: input.bookingId,
      p_method: input.method,
      p_status: input.status,
      ...(input.scheduledFor ? { p_scheduled_for: input.scheduledFor } : {}),
      ...(input.notes ? { p_notes: input.notes } : {}),
    });
    if (error) throw error;
    return data;
  }

  async listFulfilmentForBooking(
    bookingId: string,
  ): Promise<ServiceFulfilmentEvent[]> {
    const { data, error } = await this.client
      .from("service_fulfilment_events")
      .select("*")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toFulfilment);
  }

  async recordCare(input: RecordServiceCareInput): Promise<string> {
    const { data, error } = await this.client.rpc("record_service_care", {
      p_membership_id: input.membershipId,
      p_care_kind: input.careKind,
      p_summary: input.summary,
      ...(input.bookingId ? { p_booking_id: input.bookingId } : {}),
      ...(input.wardrobeItemId
        ? { p_wardrobe_item_id: input.wardrobeItemId }
        : {}),
      ...(input.physicalGarmentId
        ? { p_physical_garment_id: input.physicalGarmentId }
        : {}),
      ...(input.alterationId ? { p_alteration_id: input.alterationId } : {}),
    });
    if (error) throw error;
    return data;
  }

  async listCareForMembership(
    membershipId: string,
  ): Promise<ServiceCareRecord[]> {
    const { data, error } = await this.client
      .from("service_care_records")
      .select("*")
      .eq("membership_id", membershipId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toCare);
  }

  async recordCost(input: RecordServiceCostInput): Promise<string> {
    const { data, error } = await this.client.rpc("record_service_cost", {
      p_membership_id: input.membershipId,
      p_label: input.label,
      p_amount_minor_units: input.amountMinorUnits,
      p_currency: input.currency,
      ...(input.bookingId ? { p_booking_id: input.bookingId } : {}),
      ...(input.notes ? { p_notes: input.notes } : {}),
    });
    if (error) throw error;
    return data;
  }

  async listCostsForMembership(
    membershipId: string,
  ): Promise<ServiceCostRecord[]> {
    const { data, error } = await this.client
      .from("service_cost_records")
      .select("*")
      .eq("membership_id", membershipId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toCost);
  }

  async listHistoryForCustomer(
    customerId: string,
  ): Promise<ServiceHistoryEvent[]> {
    const { data, error } = await this.client
      .from("service_history_events")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data.map(toHistory);
  }

  async listHistoryForMembership(
    membershipId: string,
  ): Promise<ServiceHistoryEvent[]> {
    const { data, error } = await this.client
      .from("service_history_events")
      .select("*")
      .eq("membership_id", membershipId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data.map(toHistory);
  }
}
