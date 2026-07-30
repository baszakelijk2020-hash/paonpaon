/**
 * Customer moments + appointment closeout audit (CLI-006 / PHASE 7.5).
 */

import {
  asId,
  type AppointmentCloseoutId,
  type AppointmentId,
  type CustomerId,
  type CustomerMoment,
  type CustomerMomentRecurrence,
  type CustomerMomentType,
  type RetailerBranchId,
  type RetailerId,
  type StaffId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type MomentRow = Database["public"]["Tables"]["customer_moments"]["Row"];
type CloseoutRow = Database["public"]["Tables"]["appointment_closeouts"]["Row"];

function toMoment(row: MomentRow): CustomerMoment {
  return {
    id: asId<"CustomerMomentId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    ...(row.branch_id
      ? { branchId: asId<"RetailerBranchId">(row.branch_id) }
      : {}),
    ...(row.appointment_id
      ? { appointmentId: asId<"AppointmentId">(row.appointment_id) }
      : {}),
    momentType: row.moment_type as CustomerMomentType,
    label: row.label,
    occursOn: row.occurs_on,
    recurrence: row.recurrence as CustomerMomentRecurrence,
    timezone: row.timezone,
    ...(row.notes ? { notes: row.notes } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export interface AppointmentCloseoutRecord {
  readonly id: AppointmentCloseoutId;
  readonly retailerId: RetailerId;
  readonly appointmentId: AppointmentId;
  readonly customerId: CustomerId;
  readonly staffId: StaffId;
  readonly freeformNote?: string;
  readonly nextStep?: string;
  readonly followUpDate?: string;
  readonly createdAt: string;
}

function toCloseout(row: CloseoutRow): AppointmentCloseoutRecord {
  return {
    id: asId<"AppointmentCloseoutId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    appointmentId: asId<"AppointmentId">(row.appointment_id),
    customerId: asId<"CustomerId">(row.customer_id),
    staffId: asId<"StaffId">(row.staff_id),
    ...(row.freeform_note ? { freeformNote: row.freeform_note } : {}),
    ...(row.next_step ? { nextStep: row.next_step } : {}),
    ...(row.follow_up_date ? { followUpDate: row.follow_up_date } : {}),
    createdAt: row.created_at,
  };
}

export class CustomerMomentRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async listByRetailer(
    retailerId: RetailerId,
    limit = 50,
  ): Promise<CustomerMoment[]> {
    const { data, error } = await this.client
      .from("customer_moments")
      .select("*")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .order("occurs_on", { ascending: true })
      .limit(limit);
    if (error) throw error;
    return data.map(toMoment);
  }

  async create(args: {
    readonly retailerId: RetailerId;
    readonly customerId: CustomerId;
    readonly momentType: CustomerMomentType;
    readonly label: string;
    readonly occursOn: string;
    readonly recurrence: CustomerMomentRecurrence;
    readonly timezone: string;
    readonly branchId?: RetailerBranchId;
    readonly appointmentId?: AppointmentId;
    readonly notes?: string;
  }): Promise<CustomerMoment> {
    const { data, error } = await this.client
      .from("customer_moments")
      .insert({
        retailer_id: args.retailerId,
        customer_id: args.customerId,
        moment_type: args.momentType,
        label: args.label.trim(),
        occurs_on: args.occursOn,
        recurrence: args.recurrence,
        timezone: args.timezone,
        ...(args.branchId ? { branch_id: args.branchId } : {}),
        ...(args.appointmentId ? { appointment_id: args.appointmentId } : {}),
        ...(args.notes ? { notes: args.notes } : {}),
      })
      .select("*")
      .single();
    if (error) throw error;
    return toMoment(data);
  }
}

export class AppointmentCloseoutRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findByAppointment(
    retailerId: RetailerId,
    appointmentId: AppointmentId,
  ): Promise<AppointmentCloseoutRecord | null> {
    const { data, error } = await this.client
      .from("appointment_closeouts")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("appointment_id", appointmentId)
      .maybeSingle();
    if (error) throw error;
    return data ? toCloseout(data) : null;
  }

  async record(args: {
    readonly retailerId: RetailerId;
    readonly appointmentId: AppointmentId;
    readonly customerId: CustomerId;
    readonly staffId: StaffId;
    readonly freeformNote?: string;
    readonly nextStep?: string;
    readonly followUpDate?: string;
  }): Promise<AppointmentCloseoutRecord> {
    const { data, error } = await this.client
      .from("appointment_closeouts")
      .insert({
        retailer_id: args.retailerId,
        appointment_id: args.appointmentId,
        customer_id: args.customerId,
        staff_id: args.staffId,
        ...(args.freeformNote ? { freeform_note: args.freeformNote } : {}),
        ...(args.nextStep ? { next_step: args.nextStep } : {}),
        ...(args.followUpDate ? { follow_up_date: args.followUpDate } : {}),
      })
      .select("*")
      .single();
    if (error) throw error;
    return toCloseout(data);
  }
}
