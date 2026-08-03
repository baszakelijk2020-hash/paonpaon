"use server";

import {
  RetailerStaffRepository,
  ServicePartnerRepository,
  ServicePlanRepository,
} from "@paon/database";
import {
  checkCustodyTransition,
  checkInvoiceApproval,
  createServicePartnerEngagementInputSchema,
  createServicePartnerInputSchema,
  createServicePartnerInvoiceInputSchema,
  addServicePartnerInvoiceLineInputSchema,
  reconcilePartnerInvoice,
  type InvoiceReconciliation,
  type PartnerCustodyState,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

async function resolveActingStaff() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  if (!staff) throw new Error("No staff record for this session.");
  return { session, supabase, staff };
}

export async function createPartner(formData: FormData): Promise<void> {
  const { session, supabase } = await resolveActingStaff();
  const capabilities = formData.getAll("capabilities").map(String);
  const values = createServicePartnerInputSchema.parse({
    displayName: formData.get("displayName"),
    capabilities,
    turnaroundDays: formData.get("turnaroundDays"),
    contactEmail: (formData.get("contactEmail") as string | null) || undefined,
    contactPhone: (formData.get("contactPhone") as string | null) || undefined,
  });
  await new ServicePartnerRepository(supabase).createPartner(
    session.retailerId,
    values,
  );
  revalidatePath("/service-partners");
}

export async function createEngagement(formData: FormData): Promise<void> {
  const { session, supabase } = await resolveActingStaff();
  const [wardrobeItemId, customerId] = String(
    formData.get("wardrobeItemAndCustomer") ?? "",
  ).split(":");
  const values = createServicePartnerEngagementInputSchema.parse({
    partnerId: formData.get("partnerId"),
    customerId,
    wardrobeItemId,
    jobReference: formData.get("jobReference"),
    capability: formData.get("capability"),
    instructions: formData.get("instructions"),
    dueOn: formData.get("dueOn"),
  });
  await new ServicePartnerRepository(supabase).createEngagement(
    session.retailerId,
    values,
  );
  revalidatePath("/service-partners");
}

export async function transitionCustodyForEngagement(
  engagementId: string,
  formData: FormData,
): Promise<void> {
  const toState = String(formData.get("toState")) as PartnerCustodyState;
  await transitionCustody(engagementId, toState, formData);
}

export async function transitionCustody(
  engagementId: string,
  toState: PartnerCustodyState,
  formData: FormData,
): Promise<void> {
  const { session, supabase, staff } = await resolveActingStaff();
  const repo = new ServicePartnerRepository(supabase);
  const engagement = await repo.findEngagementById(engagementId);
  if (!engagement) throw new Error("Engagement not found.");

  const conditionNote =
    (formData.get("conditionNote") as string | null)?.trim() || undefined;
  const check = checkCustodyTransition({
    from: engagement.custodyState,
    to: toState,
    ...(conditionNote ? { conditionNote } : {}),
  });
  if (!check.ok) {
    const messages: Record<typeof check.reason, string> = {
      transition_not_allowed: "That move isn't allowed from the current state.",
      release_requires_return:
        "A garment must be recorded back with the retailer before it can be released to the customer.",
      condition_note_required:
        "Add a condition note — required the moment a garment comes back.",
    };
    throw new Error(messages[check.reason]);
  }

  await repo.recordCustodyTransition(session.retailerId, {
    engagementId,
    fromState: engagement.custodyState,
    toState,
    ...(conditionNote ? { conditionNote } : {}),
    actorStaffId: staff.id,
    ...(toState === "in_transit_to_partner"
      ? { sentOn: new Date().toISOString().slice(0, 10) }
      : {}),
    ...(toState === "returned_to_retailer"
      ? { returnedOn: new Date().toISOString().slice(0, 10) }
      : {}),
  });
  revalidatePath("/service-partners");
}

export async function createInvoice(formData: FormData): Promise<void> {
  const { session, supabase, staff } = await resolveActingStaff();
  const values = createServicePartnerInvoiceInputSchema.parse({
    partnerId: formData.get("partnerId"),
    partnerInvoiceReference: formData.get("partnerInvoiceReference"),
    periodStart: formData.get("periodStart"),
    periodEnd: formData.get("periodEnd"),
    currency: formData.get("currency"),
  });
  await new ServicePartnerRepository(supabase).createInvoice(
    session.retailerId,
    staff.id,
    values,
  );
  revalidatePath("/service-partners");
}

export async function addInvoiceLine(formData: FormData): Promise<void> {
  const { session, supabase } = await resolveActingStaff();
  const values = addServicePartnerInvoiceLineInputSchema.parse({
    invoiceId: formData.get("invoiceId"),
    jobReference: formData.get("jobReference"),
    amountMinorUnits: formData.get("amountMinorUnits"),
  });
  await new ServicePartnerRepository(supabase).addInvoiceLine(
    session.retailerId,
    values,
  );
  revalidatePath("/service-partners");
}

export async function reconcileInvoice(invoiceId: string): Promise<void> {
  const { session, supabase } = await resolveActingStaff();
  const repo = new ServicePartnerRepository(supabase);
  const [lines, costs] = await Promise.all([
    repo.findInvoiceLines(invoiceId),
    new ServicePlanRepository(supabase).listCostsByRetailer(session.retailerId),
  ]);
  // Convention: a recorded cost matches an invoice line by job reference,
  // held in the cost record's freeform `label` — see ServiceCostRecord,
  // which has no dedicated job-reference column of its own.
  const reconciliation = reconcilePartnerInvoice({
    invoiceLines: lines.map((line) => ({
      jobReference: line.jobReference,
      amountMinorUnits: line.amountMinorUnits,
    })),
    recordedCosts: costs.map((cost) => ({
      jobReference: cost.label,
      amountMinorUnits: cost.amountMinorUnits,
    })),
  });
  await repo.recordReconciliation(
    session.retailerId,
    invoiceId,
    reconciliation,
  );
  revalidatePath("/service-partners");
}

export async function approveInvoice(invoiceId: string): Promise<void> {
  const { session, supabase, staff } = await resolveActingStaff();
  const repo = new ServicePartnerRepository(supabase);
  const invoice = await repo.findInvoiceById(invoiceId);
  if (!invoice) throw new Error("Invoice not found.");
  const reconciliation =
    "reconciled" in invoice.reconciliation
      ? (invoice.reconciliation as InvoiceReconciliation)
      : undefined;
  if (!reconciliation) {
    throw new Error("Reconcile this invoice before approving it.");
  }
  const check = checkInvoiceApproval({
    reconciliation,
    submittedByStaffId: invoice.submittedByStaffId ?? "",
    approverStaffId: staff.id,
  });
  if (!check.ok) {
    const messages: Record<typeof check.reason, string> = {
      not_reconciled: "Reconcile this invoice before approving it.",
      self_approval_not_allowed:
        "Someone other than the submitting staff member must approve.",
      payout_not_designed:
        "Approval never initiates a payout — that design does not exist yet.",
    };
    throw new Error(messages[check.reason]);
  }
  await repo.approveInvoice(session.retailerId, invoiceId, staff.id);
  revalidatePath("/service-partners");
}
