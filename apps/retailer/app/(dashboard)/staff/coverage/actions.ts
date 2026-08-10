"use server";

import { requireRetailerRole } from "@paon/auth";
import {
  CoachingRepository,
  CoveragePlanningRepository,
  RetailerStaffRepository,
} from "@paon/database";
import type {
  CeremonyStep,
  CoachingState,
  CoverageInterval,
} from "@paon/domain";
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

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

const SWAP_REQUEST_ERROR: Readonly<Record<string, string>> = {
  not_own_shift: "You can only offer your own shift.",
  peer_unavailable:
    "Your colleague has not declared availability for that day.",
  peer_already_scheduled: "Your colleague is already scheduled then.",
};

const SWAP_APPROVAL_ERROR: Readonly<Record<string, string>> = {
  not_awaiting_approval: "This swap is not awaiting approval.",
  self_approval_not_allowed:
    "A manager who is party to the swap cannot approve it.",
  would_break_required_skill:
    "Approving this would leave a required skill uncovered.",
};

export async function requestShiftSwap(
  _previous: CoverageActionState,
  formData: FormData,
): Promise<CoverageActionState> {
  const session = await requireModuleSession("retail_operations");
  const shiftId = String(formData.get("shiftId") ?? "").trim();
  const peerStaffId = String(formData.get("peerStaffId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!shiftId || !peerStaffId) {
    return { formError: "Choose a shift and a colleague to swap with." };
  }

  const supabase = await getSupabaseServerClient();
  const viewer = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  if (!viewer) return { formError: "Your staff record could not be found." };
  if (viewer.id === peerStaffId) {
    return { formError: "Choose a colleague other than yourself." };
  }

  const result = await new CoveragePlanningRepository(supabase).requestSwap({
    retailerId: session.retailerId,
    shiftId,
    requestingStaffId: viewer.id,
    peerStaffId,
    ...(reason ? { reason } : {}),
  });
  if (!result.ok) {
    return {
      formError:
        SWAP_REQUEST_ERROR[result.reason] ??
        "That swap could not be requested.",
    };
  }

  revalidatePath("/staff/coverage");
  return { notice: "Swap requested." };
}

export async function respondToShiftSwap(
  _previous: CoverageActionState,
  formData: FormData,
): Promise<CoverageActionState> {
  const session = await requireModuleSession("retail_operations");
  const swapId = String(formData.get("swapId") ?? "").trim();
  const accept = formData.get("decision") === "accept";
  if (!swapId) return { formError: "Choose a swap to respond to." };

  const supabase = await getSupabaseServerClient();
  const viewer = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  if (!viewer) return { formError: "Your staff record could not be found." };

  const repository = new CoveragePlanningRepository(supabase);
  const swap = await repository.findSwapById({
    retailerId: session.retailerId,
    swapId,
  });
  if (!swap) return { formError: "That swap could not be found." };
  if (swap.peer_staff_id !== viewer.id) {
    return { formError: "Only the invited colleague can respond to this." };
  }
  if (swap.state !== "requested") {
    return { formError: "This swap is no longer awaiting your response." };
  }

  await repository.setSwapState({
    retailerId: session.retailerId,
    swapId,
    nextState: accept ? "accepted_by_peer" : "declined",
  });

  revalidatePath("/staff/coverage");
  return { notice: accept ? "Swap accepted." : "Swap declined." };
}

export async function withdrawShiftSwap(
  _previous: CoverageActionState,
  formData: FormData,
): Promise<CoverageActionState> {
  const session = await requireModuleSession("retail_operations");
  const swapId = String(formData.get("swapId") ?? "").trim();
  if (!swapId) return { formError: "Choose a swap to withdraw." };

  const supabase = await getSupabaseServerClient();
  const viewer = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  if (!viewer) return { formError: "Your staff record could not be found." };

  const repository = new CoveragePlanningRepository(supabase);
  const swap = await repository.findSwapById({
    retailerId: session.retailerId,
    swapId,
  });
  if (!swap) return { formError: "That swap could not be found." };
  if (swap.requesting_staff_id !== viewer.id) {
    return { formError: "Only the requester can withdraw this swap." };
  }
  if (swap.state !== "requested" && swap.state !== "accepted_by_peer") {
    return { formError: "This swap can no longer be withdrawn." };
  }

  await repository.setSwapState({
    retailerId: session.retailerId,
    swapId,
    nextState: "withdrawn",
  });

  revalidatePath("/staff/coverage");
  return { notice: "Swap withdrawn." };
}

export async function approveShiftSwap(
  _previous: CoverageActionState,
  formData: FormData,
): Promise<CoverageActionState> {
  const session = await requireModuleSession("retail_operations");
  requireRetailerRole(session.retailerRole, "manager");
  const swapId = String(formData.get("swapId") ?? "").trim();
  if (!swapId) return { formError: "Choose a swap to approve." };

  const supabase = await getSupabaseServerClient();
  const viewer = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  if (!viewer) return { formError: "Your staff record could not be found." };

  const result = await new CoveragePlanningRepository(supabase).approveSwap({
    retailerId: session.retailerId,
    swapId,
    approverStaffId: viewer.id,
  });
  if (!result.ok) {
    return {
      formError:
        SWAP_APPROVAL_ERROR[result.reason] ??
        "That swap could not be approved.",
    };
  }

  revalidatePath("/staff/coverage");
  return { notice: "Swap approved." };
}

export async function declareAvailability(
  _previous: CoverageActionState,
  formData: FormData,
): Promise<CoverageActionState> {
  const session = await requireModuleSession("retail_operations");

  const effectiveOn = String(formData.get("effectiveOn") ?? "").trim();
  const weekday = Number(formData.get("weekday"));
  const startTime = String(formData.get("startTime") ?? "").trim();
  const endTime = String(formData.get("endTime") ?? "").trim();
  const available = formData.get("available") === "true";
  const note = String(formData.get("note") ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveOn)) {
    return { formError: "Choose a valid effective date." };
  }
  if (!WEEKDAYS.includes(weekday)) {
    return { formError: "Choose a day of the week." };
  }
  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
    return { formError: "Choose a start and end time." };
  }
  if (startTime >= endTime) {
    return { formError: "End time must be after start time." };
  }

  const supabase = await getSupabaseServerClient();
  const viewer = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  if (!viewer) return { formError: "Your staff record could not be found." };

  await new CoveragePlanningRepository(supabase).declareAvailability({
    retailerId: session.retailerId,
    staffId: viewer.id,
    effectiveOn,
    weekday,
    startTime,
    endTime,
    available,
    ...(note ? { note } : {}),
  });

  revalidatePath("/staff/coverage");
  return { notice: "Availability saved." };
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

