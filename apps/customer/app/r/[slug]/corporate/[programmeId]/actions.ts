"use server";

import { CorporateOfficeVisitRepository } from "@paon/database";
import { asId, checkSubmitOfficeVisitRequest } from "@paon/domain";

import { getSupabaseServerClient } from "@/lib/supabase-server";

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
