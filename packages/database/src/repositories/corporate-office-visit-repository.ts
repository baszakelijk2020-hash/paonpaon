import {
  asId,
  checkResolveOfficeVisitRequest,
  checkScheduleOfficeVisitAppointment,
  type CorporateOfficeVisitPage,
  type CorporateOfficeVisitRequest,
  type CorporateOfficeVisitRequestId,
  type CorporateOfficeVisitRequestStatus,
  type CorporateProgrammeId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { AppointmentRepository } from "./appointment-repository";
import { CustomerRepository } from "./customer-repository";

type RequestRow =
  Database["public"]["Tables"]["corporate_office_visit_requests"]["Row"];

function toRequest(row: RequestRow): CorporateOfficeVisitRequest {
  return {
    id: asId<"CorporateOfficeVisitRequestId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    programmeId: asId<"CorporateProgrammeId">(row.programme_id),
    requesterName: row.requester_name,
    ...(row.employee_reference
      ? { employeeReference: row.employee_reference }
      : {}),
    ...(row.contact_email ? { contactEmail: row.contact_email } : {}),
    ...(row.note ? { note: row.note } : {}),
    status: row.status as CorporateOfficeVisitRequestStatus,
    ...(row.resolved_at ? { resolvedAt: row.resolved_at } : {}),
    ...(row.customer_id ? { customerId: row.customer_id } : {}),
    ...(row.appointment_id ? { appointmentId: row.appointment_id } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type ResolveOfficeVisitRequestResult =
  | { readonly ok: true; readonly request: CorporateOfficeVisitRequest }
  | { readonly ok: false; readonly reason: "already_resolved" }
  | { readonly ok: false; readonly reason: "request_not_found" };

export type ScheduleOfficeVisitAppointmentResult =
  | { readonly ok: true; readonly request: CorporateOfficeVisitRequest }
  | { readonly ok: false; readonly reason: "already_resolved" }
  | { readonly ok: false; readonly reason: "request_not_found" }
  | { readonly ok: false; readonly reason: "contact_email_required" }
  | { readonly ok: false; readonly reason: "invalid_time_window" };

/**
 * The office-visit landing page (PHASE 18.4 / BD-104). The public reveal
 * and submission both go through `security definer` RPCs
 * (`resolve_corporate_office_visit_page` /
 * `submit_corporate_office_visit_request`) — there is no anonymous RLS
 * insert path on `corporate_office_visit_requests` at all, matching
 * `submit_table_service_inquiry`'s established shape.
 */
export class CorporateOfficeVisitRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async resolvePage(
    programmeId: CorporateProgrammeId,
  ): Promise<CorporateOfficeVisitPage> {
    const { data, error } = await this.client.rpc(
      "resolve_corporate_office_visit_page",
      { p_programme_id: programmeId },
    );
    if (error) throw error;
    return data as unknown as CorporateOfficeVisitPage;
  }

  async submit(args: {
    readonly programmeId: CorporateProgrammeId;
    readonly requesterName: string;
    readonly employeeReference?: string;
    readonly contactEmail?: string;
    readonly note?: string;
  }): Promise<CorporateOfficeVisitRequestId> {
    // The RPC's own body treats an empty string identically to NULL
    // (`nullif(trim(coalesce(..., '')), '')`) — passed here rather than
    // `null` because the generated RPC arg types are non-nullable
    // `string`, and this is what the function already expects for "no
    // value" on these deliberately optional fields.
    const { data, error } = await this.client.rpc(
      "submit_corporate_office_visit_request",
      {
        p_programme_id: args.programmeId,
        p_requester_name: args.requesterName,
        p_employee_reference: args.employeeReference ?? "",
        p_contact_email: args.contactEmail ?? "",
        p_note: args.note ?? "",
      },
    );
    if (error) throw error;
    return asId<"CorporateOfficeVisitRequestId">(data);
  }

  async findByProgramme(
    programmeId: CorporateProgrammeId,
  ): Promise<readonly CorporateOfficeVisitRequest[]> {
    const { data, error } = await this.client
      .from("corporate_office_visit_requests")
      .select("*")
      .eq("programme_id", programmeId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toRequest);
  }

  async resolve(args: {
    readonly requestId: CorporateOfficeVisitRequestId;
    readonly status: Extract<
      CorporateOfficeVisitRequestStatus,
      "contacted" | "scheduled" | "declined"
    >;
  }): Promise<ResolveOfficeVisitRequestResult> {
    const { data: current, error: findError } = await this.client
      .from("corporate_office_visit_requests")
      .select("status")
      .eq("id", args.requestId)
      .maybeSingle();
    if (findError) throw findError;
    if (!current) return { ok: false, reason: "request_not_found" };

    const check = checkResolveOfficeVisitRequest({
      currentStatus: current.status as CorporateOfficeVisitRequestStatus,
    });
    if (!check.ok) return check;

    const isTerminal = args.status !== "contacted";
    const { data, error } = await this.client
      .from("corporate_office_visit_requests")
      .update({
        status: args.status,
        resolved_at: isTerminal ? new Date().toISOString() : null,
      })
      .eq("id", args.requestId)
      .select("*")
      .single();
    if (error) throw error;
    return { ok: true, request: toRequest(data) };
  }

  /**
   * Closes 18.4's own named gap: turns "Scheduled" into a real
   * appointment rather than a status label only. Finds or creates a
   * real `customers` row for the requester (never a shadow row per
   * request — reuses an existing relationship by email when one
   * exists) and books a real `appointments` row, exactly like any
   * other prospect choosing to engage the retailer directly. Refuses
   * (via `checkScheduleOfficeVisitAppointment`) rather than fabricates
   * a contact channel or a time when the requester left no email.
   */
  async scheduleAppointment(args: {
    readonly requestId: CorporateOfficeVisitRequestId;
    readonly startsAt: string;
    readonly endsAt: string;
    readonly staffId?: string;
  }): Promise<ScheduleOfficeVisitAppointmentResult> {
    const { data: current, error: findError } = await this.client
      .from("corporate_office_visit_requests")
      .select("*")
      .eq("id", args.requestId)
      .maybeSingle();
    if (findError) throw findError;
    if (!current) return { ok: false, reason: "request_not_found" };

    const statusCheck = checkResolveOfficeVisitRequest({
      currentStatus: current.status as CorporateOfficeVisitRequestStatus,
    });
    if (!statusCheck.ok) return statusCheck;

    const scheduleCheck = checkScheduleOfficeVisitAppointment({
      ...(current.contact_email ? { contactEmail: current.contact_email } : {}),
      startsAt: args.startsAt,
      endsAt: args.endsAt,
    });
    if (!scheduleCheck.ok) return scheduleCheck;

    const retailerId = asId<"RetailerId">(current.retailer_id);
    const contactEmail = current.contact_email!;
    const customerRepo = new CustomerRepository(this.client);
    const existingCustomer = await customerRepo.findByEmail(
      retailerId,
      contactEmail,
    );
    const customer =
      existingCustomer ??
      (await customerRepo.create({
        retailerId,
        fullName: current.requester_name,
        email: contactEmail,
        lifecycleStage: "prospect",
        acquisitionSource: "corporate_office_visit",
      }));

    const appointment = await new AppointmentRepository(this.client).create({
      retailerId,
      customerId: customer.id,
      type: "styling_consultation",
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      notes: `Corporate office visit request (${current.employee_reference ?? current.requester_name})`,
      ...(args.staffId ? { staffId: asId<"StaffId">(args.staffId) } : {}),
    });

    const { data, error } = await this.client
      .from("corporate_office_visit_requests")
      .update({
        status: "scheduled",
        resolved_at: new Date().toISOString(),
        customer_id: customer.id,
        appointment_id: appointment.id,
      })
      .eq("id", args.requestId)
      .select("*")
      .single();
    if (error) throw error;
    return { ok: true, request: toRequest(data) };
  }
}
