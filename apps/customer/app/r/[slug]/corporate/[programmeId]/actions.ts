"use server";

import { CorporateOfficeVisitRepository } from "@paon/database";
import { asId, checkSubmitOfficeVisitRequest } from "@paon/domain";

import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface ClaimVisitSlotFormState {
  fieldErrors: Record<string, string>;
  formError?: string;
  claimed: boolean;
}

/**
 * Self-service booking (PHASE 18.4, direct founder instruction
 * 2026-08-19). The actual double-booking prevention lives in the
 * claim_corporate_visit_slot RPC's row lock, not here — this action only
 * surfaces whatever that RPC decides (including "someone else just took
 * it") as a normal inline form error, since a visitor losing a race to
 * another visitor is an expected outcome on a self-service page, not a
 * server fault.
 */
export async function claimVisitSlot(
  slotId: string,
  _previous: ClaimVisitSlotFormState,
  formData: FormData,
): Promise<ClaimVisitSlotFormState> {
  const requesterName = String(formData.get("requesterName") ?? "");
  const check = checkSubmitOfficeVisitRequest({ requesterName });
  if (!check.ok) {
    return {
      fieldErrors: { requesterName: "Enter your name." },
      claimed: false,
    };
  }

  const employeeReference = String(formData.get("employeeReference") ?? "");
  const contactEmail = String(formData.get("contactEmail") ?? "");
  const note = String(formData.get("note") ?? "");

  const supabase = await getSupabaseServerClient();
  const result = await new CorporateOfficeVisitRepository(supabase).claimSlot({
    slotId: asId<"CorporateVisitSlotId">(slotId),
    requesterName,
    ...(employeeReference ? { employeeReference } : {}),
    ...(contactEmail ? { contactEmail } : {}),
    ...(note ? { note } : {}),
  });

  if (!result.ok) {
    return { fieldErrors: {}, formError: result.reason, claimed: false };
  }
  return { fieldErrors: {}, claimed: true };
}

export interface SubmitOfficeVisitRequestFormState {
  fieldErrors: Record<string, string>;
  formError?: string;
  submitted: boolean;
}

export async function submitOfficeVisitRequest(
  programmeId: string,
  _previous: SubmitOfficeVisitRequestFormState,
  formData: FormData,
): Promise<SubmitOfficeVisitRequestFormState> {
  const requesterName = String(formData.get("requesterName") ?? "");
  const check = checkSubmitOfficeVisitRequest({ requesterName });
  if (!check.ok) {
    return {
      fieldErrors: { requesterName: "Enter your name." },
      submitted: false,
    };
  }

  const employeeReference = String(formData.get("employeeReference") ?? "");
  const contactEmail = String(formData.get("contactEmail") ?? "");
  const note = String(formData.get("note") ?? "");

  const supabase = await getSupabaseServerClient();
  try {
    await new CorporateOfficeVisitRepository(supabase).submit({
      programmeId: asId<"CorporateProgrammeId">(programmeId),
      requesterName,
      ...(employeeReference ? { employeeReference } : {}),
      ...(contactEmail ? { contactEmail } : {}),
      ...(note ? { note } : {}),
    });
  } catch (error) {
    return {
      fieldErrors: {},
      formError: error instanceof Error ? error.message : "Could not submit.",
      submitted: false,
    };
  }

  return { fieldErrors: {}, submitted: true };
}