const CEREMONY_ERROR: Readonly<Record<string, string>> = {
  already_published: "This version is already published.",
  no_steps: "Add at least one step.",
  duplicate_step_key: "Two steps cannot share the same key.",
  version_not_incremented: "That version number is not newer than the last.",
};

export async function publishCeremonyVersion(
  _previous: CoverageActionState,
  formData: FormData,
): Promise<CoverageActionState> {
  const session = await requireModuleSession("retail_operations");
  requireRetailerRole(session.retailerRole, "manager");

  const ceremonyKey = String(formData.get("ceremonyKey") ?? "").trim();
  if (!ceremonyKey) return { formError: "Name the ceremony." };

  const steps: CeremonyStep[] = [];
  for (let i = 0; i < 5; i++) {
    const key = String(formData.get(`stepKey${i}`) ?? "").trim();
    const title = String(formData.get(`stepTitle${i}`) ?? "").trim();
    const guidance = String(formData.get(`stepGuidance${i}`) ?? "").trim();
    if (!key && !title && !guidance) continue;
    if (!key || !title || !guidance) {
      return {
        formError: `Step ${i + 1} needs a key, title, and guidance, or leave all three blank to skip it.`,
      };
    }
    steps.push({ key, title, guidance });
  }

  const result = await new CoachingRepository(
    await getSupabaseServerClient(),
  ).publishCeremony({
    retailerId: session.retailerId,
    ceremonyKey,
    steps,
  });
  if (!result.ok) {
    return {
      formError: CEREMONY_ERROR[result.reason] ?? "That could not be published.",
    };
  }

  revalidatePath("/staff/coverage");
  return { notice: `Published version ${result.version}.` };
}
