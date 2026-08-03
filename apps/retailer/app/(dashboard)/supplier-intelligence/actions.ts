"use server";

import {
  RetailerStaffRepository,
  SupplierIntelligenceRepository,
} from "@paon/database";
import type {
  ComplaintState,
  SupplierFactKind,
  SupplyExceptionKind,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface SupplierActionState {
  formError?: string;
  notice?: string;
}

async function resolveActingStaff() {
  const session = await requireModuleSession(
    "garment_service_operations",
    "mutate",
  );
  const supabase = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  if (!staff) throw new Error("No staff record for this session.");
  return { session, supabase, staff };
}

export async function recordFact(formData: FormData): Promise<void> {
  const { session, supabase } = await resolveActingStaff();
  const observedAtLocal = String(formData.get("observedAt") ?? "");
  await new SupplierIntelligenceRepository(supabase).recordFact({
    retailerId: session.retailerId,
    fact: {
      kind: String(formData.get("kind") ?? "") as SupplierFactKind,
      supplierKey: String(formData.get("supplierKey") ?? "").trim(),
      materialKey: String(formData.get("materialKey") ?? "").trim(),
      value: String(formData.get("value") ?? "").trim(),
      sourceAuthorityKey: String(
        formData.get("sourceAuthorityKey") ?? "",
      ).trim(),
      sourceVersion: String(formData.get("sourceVersion") ?? "").trim(),
      observedAt: observedAtLocal
        ? new Date(observedAtLocal).toISOString()
        : new Date().toISOString(),
    },
  });
  revalidatePath("/supplier-intelligence");
}

export async function upsertFabricButtonRule(
  formData: FormData,
): Promise<void> {
  const { session, supabase } = await resolveActingStaff();
  const allowedButtonKeys = String(formData.get("allowedButtonKeys") ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
  await new SupplierIntelligenceRepository(supabase).upsertFabricButtonRule({
    retailerId: session.retailerId,
    fabricKey: String(formData.get("fabricKey") ?? "").trim(),
    allowedButtonKeys,
    note: String(formData.get("note") ?? "").trim(),
  });
  revalidatePath("/supplier-intelligence");
}

const EXCEPTION_REJECTION_MESSAGES: Record<string, string> = {
  owner_required: "Name who owns this exception.",
  citation_required: "Select at least one fact that supports this.",
  detail_required: "Describe what happened — at least 10 characters.",
};

export async function createException(
  _previous: SupplierActionState,
  formData: FormData,
): Promise<SupplierActionState> {
  const { session, supabase } = await resolveActingStaff();
  const citationIds = formData.getAll("citationFactIds").map(String);
  if (citationIds.length === 0) {
    return { formError: EXCEPTION_REJECTION_MESSAGES["citation_required"]! };
  }

  const repo = new SupplierIntelligenceRepository(supabase);
  const materialKey = String(formData.get("materialKey") ?? "").trim();
  const facts = await repo.findFactsByRetailer({
    retailerId: session.retailerId,
    materialKey,
  });
  const cited = facts.filter((fact) => citationIds.includes(fact.id));
  if (cited.length === 0) {
    return { formError: EXCEPTION_REJECTION_MESSAGES["citation_required"]! };
  }

  const result = await repo.createException({
    retailerId: session.retailerId,
    kind: String(formData.get("kind") ?? "") as SupplyExceptionKind,
    materialKey,
    ownerStaffId: String(formData.get("ownerStaffId") ?? "").trim(),
    detail: String(formData.get("detail") ?? "").trim(),
    citations: cited.map((fact) => ({
      sourceAuthorityKey: fact.source_authority_key,
      sourceVersion: fact.source_version,
      observedAt: fact.observed_at,
    })),
  });
  if (!result.ok) {
    return {
      formError:
        EXCEPTION_REJECTION_MESSAGES[result.reason] ??
        "That exception could not be recorded.",
    };
  }

  revalidatePath("/supplier-intelligence");
  return { notice: "Exception recorded." };
}

export async function acknowledgeException(formData: FormData): Promise<void> {
  const { session, supabase } = await resolveActingStaff();
  await new SupplierIntelligenceRepository(supabase).acknowledgeException({
    retailerId: session.retailerId,
    exceptionId: String(formData.get("exceptionId") ?? ""),
  });
  revalidatePath("/supplier-intelligence");
}

export async function resolveException(
  _previous: SupplierActionState,
  formData: FormData,
): Promise<SupplierActionState> {
  const { session, supabase } = await resolveActingStaff();
  const resolutionNote = String(formData.get("resolutionNote") ?? "").trim();
  if (resolutionNote.length === 0) {
    return { formError: "Say how this was resolved." };
  }
  await new SupplierIntelligenceRepository(supabase).resolveException({
    retailerId: session.retailerId,
    exceptionId: String(formData.get("exceptionId") ?? ""),
    resolutionNote,
  });
  revalidatePath("/supplier-intelligence");
  return { notice: "Marked resolved." };
}

export async function createComplaint(formData: FormData): Promise<void> {
  const { session, supabase } = await resolveActingStaff();
  const summary = String(formData.get("summary") ?? "").trim();
  const supplierKey =
    (formData.get("supplierKey") as string | null)?.trim() || undefined;
  const ownerStaffId =
    (formData.get("ownerStaffId") as string | null)?.trim() || undefined;
  await new SupplierIntelligenceRepository(supabase).createComplaint({
    retailerId: session.retailerId,
    summary,
    ...(supplierKey ? { supplierKey } : {}),
    ...(ownerStaffId ? { ownerStaffId } : {}),
  });
  revalidatePath("/supplier-intelligence");
}

const COMPLAINT_REJECTION_MESSAGES: Record<string, string> = {
  transition_not_allowed: "That move isn't allowed from the current state.",
  evidence_required:
    "Attach at least one piece of evidence before notifying the supplier.",
  close_requires_outcome: "Say what the final outcome was.",
  close_requires_customer_recovery:
    "A case closes only after the customer has been recovered.",
};

export async function transitionComplaint(
  _previous: SupplierActionState,
  formData: FormData,
): Promise<SupplierActionState> {
  const { session, supabase } = await resolveActingStaff();
  const complaintId = String(formData.get("complaintId") ?? "");
  const to = String(formData.get("to") ?? "") as ComplaintState;
  const evidenceRefs = String(formData.get("evidenceRefs") ?? "")
    .split(",")
    .map((ref) => ref.trim())
    .filter(Boolean);
  const customerRecoveryNote =
    (formData.get("customerRecoveryNote") as string | null)?.trim() ||
    undefined;
  const supplierActionNote =
    (formData.get("supplierActionNote") as string | null)?.trim() || undefined;
  const outcomeNote =
    (formData.get("outcomeNote") as string | null)?.trim() || undefined;

  let result;
  try {
    result = await new SupplierIntelligenceRepository(
      supabase,
    ).transitionComplaint({
      retailerId: session.retailerId,
      complaintId,
      to,
      ...(evidenceRefs.length > 0 ? { evidenceRefs } : {}),
      ...(customerRecoveryNote ? { customerRecoveryNote } : {}),
      ...(supplierActionNote ? { supplierActionNote } : {}),
      ...(outcomeNote ? { outcomeNote } : {}),
    });
  } catch {
    return {
      formError:
        "A case closes only once a customer-recovery note is on record — add one first.",
    };
  }
  if (!result.ok) {
    return {
      formError:
        COMPLAINT_REJECTION_MESSAGES[result.reason] ??
        "That decision could not be recorded.",
    };
  }

  revalidatePath("/supplier-intelligence");
  return { notice: "Updated." };
}
