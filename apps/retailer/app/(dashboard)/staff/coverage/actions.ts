"use server";

import { requireRetailerRole } from "@paon/auth";
import {
  CoachingRepository,
  CoveragePlanningRepository,
  RetailerStaffRepository,
} from "@paon/database";
import type { CoachingState, CoverageInterval } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface CoverageActionState {
  readonly formError?: string;
  readonly notice?: string;
}

function readHeadcount(formData: FormData, key: string): number {
  const value = Number(formData.get(key) ?? 0);
  return Number.isInteger(value) && value >= 0 ? value : -1;
}

export async function publishCoveragePlan(
  _previous: CoverageActionState,
  formData: FormData,
): Promise<CoverageActionState> {
  const session = await requireModuleSession("retail_operations");
  requireRetailerRole(session.retailerRole, "manager");

  const planDate = String(formData.get("planDate") ?? "").trim();
  const morningHeadcount = readHeadcount(formData, "morningHeadcount");
  const afternoonHeadcount = readHeadcount(formData, "afternoonHeadcount");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(planDate)) {
    return { formError: "Choose a valid coverage date." };
  }
  if (morningHeadcount < 0 || afternoonHeadcount < 0) {
    return { formError: "Headcount must be a whole number of zero or more." };
  }

  const intervals: CoverageInterval[] = [];
  const addInterval = (
    startTime: string,
    endTime: string,
    requiredHeadcount: number,
    skillKey: string,
  ) => {
    if (requiredHeadcount === 0) return;
    const skill = String(formData.get(skillKey) ?? "").trim();
    intervals.push({
      startTime,
      endTime,
      requiredHeadcount,
      ...(skill ? { requiredSkills: [skill] } : {}),
    });
  };
  addInterval("10:00", "14:00", morningHeadcount, "morningSkill");
  addInterval("14:00", "18:00", afternoonHeadcount, "afternoonSkill");
  if (intervals.length === 0) {
    return { formError: "Add at least one coverage requirement." };
  }

  const supabase = await getSupabaseServerClient();
  const viewer = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  if (!viewer) return { formError: "Your staff record could not be found." };

  const repository = new CoveragePlanningRepository(supabase);
  const plan = await repository.saveDraftPlan({
    retailerId: session.retailerId,
    planDate,
    timezone: "Europe/Amsterdam",
    intervals,
  });
  await repository.publishPlan({
    retailerId: session.retailerId,
    planId: plan.id,
    publishedByStaffId: viewer.id,
  });

  revalidatePath("/staff/coverage");
  return { notice: "Coverage requirement published." };
}

export async function recordCoachingObservation(
  _previous: CoverageActionState,
  formData: FormData,
): Promise<CoverageActionState> {
  const session = await requireModuleSession("retail_operations");
  requireRetailerRole(session.retailerRole, "manager");
  const observedStaffId = String(formData.get("observedStaffId") ?? "");
  const evidence = String(formData.get("evidence") ?? "").trim();
  const observedOn = String(formData.get("observedOn") ?? "").trim();
  if (!observedStaffId || !/^\d{4}-\d{2}-\d{2}$/.test(observedOn)) {
    return { formError: "Choose a colleague and observation date." };
  }

  const supabase = await getSupabaseServerClient();
  const viewer = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  if (!viewer) return { formError: "Your staff record could not be found." };

  const result = await new CoachingRepository(supabase).recordObservation({
    retailerId: session.retailerId,
    observedStaffId,
    observerStaffId: viewer.id,
    observedOn,
    scores: [{ criterionKey: "service_ceremony", score: 3, evidence }],
  });
  if (!result.ok) {
    const message =
      result.reason === "self_observation_not_allowed"
        ? "Choose a colleague other than yourself."
        : "Describe what you actually saw in enough detail to coach from.";
    return { formError: message };
  }

  revalidatePath("/staff/coverage");
  return { notice: "Observation recorded." };
}

const COACHING_ERROR: Readonly<Record<string, string>> = {
  out_of_order_transition: "This coaching step is no longer current.",
  plan_requires_agreed_action: "A plan needs an action you both agreed.",
  outcome_requires_plan: "Record what changed before closing the loop.",
};

export async function advanceCoachingLoop(
  _previous: CoverageActionState,
  formData: FormData,
): Promise<CoverageActionState> {
  const session = await requireModuleSession("retail_operations");
  requireRetailerRole(session.retailerRole, "manager");
  const observationId = String(formData.get("observationId") ?? "");
  const next = String(formData.get("next") ?? "") as CoachingState;
  if (
    !observationId ||
    !["discussed", "plan_agreed", "outcome_recorded"].includes(next)
  ) {
    return { formError: "That coaching step is invalid." };
  }

  const agreedAction = String(formData.get("agreedAction") ?? "");
  const outcomeNote = String(formData.get("outcomeNote") ?? "");
  const result = await new CoachingRepository(
    await getSupabaseServerClient(),
  ).advanceLoop({
    retailerId: session.retailerId,
    observationId,
    next,
    ...(agreedAction.trim() ? { agreedAction } : {}),
    ...(outcomeNote.trim() ? { outcomeNote } : {}),
  });
  if (!result.ok) {
    return {
      formError:
        COACHING_ERROR[result.reason] ?? "That step could not be saved.",
    };
  }

  revalidatePath("/staff/coverage");
  return { notice: "Coaching loop updated." };
}
