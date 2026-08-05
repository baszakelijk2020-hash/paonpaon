"use server";

import { requireRetailerRole } from "@paon/auth";
import {
  AcademyRepository,
  InternalCommunityRepository,
  RetailerStaffRepository,
} from "@paon/database";
import {
  ACADEMY_ROLEPLAY_PERSONAS,
  type AcademyRoleplayPersona,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface LearningActionState {
  formError?: string;
  notice?: string;
}

const SUBMIT_REJECTION_MESSAGES: Record<string, string> = {
  approved_version_is_immutable:
    "An approved contribution can't be edited — submit an improvement under the same title and it becomes the next version.",
  body_too_short:
    "Write at least a few sentences (40 characters) — enough for someone else to actually learn from it.",
  version_not_incremented:
    "You already have an approved version of this title.",
};

const MODERATION_REJECTION_MESSAGES: Record<string, string> = {
  self_moderation_not_allowed: "You can't moderate your own contribution.",
  not_awaiting_moderation:
    "This contribution is no longer awaiting a decision.",
  rejection_requires_reason:
    "Say why, so the author knows what to improve — an anonymous rejection teaches nothing.",
};

export async function submitContribution(
  _previous: LearningActionState,
  formData: FormData,
): Promise<LearningActionState> {
  const session = await requireModuleSession("retail_operations", "mutate");
  const supabase = await getSupabaseServerClient();
  const author = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  if (!author) {
    return { formError: "Your staff record could not be found." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (title.length < 3) {
    return { formError: "Give it a title of at least 3 characters." };
  }

  const result = await new InternalCommunityRepository(
    supabase,
  ).submitContribution({
    retailerId: session.retailerId,
    authorStaffId: author.id,
    title,
    body,
  });
  if (!result.ok) {
    return {
      formError:
        SUBMIT_REJECTION_MESSAGES[result.reason] ??
        "That contribution could not be submitted.",
    };
  }

  revalidatePath("/staff/learning");
  return { notice: "Submitted for review." };
}

export async function moderateContribution(
  _previous: LearningActionState,
  formData: FormData,
): Promise<LearningActionState> {
  const session = await requireModuleSession("retail_operations", "mutate");
  requireRetailerRole(session.retailerRole, "manager");

  const supabase = await getSupabaseServerClient();
  const moderator = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  if (!moderator) {
    return { formError: "Your staff record could not be found." };
  }

  const contributionId = String(formData.get("contributionId") ?? "").trim();
  const nextState = String(formData.get("nextState") ?? "");
  const moderationNote = String(formData.get("moderationNote") ?? "").trim();
  if (nextState !== "approved" && nextState !== "rejected") {
    return { formError: "Invalid decision." };
  }

  const result = await new InternalCommunityRepository(
    supabase,
  ).moderateContribution({
    retailerId: session.retailerId,
    contributionId,
    moderatorStaffId: moderator.id,
    nextState,
    ...(moderationNote ? { moderationNote } : {}),
  });
  if (!result.ok) {
    return {
      formError:
        MODERATION_REJECTION_MESSAGES[result.reason] ??
        "Could not record that decision.",
    };
  }

  revalidatePath("/staff/learning");
  return {
    notice: nextState === "approved" ? "Approved and published." : "Rejected.",
  };
}

const GRADE_REJECTION_MESSAGES: Record<string, string> = {
  no_criteria: "Add at least one criterion.",
  grade_without_evidence:
    "Describe what was actually observed — at least 10 characters. Ungrounded feedback teaches nothing.",
  evidence_ref_required: "Cite where this was observed.",
  self_grading_not_permitted: "You can't grade your own roleplay.",
};

/**
 * A manager records a graded roleplay observation, always citing evidence.
 * `academy_roleplay_grades` is append-only, so there is no edit action —
 * a mistaken grade is corrected by recording a new one, not editing history.
 */
export async function recordRoleplayGrade(
  _previous: LearningActionState,
  formData: FormData,
): Promise<LearningActionState> {
  const session = await requireModuleSession("retail_operations", "mutate");
  requireRetailerRole(session.retailerRole, "manager");

  const supabase = await getSupabaseServerClient();
  const grader = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  if (!grader) {
    return { formError: "Your staff record could not be found." };
  }

  const staffId = String(formData.get("staffId") ?? "").trim();
  const lessonKey = String(formData.get("lessonKey") ?? "").trim();
  const criterionKey = String(formData.get("criterionKey") ?? "").trim();
  const evidenceRef = String(formData.get("evidenceRef") ?? "").trim();
  const observedBehaviour = String(
    formData.get("observedBehaviour") ?? "",
  ).trim();
  const personaKeyRaw = String(formData.get("personaKey") ?? "").trim();
  const personaKey = ACADEMY_ROLEPLAY_PERSONAS.includes(
    personaKeyRaw as AcademyRoleplayPersona,
  )
    ? (personaKeyRaw as AcademyRoleplayPersona)
    : undefined;
  if (!staffId || !lessonKey) {
    return { formError: "Choose a staff member and name the lesson." };
  }

  const result = await new AcademyRepository(supabase).recordRoleplayGrade({
    retailerId: session.retailerId,
    staffId,
    lessonKey,
    evidence: [{ criterionKey, evidenceRef, observedBehaviour }],
    gradedByStaffId: grader.id,
    ...(personaKey ? { personaKey } : {}),
  });
  if (!result.ok) {
    return {
      formError:
        GRADE_REJECTION_MESSAGES[result.reason] ??
        "That grade could not be recorded.",
    };
  }

  revalidatePath("/staff/learning");
  return { notice: "Grade recorded." };
}
