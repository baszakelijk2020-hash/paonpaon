"use server";

import { requireRetailerRole } from "@paon/auth";
import {
  RetailerStaffRepository,
  ShiftCloseoutRepository,
} from "@paon/database";
import { revalidatePath } from "next/cache";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface CloseoutActionState {
  formError?: string;
  notice?: string;
}

const REJECTION_MESSAGES: Record<string, string> = {
  promises_required:
    "Promises are required. What did you commit to getting done?",
  promises_too_short: "Describe promises with enough detail.",
  promises_too_long: "Promise notes must be 2000 characters or less.",
  what_worked_required: "What worked is required. What went well today?",
  what_worked_too_short: "Describe what worked with enough detail.",
  what_worked_too_long: "What worked notes must be 2000 characters or less.",
  text_too_long: "All notes must be 2000 characters or less.",
  invalid_extra_mile_act: "That recognition act does not belong to you.",
};

/**
 * Submit a shift closeout (PHASE 11.2 / WFM-104). Uses the session-scoped
 * client deliberately, NOT the admin client: `staff_shift_closeouts`
 * grants insert to `authenticated` precisely so its RLS policy can pin
 * `staff_id` to the calling user. Going through the admin client here
 * would bypass that check and let anyone submit a closeout as anyone.
 */
export async function submitCloseout(
  _previous: CloseoutActionState,
  formData: FormData,
): Promise<CloseoutActionState> {
  const session = await requireModuleSession("retail_operations");
  requireRetailerRole(session.retailerRole, "read_only");

  const supabase = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  if (!staff) {
    return { formError: "Your staff record could not be found." };
  }

  const closeoutDate =
    String(formData.get("closeoutDate") ?? "").trim() ||
    new Date().toISOString().slice(0, 10);
  const promisesNote = String(formData.get("promisesNote") ?? "");
  const whatWorkedNote = String(formData.get("whatWorkedNote") ?? "");
  const factsLearnedNote = String(formData.get("factsLearnedNote") ?? "");
  const problemsNote = String(formData.get("problemsNote") ?? "");
  const anomaliesNote = String(formData.get("anomaliesNote") ?? "");
  const helpRequestedNote = String(formData.get("helpRequestedNote") ?? "");
  const extraMileActId =
    String(formData.get("extraMileActId") ?? "").trim() || undefined;

  const result = await new ShiftCloseoutRepository(supabase).upsertCloseout({
    retailerId: session.retailerId,
    staffId: staff.id,
    closeoutDate,
    promisesNote,
    whatWorkedNote,
    ...(factsLearnedNote.trim() ? { factsLearnedNote } : {}),
    ...(problemsNote.trim() ? { problemsNote } : {}),
    ...(anomaliesNote.trim() ? { anomaliesNote } : {}),
    ...(helpRequestedNote.trim() ? { helpRequestedNote } : {}),
    ...(extraMileActId ? { extraMileActId } : {}),
  });

  if (!result.ok) {
    return {
      formError:
        REJECTION_MESSAGES[result.reason] ??
        "That closeout could not be submitted.",
    };
  }

  revalidatePath("/staff/closeout");
  return { notice: "Shift closeout saved." };
}
