"use server";

import { requireRetailerRole } from "@paon/auth";
import {
  RetailerStaffRepository,
  StaffRecognitionRepository,
} from "@paon/database";
import type { RecognitionReviewState } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface RecognitionActionState {
  formError?: string;
  notice?: string;
}

const REJECTION_MESSAGES: Record<string, string> = {
  narrative_too_short:
    "Describe what actually happened — a few words is not enough for a colleague to understand it later.",
  self_review_not_allowed:
    "You cannot review an act about yourself. Ask another manager.",
  already_reviewed: "That act has already been reviewed.",
  coaching_requires_note:
    "Coaching needs an actual note — otherwise it reads as a silent mark against someone.",
};

/**
 * Log an extra-mile act (PHASE 11.2 / WFM-104). Uses the session-scoped
 * client deliberately, NOT the admin client: `staff_recognition_acts`
 * grants insert to `authenticated` precisely so its RLS policy can pin
 * `authored_by_staff_id` to the calling user. Going through the admin
 * client here would bypass that check and let anyone author an act as
 * anyone.
 */
export async function submitRecognitionAct(
  _previous: RecognitionActionState,
  formData: FormData,
): Promise<RecognitionActionState> {
  const session = await requireSession();
  // Every retailer role may log an act — the lowest role in the system is
  // still someone whose work deserves recognising.
  requireRetailerRole(session.retailerRole, "read_only");

  const supabase = await getSupabaseServerClient();
  const author = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  if (!author) {
    return { formError: "Your staff record could not be found." };
  }

  const aboutStaffId = String(formData.get("staffId") ?? "").trim();
  const narrative = String(formData.get("narrative") ?? "");
  const occurredOn =
    String(formData.get("occurredOn") ?? "").trim() ||
    new Date().toISOString().slice(0, 10);

  const result = await new StaffRecognitionRepository(supabase).submitAct({
    retailerId: session.retailerId,
    staffId: aboutStaffId || author.id,
    authoredByStaffId: author.id,
    narrative,
    occurredOn,
  });

  if (!result.ok) {
    return {
      formError:
        REJECTION_MESSAGES[result.reason] ?? "That act could not be logged.",
    };
  }

  revalidatePath("/staff/recognition");
  return { notice: "Logged. A manager will see it in the review queue." };
}

/**
 * Manager acknowledgement / coaching / dismissal. Session-scoped client
 * again: the manager-only RLS update policy is the real gate, and the
 * domain layer additionally refuses self-review, which RLS cannot detect.
 */
export async function reviewRecognitionAct(
  _previous: RecognitionActionState,
  formData: FormData,
): Promise<RecognitionActionState> {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "manager");

  const supabase = await getSupabaseServerClient();
  const reviewer = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  if (!reviewer) {
    return { formError: "Your staff record could not be found." };
  }

  const actId = String(formData.get("actId") ?? "").trim();
  const nextState = String(
    formData.get("nextState") ?? "",
  ) as RecognitionReviewState;
  const coachingNote = String(formData.get("coachingNote") ?? "");

  if (!actId || !["acknowledged", "coached", "dismissed"].includes(nextState)) {
    return { formError: "Invalid act or review state." };
  }

  const result = await new StaffRecognitionRepository(supabase).reviewAct({
    retailerId: session.retailerId,
    actId,
    reviewerStaffId: reviewer.id,
    nextState: nextState as Exclude<RecognitionReviewState, "submitted">,
    ...(coachingNote.trim() ? { coachingNote } : {}),
  });

  if (!result.ok) {
    return {
      formError:
        REJECTION_MESSAGES[result.reason] ?? "That act could not be reviewed.",
    };
  }

  revalidatePath("/staff/recognition");
  return { notice: "Recorded." };
}
