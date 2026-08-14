import {
  asId,
  type CreateServicePartnerEngagementInput,
  type CreateServicePartnerInput,
  type CreateServicePartnerInvoiceInput,
  type InvoiceReconciliation,
  type PartnerCapability,
  type PartnerCustodyEvent,
  type PartnerCustodyState,
  type RetailerId,
  type ServicePartnerEngagement,
  type ServicePartnerInvoice,
  type ServicePartnerInvoiceLine,
  type ServicePartnerRecord,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

type PartnerRow = Database["public"]["Tables"]["service_partners"]["Row"];
type EngagementRow =
  Database["public"]["Tables"]["service_partner_engagements"]["Row"];
type CustodyEventRow =
  Database["public"]["Tables"]["service_partner_custody_events"]["Row"];
type InvoiceRow =
  Database["public"]["Tables"]["service_partner_invoices"]["Row"];
type InvoiceLineRow =
  Database["public"]["Tables"]["service_partner_invoice_lines"]["Row"];

type CustomerServiceCareStatusRow =
  Database["public"]["Functions"]["get_my_service_care_status"]["Returns"][number];

export interface CustomerServiceCareStatus {
  readonly bookingId: string;
  readonly garmentDisplayName: string;
  readonly capability: string;
  readonly dueOn: string;
  readonly custodyState: PartnerCustodyState;
  readonly returnedOn: string | null;
}

function toCustomerServiceCareStatus(
  row: CustomerServiceCareStatusRow,
): CustomerServiceCareStatus {
  return {
    bookingId: row.booking_id,
    garmentDisplayName: row.garment_display_name,
    capability: row.capability,
    dueOn: row.due_on,
    custodyState: row.custody_state as PartnerCustodyState,
    returnedOn: row.returned_on,
  };
}

function toPartner(row: PartnerRow): ServicePartnerRecord {
  return {
    id: asId<"ServicePartnerId">(row.id),
    partnerId: row.id,
    retailerId: asId<"RetailerId">(row.retailer_id),
    displayName: row.display_name,
    ...(row.branch_id ? { branchId: row.branch_id } : {}),
    capabilities: row.capabilities as readonly PartnerCapability[],
    turnaroundDays: row.turnaround_days,
    active: row.active,
    ...(row.contact_email ? { contactEmail: row.contact_email } : {}),
    ...(row.contact_phone ? { contactPhone: row.contact_phone } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function toEngagement(row: EngagementRow): ServicePartnerEngagement {
  return {
    id: asId<"ServicePartnerEngagementId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    partnerId: asId<"ServicePartnerId">(row.partner_id),
    customerId: asId<"CustomerId">(row.customer_id),
    wardrobeItemId: asId<"WardrobeItemId">(row.wardrobe_item_id ?? ""),
    ...(row.booking_id
      ? { bookingId: asId<"ServiceBookingId">(row.booking_id) }
      : {}),
    jobReference: row.job_reference,
    capability: row.capability as PartnerCapability,
    instructions: row.instructions,
    ...(row.sent_on ? { sentOn: row.sent_on } : {}),
    dueOn: row.due_on,
    ...(row.returned_on ? { returnedOn: row.returned_on } : {}),
    custodyState: row.custody_state as PartnerCustodyState,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function toCustodyEvent(row: CustodyEventRow): PartnerCustodyEvent {
  return {
    id: asId<"ServicePartnerCustodyEventId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    engagementId: asId<"ServicePartnerEngagementId">(row.engagement_id),
    fromState: row.from_state as PartnerCustodyState,
    toState: row.to_state as PartnerCustodyState,
    ...(row.condition_note ? { conditionNote: row.condition_note } : {}),
    ...(row.actor_staff_id
      ? { actorStaffId: asId<"StaffId">(row.actor_staff_id) }
      : {}),
    occurredAt: row.occurred_at,
  };
}

function toInvoice(row: InvoiceRow): ServicePartnerInvoice {
  return {
    id: asId<"ServicePartnerInvoiceId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    partnerId: asId<"ServicePartnerId">(row.partner_id),
    partnerInvoiceReference: row.partner_invoice_reference,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    currency: row.currency,
    ...(row.submitted_by_staff_id
      ? { submittedByStaffId: asId<"StaffId">(row.submitted_by_staff_id) }
      : {}),
    state: row.state as ServicePartnerInvoice["state"],
    ...(row.approved_by_staff_id
      ? { approvedByStaffId: asId<"StaffId">(row.approved_by_staff_id) }
      : {}),
    ...(row.approved_at ? { approvedAt: row.approved_at } : {}),
    reconciliation: row.reconciliation as unknown as
      InvoiceReconciliation | Record<string, never>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toInvoiceLine(row: InvoiceLineRow): ServicePartnerInvoiceLine {
  return {
    id: asId<"ServicePartnerInvoiceLineId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    invoiceId: asId<"ServicePartnerInvoiceId">(row.invoice_id),
    jobReference: row.job_reference,
    amountMinorUnits: row.amount_minor_units,
    ...(row.matched_cost_record_id
      ? {
          matchedCostRecordId: asId<"ServiceCostRecordId">(
            row.matched_cost_record_id,
          ),
        }
      : {}),
  };
}

/** Preferred Tailoring partner network — see PHASE 12.3 / SRV-101..103 and packages/domain/src/concierge/partner-network.ts. */
export class ServicePartnerRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  /**
   * FT-14's only customer read surface for partner custody. The database
   * derives the caller from auth.uid() and projects no partner/internal data.
   */
  async listMyCustomerCareStatus(): Promise<CustomerServiceCareStatus[]> {
    const { data, error } = await this.client.rpc("get_my_service_care_status");
    if (error) throw error;
    return data.map(toCustomerServiceCareStatus);
  }

  async findPartnersByRetailer(
    retailerId: RetailerId,
  ): Promise<ServicePartnerRecord[]> {
    const { data, error } = await this.client
      .from("service_partners")
      .select("*")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .order("display_name", { ascending: true });
    if (error) throw error;
    return data.map(toPartner);
  }

  async findPartnerById(
    partnerId: string,
  ): Promise<ServicePartnerRecord | null> {
    const { data, error } = await this.client
      .from("service_partners")
      .select("*")
      .eq("id", partnerId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return data ? toPartner(data) : null;
  }

  async createPartner(
    retailerId: RetailerId,
    input: CreateServicePartnerInput,
  ): Promise<ServicePartnerRecord> {
    const { data, error } = await this.client
      .from("service_partners")
      .insert({
        retailer_id: retailerId,
        display_name: input.displayName,
        capabilities: input.capabilities,
        turnaround_days: input.turnaroundDays,
        contact_email: input.contactEmail ?? null,
        contact_phone: input.contactPhone ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toPartner(data);
  }

  async findEngagementsByRetailer(
    retailerId: RetailerId,
  ): Promise<ServicePartnerEngagement[]> {
    const { data, error } = await this.client
      .from("service_partner_engagements")
      .select("*")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .order("due_on", { ascending: true });
    if (error) throw error;
    return data.map(toEngagement);
  }

  async findEngagementById(
    engagementId: string,
  ): Promise<ServicePartnerEngagement | null> {
    const { data, error } = await this.client
      .from("service_partner_engagements")
      .select("*")
      .eq("id", engagementId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return data ? toEngagement(data) : null;
  }

  async createEngagement(
    retailerId: RetailerId,
    input: CreateServicePartnerEngagementInput,
  ): Promise<ServicePartnerEngagement> {
    const { data, error } = await this.client
      .from("service_partner_engagements")
      .insert({
        retailer_id: retailerId,
        partner_id: input.partnerId,
        customer_id: input.customerId,
        wardrobe_item_id: input.wardrobeItemId,
        booking_id: input.bookingId ?? null,
        job_reference: input.jobReference,
        capability: input.capability,
        instructions: input.instructions,
        due_on: input.dueOn,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toEngagement(data);
  }

  async findCustodyEvents(
    engagementId: string,
  ): Promise<PartnerCustodyEvent[]> {
    const { data, error } = await this.client
      .from("service_partner_custody_events")
      .select("*")
      .eq("engagement_id", engagementId)
      .order("occurred_at", { ascending: true });
    if (error) throw error;
    return data.map(toCustodyEvent);
  }

  /** Caller must validate the transition with `checkCustodyTransition` first — this only persists it. */
  async recordCustodyTransition(
    retailerId: RetailerId,
    args: {
      engagementId: string;
      fromState: PartnerCustodyState;
      toState: PartnerCustodyState;
      conditionNote?: string;
      actorStaffId?: string;
      sentOn?: string;
      returnedOn?: string;
    },
  ): Promise<void> {
    const { error: eventError } = await this.client
      .from("service_partner_custody_events")
      .insert({
        retailer_id: retailerId,
        engagement_id: args.engagementId,
        from_state: args.fromState,
        to_state: args.toState,
        condition_note: args.conditionNote ?? null,
        actor_staff_id: args.actorStaffId ?? null,
      });
    if (eventError) throw eventError;

    const { error: engagementError } = await this.client
      .from("service_partner_engagements")
      .update({
        custody_state: args.toState,
        ...(args.sentOn ? { sent_on: args.sentOn } : {}),
        ...(args.returnedOn ? { returned_on: args.returnedOn } : {}),
      })
      .eq("id", args.engagementId)
      .eq("retailer_id", retailerId);
    if (engagementError) throw engagementError;
  }

  async findInvoicesByRetailer(
    retailerId: RetailerId,
  ): Promise<ServicePartnerInvoice[]> {
    const { data, error } = await this.client
      .from("service_partner_invoices")
      .select("*")
      .eq("retailer_id", retailerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toInvoice);
  }

  async findInvoiceById(
    invoiceId: string,
  ): Promise<ServicePartnerInvoice | null> {
    const { data, error } = await this.client
      .from("service_partner_invoices")
      .select("*")
      .eq("id", invoiceId)
      .maybeSingle();
    if (error) throw error;
    return data ? toInvoice(data) : null;
  }

  async createInvoice(
    retailerId: RetailerId,
    submittedByStaffId: string,
    input: CreateServicePartnerInvoiceInput,
  ): Promise<ServicePartnerInvoice> {
    const { data, error } = await this.client
      .from("service_partner_invoices")
      .insert({
        retailer_id: retailerId,
        partner_id: input.partnerId,
        partner_invoice_reference: input.partnerInvoiceReference,
        period_start: input.periodStart,
        period_end: input.periodEnd,
        currency: input.currency,
        submitted_by_staff_id: submittedByStaffId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toInvoice(data);
  }

  async findInvoiceLines(
    invoiceId: string,
  ): Promise<ServicePartnerInvoiceLine[]> {
    const { data, error } = await this.client
      .from("service_partner_invoice_lines")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("job_reference", { ascending: true });
    if (error) throw error;
    return data.map(toInvoiceLine);
  }

  async addInvoiceLine(
    retailerId: RetailerId,
    args: { invoiceId: string; jobReference: string; amountMinorUnits: number },
  ): Promise<ServicePartnerInvoiceLine> {
    const { data, error } = await this.client
      .from("service_partner_invoice_lines")
      .insert({
        retailer_id: retailerId,
        invoice_id: args.invoiceId,
        job_reference: args.jobReference,
        amount_minor_units: args.amountMinorUnits,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toInvoiceLine(data);
  }

  /** Persists a computed `InvoiceReconciliation` and moves state to
   * "reconciled" so `checkInvoiceApproval` can allow approval next. */
  async recordReconciliation(
    retailerId: RetailerId,
    invoiceId: string,
    reconciliation: InvoiceReconciliation,
  ): Promise<ServicePartnerInvoice> {
    const { data, error } = await this.client
      .from("service_partner_invoices")
      .update({
        reconciliation: reconciliation as unknown as Json,
        state: reconciliation.reconciled ? "reconciled" : "disputed",
      })
      .eq("id", invoiceId)
      .eq("retailer_id", retailerId)
      .select("*")
      .single();
    if (error) throw error;
    return toInvoice(data);
  }

  /** Caller must gate this with `checkInvoiceApproval` first. Never pays anything — see ADR-062. */
  async approveInvoice(
    retailerId: RetailerId,
    invoiceId: string,
    approvedByStaffId: string,
  ): Promise<ServicePartnerInvoice> {
    const { data, error } = await this.client
      .from("service_partner_invoices")
      .update({
        state: "approved",
        approved_by_staff_id: approvedByStaffId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", invoiceId)
      .eq("retailer_id", retailerId)
      .select("*")
      .single();
    if (error) throw error;
    return toInvoice(data);
  }
}
