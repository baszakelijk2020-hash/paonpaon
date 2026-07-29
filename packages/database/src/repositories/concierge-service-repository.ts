/**
 * Preferred Tailoring and HighMaintenance concierge operations (PHASE 5.3).
 */

import {
  asId,
  type ConciergeBookingId,
  type ConciergeBookingItem,
  type ConciergeBookingStatus,
  type ConciergeCostRecord,
  type ConciergeEntitlement,
  type ConciergeOperationKind,
  type ConciergePlanDefinition,
  type ConciergeServiceBooking,
  type ConciergeServiceEnrollment,
  type ConciergeServiceKind,
  type ConciergeStatusHistoryEntry,
  type EnrollConciergeServiceInput,
  type RecordConciergeCostInput,
  type RequestConciergeBookingInput,
  type TransitionConciergeBookingInput,
  type UpsertConciergePlanDefinitionInput,
  CONCIERGE_OPERATION_KIND_LABELS,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

type PlanRow =
  Database["public"]["Tables"]["concierge_service_plan_definitions"]["Row"];
type EnrollmentRow =
  Database["public"]["Tables"]["concierge_service_enrollments"]["Row"];
type EntitlementRow =
  Database["public"]["Tables"]["concierge_service_entitlements"]["Row"];
type BookingRow =
  Database["public"]["Tables"]["concierge_service_bookings"]["Row"];
type BookingItemRow =
  Database["public"]["Tables"]["concierge_service_booking_items"]["Row"];
type HistoryRow =
  Database["public"]["Tables"]["concierge_service_status_history"]["Row"];
type CostRow =
  Database["public"]["Tables"]["concierge_service_cost_records"]["Row"];

function toPlan(row: PlanRow): ConciergePlanDefinition {
  return {
    id: asId<"ConciergePlanDefinitionId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    serviceKind: row.service_kind as ConciergeServiceKind,
    label: row.label,
    summary: row.summary,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toEnrollment(row: EnrollmentRow): ConciergeServiceEnrollment {
  return {
    id: asId<"ConciergeServiceEnrollmentId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    planDefinitionId: asId<"ConciergePlanDefinitionId">(row.plan_definition_id),
    serviceKind: row.service_kind as ConciergeServiceKind,
    status: row.status as ConciergeServiceEnrollment["status"],
    ...(row.advisor_staff_id
      ? { advisorStaffId: asId<"StaffId">(row.advisor_staff_id) }
      : {}),
    ...(row.commitment_note ? { commitmentNote: row.commitment_note } : {}),
    ...(row.started_at ? { startedAt: row.started_at } : {}),
    ...(row.ended_at ? { endedAt: row.ended_at } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toEntitlement(row: EntitlementRow): ConciergeEntitlement {
  return {
    id: asId<"ConciergeEntitlementId">(row.id),
    enrollmentId: asId<"ConciergeServiceEnrollmentId">(row.enrollment_id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    kind: row.kind as ConciergeEntitlement["kind"],
    label: row.label,
    allowance: row.allowance,
    consumed: row.consumed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toBooking(row: BookingRow): ConciergeServiceBooking {
  return {
    id: asId<"ConciergeBookingId">(row.id),
    enrollmentId: asId<"ConciergeServiceEnrollmentId">(row.enrollment_id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    serviceKind: row.service_kind as ConciergeServiceKind,
    status: row.status as ConciergeBookingStatus,
    title: row.title,
    ...(row.notes ? { notes: row.notes } : {}),
    ...(row.scheduled_at ? { scheduledAt: row.scheduled_at } : {}),
    ...(row.advisor_staff_id
      ? { advisorStaffId: asId<"StaffId">(row.advisor_staff_id) }
      : {}),
    ...(row.appointment_id
      ? { appointmentId: asId<"AppointmentId">(row.appointment_id) }
      : {}),
    ...(row.alteration_id
      ? { alterationId: asId<"AlterationId">(row.alteration_id) }
      : {}),
    ...(row.physical_garment_id
      ? {
          physicalGarmentId: asId<"PhysicalGarmentId">(row.physical_garment_id),
        }
      : {}),
    ...(row.wardrobe_item_id
      ? { wardrobeItemId: asId<"WardrobeItemId">(row.wardrobe_item_id) }
      : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toBookingItem(row: BookingItemRow): ConciergeBookingItem {
  return {
    id: asId<"ConciergeBookingItemId">(row.id),
    bookingId: asId<"ConciergeBookingId">(row.booking_id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    operationKind: row.operation_kind as ConciergeOperationKind,
    label: row.label,
    ...(row.notes ? { notes: row.notes } : {}),
    ...(row.wardrobe_item_id
      ? { wardrobeItemId: asId<"WardrobeItemId">(row.wardrobe_item_id) }
      : {}),
    ...(row.physical_garment_id
      ? {
          physicalGarmentId: asId<"PhysicalGarmentId">(row.physical_garment_id),
        }
      : {}),
  };
}

function toHistory(row: HistoryRow): ConciergeStatusHistoryEntry {
  return {
    id: asId<"ConciergeStatusHistoryId">(row.id),
    bookingId: asId<"ConciergeBookingId">(row.booking_id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    ...(row.from_status
      ? { fromStatus: row.from_status as ConciergeBookingStatus }
      : {}),
    toStatus: row.to_status as ConciergeBookingStatus,
    actorKind: row.actor_kind as ConciergeStatusHistoryEntry["actorKind"],
    ...(row.actor_staff_id
      ? { actorStaffId: asId<"StaffId">(row.actor_staff_id) }
      : {}),
    ...(row.note ? { note: row.note } : {}),
    recordedAt: row.recorded_at,
  };
}

function toCost(row: CostRow): ConciergeCostRecord {
  return {
    id: asId<"ConciergeCostRecordId">(row.id),
    bookingId: asId<"ConciergeBookingId">(row.booking_id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    amountMinor: row.amount_minor,
    currency: row.currency,
    description: row.description,
    recordedAt: row.recorded_at,
    ...(row.recorded_by_staff_id
      ? { recordedByStaffId: asId<"StaffId">(row.recorded_by_staff_id) }
      : {}),
  };
}

export class ConciergeServiceRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async ensurePlanDefinitions(retailerId: string): Promise<void> {
    const { error } = await this.client.rpc(
      "ensure_concierge_service_plan_definitions",
      { p_retailer_id: retailerId },
    );
    if (error) throw error;
  }

  async listPlanDefinitions(
    retailerId: string,
  ): Promise<ConciergePlanDefinition[]> {
    const { data, error } = await this.client
      .from("concierge_service_plan_definitions")
      .select("*")
      .eq("retailer_id", retailerId)
      .order("service_kind", { ascending: true });
    if (error) throw error;
    return data.map(toPlan);
  }

  async upsertPlanDefinition(
    retailerId: string,
    input: UpsertConciergePlanDefinitionInput,
  ): Promise<string> {
    const payload = {
      retailer_id: retailerId,
      service_kind: input.serviceKind,
      label: input.label,
      summary: input.summary,
      active: input.active,
    };

    if (input.planDefinitionId) {
      const { data, error } = await this.client
        .from("concierge_service_plan_definitions")
        .update(payload)
        .eq("id", input.planDefinitionId)
        .eq("retailer_id", retailerId)
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    }

    const { data, error } = await this.client
      .from("concierge_service_plan_definitions")
      .upsert(payload, { onConflict: "retailer_id,service_kind" })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }

  async listEnrollmentsByCustomer(
    customerId: string,
  ): Promise<ConciergeServiceEnrollment[]> {
    const { data, error } = await this.client
      .from("concierge_service_enrollments")
      .select("*")
      .eq("customer_id", customerId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data.map(toEnrollment);
  }

  async listEnrollmentsByRetailer(
    retailerId: string,
  ): Promise<ConciergeServiceEnrollment[]> {
    const { data, error } = await this.client
      .from("concierge_service_enrollments")
      .select("*")
      .eq("retailer_id", retailerId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data.map(toEnrollment);
  }

  async findEnrollmentById(
    enrollmentId: string,
  ): Promise<ConciergeServiceEnrollment | null> {
    const { data, error } = await this.client
      .from("concierge_service_enrollments")
      .select("*")
      .eq("id", enrollmentId)
      .maybeSingle();
    if (error) throw error;
    return data ? toEnrollment(data) : null;
  }

  async listEntitlementsForEnrollment(
    enrollmentId: string,
  ): Promise<ConciergeEntitlement[]> {
    const { data, error } = await this.client
      .from("concierge_service_entitlements")
      .select("*")
      .eq("enrollment_id", enrollmentId)
      .order("kind", { ascending: true });
    if (error) throw error;
    return data.map(toEntitlement);
  }

  async enrollService(
    retailerId: string,
    input: EnrollConciergeServiceInput,
  ): Promise<string> {
    const { data, error } = await this.client.rpc("enroll_concierge_service", {
      p_retailer_id: retailerId,
      p_customer_id: input.customerId,
      p_plan_definition_id: input.planDefinitionId,
      ...(input.advisorStaffId
        ? { p_advisor_staff_id: input.advisorStaffId }
        : {}),
      ...(input.commitmentNote
        ? { p_commitment_note: input.commitmentNote }
        : {}),
      p_status: input.status,
    });
    if (error) throw error;
    return String(data);
  }

  async listBookingsByCustomer(
    customerId: string,
  ): Promise<ConciergeServiceBooking[]> {
    const { data, error } = await this.client
      .from("concierge_service_bookings")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toBooking);
  }

  async listBookingsByRetailer(
    retailerId: string,
  ): Promise<ConciergeServiceBooking[]> {
    const { data, error } = await this.client
      .from("concierge_service_bookings")
      .select("*")
      .eq("retailer_id", retailerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toBooking);
  }

  async findBookingById(
    bookingId: string,
  ): Promise<ConciergeServiceBooking | null> {
    const { data, error } = await this.client
      .from("concierge_service_bookings")
      .select("*")
      .eq("id", bookingId)
      .maybeSingle();
    if (error) throw error;
    return data ? toBooking(data) : null;
  }

  async listBookingItems(bookingId: string): Promise<ConciergeBookingItem[]> {
    const { data, error } = await this.client
      .from("concierge_service_booking_items")
      .select("*")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data.map(toBookingItem);
  }

  async listStatusHistory(
    bookingId: string,
  ): Promise<ConciergeStatusHistoryEntry[]> {
    const { data, error } = await this.client
      .from("concierge_service_status_history")
      .select("*")
      .eq("booking_id", bookingId)
      .order("recorded_at", { ascending: true });
    if (error) throw error;
    return data.map(toHistory);
  }

  async listCostRecords(bookingId: string): Promise<ConciergeCostRecord[]> {
    const { data, error } = await this.client
      .from("concierge_service_cost_records")
      .select("*")
      .eq("booking_id", bookingId)
      .order("recorded_at", { ascending: true });
    if (error) throw error;
    return data.map(toCost);
  }

  async requestBooking(
    input: RequestConciergeBookingInput,
  ): Promise<ConciergeBookingId> {
    const operations = input.operations.map((op) => ({
      operationKind: op.operationKind,
      label:
        op.label ??
        CONCIERGE_OPERATION_KIND_LABELS[
          op.operationKind as ConciergeOperationKind
        ],
      notes: op.notes,
      wardrobeItemId: op.wardrobeItemId,
      physicalGarmentId: op.physicalGarmentId,
    }));

    const { data, error } = await this.client.rpc(
      "request_concierge_service_booking",
      {
        p_enrollment_id: input.enrollmentId,
        p_title: input.title,
        ...(input.notes ? { p_notes: input.notes } : {}),
        ...(input.wardrobeItemId
          ? { p_wardrobe_item_id: input.wardrobeItemId }
          : {}),
        ...(input.physicalGarmentId
          ? { p_physical_garment_id: input.physicalGarmentId }
          : {}),
        p_operations: operations as unknown as Json,
      },
    );
    if (error) throw error;
    return asId<"ConciergeBookingId">(String(data));
  }

  async transitionBooking(
    input: TransitionConciergeBookingInput,
  ): Promise<ConciergeBookingStatus> {
    const { data, error } = await this.client.rpc(
      "transition_concierge_service_booking",
      {
        p_booking_id: input.bookingId,
        p_transition: input.transition,
        ...(input.scheduledAt ? { p_scheduled_at: input.scheduledAt } : {}),
        ...(input.note ? { p_note: input.note } : {}),
      },
    );
    if (error) throw error;
    return data as ConciergeBookingStatus;
  }

  async recordCost(input: RecordConciergeCostInput): Promise<string> {
    const { data, error } = await this.client.rpc(
      "record_concierge_service_cost",
      {
        p_booking_id: input.bookingId,
        p_amount_minor: input.amountMinor,
        p_currency: input.currency,
        p_description: input.description,
      },
    );
    if (error) throw error;
    return String(data);
  }
}
