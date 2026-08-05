"use server";

import {
  CitedRecommendationRepository,
  CorporateOfficeVisitRepository,
  CorporateRepository,
  CorporateRolloutRepository,
} from "@paon/database";
import {
  asId,
  checkAccommodationNote,
  checkIssue,
  computeEntitlementBalance,
  CORPORATE_EXCEPTION_PRIORITIES,
  createCorporateAccountInputSchema,
  createCorporateEntitlementVersionInputSchema,
  createCorporateExceptionInputSchema,
  createCorporateProgrammeInputSchema,
  createCorporateWearerInputSchema,
  recordCorporateIssueInputSchema,
  wallTimeInZoneToUtcIso,
  type CorporateExceptionPriority,
  type CorporateOfficeVisitRequestStatus,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function createAccount(formData: FormData): Promise<void> {
  const session = await requireModuleSession("enterprise_verticals");
  const values = createCorporateAccountInputSchema.parse({
    legalName: formData.get("legalName"),
    accountReference: formData.get("accountReference"),
  });
  await new CorporateRepository(await getSupabaseServerClient()).createAccount(
    session.retailerId,
    values,
  );
  revalidatePath("/corporate");
}

export async function createProgramme(formData: FormData): Promise<void> {
  const session = await requireModuleSession("enterprise_verticals");
  const siteKeys = (formData.get("siteKeys") as string | null)
    ?.split(",")
    .map((key) => key.trim())
    .filter(Boolean);
  const values = createCorporateProgrammeInputSchema.parse({
    accountId: formData.get("accountId"),
    name: formData.get("name"),
    siteKeys: siteKeys ?? [],
  });
  await new CorporateRepository(
    await getSupabaseServerClient(),
  ).createProgramme(session.retailerId, values);
  revalidatePath("/corporate");
}

export async function createEntitlementVersion(
  programmeId: string,
  formData: FormData,
): Promise<void> {
  const session = await requireModuleSession("enterprise_verticals");
  const rulesJson = formData.get("rules");
  const rules = JSON.parse(String(rulesJson ?? "[]"));
  const values = createCorporateEntitlementVersionInputSchema.parse({
    programmeId,
    effectiveFrom: formData.get("effectiveFrom"),
    rules,
  });
  await new CorporateRepository(
    await getSupabaseServerClient(),
  ).createEntitlementVersion(session.retailerId, values);
  revalidatePath(`/corporate/${programmeId}`);
}

export async function createWearer(
  programmeId: string,
  formData: FormData,
): Promise<void> {
  const session = await requireModuleSession("enterprise_verticals");
  const adaptationNote = (
    formData.get("garmentAdaptationNote") as string | null
  )?.trim();
  if (adaptationNote) {
    const check = checkAccommodationNote(adaptationNote);
    if (!check.ok) {
      throw new Error(
        check.reason === "looks_like_health_data"
          ? 'That reads like health information — describe the garment adaptation only (e.g. "left sleeve +40mm"), not the reason.'
          : "Enter the garment adaptation, or leave it blank.",
      );
    }
  }
  const values = createCorporateWearerInputSchema.parse({
    programmeId,
    employeeReference: formData.get("employeeReference"),
    displayName: formData.get("displayName"),
    roleKey: formData.get("roleKey"),
    siteKey: (formData.get("siteKey") as string | null) || undefined,
    joinedOn: formData.get("joinedOn"),
    garmentAdaptationNote: adaptationNote || undefined,
  });
  await new CorporateRepository(await getSupabaseServerClient()).createWearer(
    session.retailerId,
    values,
  );
  revalidatePath(`/corporate/${programmeId}`);
}

export async function setWearerActive(
  programmeId: string,
  wearerId: string,
  active: boolean,
): Promise<void> {
  await requireModuleSession("enterprise_verticals");
  await new CorporateRepository(
    await getSupabaseServerClient(),
  ).setWearerActive(wearerId, active);
  revalidatePath(`/corporate/${programmeId}`);
}

/** Grants (a non-empty email) or revokes (empty submission) Employee
 * Portal login access — see PHASE 18.5. */
export async function setWearerLoginEmail(
  programmeId: string,
  wearerId: string,
  formData: FormData,
): Promise<void> {
  await requireModuleSession("enterprise_verticals");
  const raw = String(formData.get("loginEmail") ?? "").trim();
  await new CorporateRepository(
    await getSupabaseServerClient(),
  ).setWearerLoginEmail(wearerId, raw.length > 0 ? raw : null);
  revalidatePath(`/corporate/${programmeId}`);
}

export async function recordIssue(
  programmeId: string,
  formData: FormData,
): Promise<void> {
  const session = await requireModuleSession("enterprise_verticals");
  const values = recordCorporateIssueInputSchema.parse({
    wearerId: formData.get("wearerId"),
    entitlementVersionId: formData.get("entitlementVersionId"),
    garmentKey: formData.get("garmentKey"),
    quantity: Number(formData.get("quantity")),
    issuedOn: formData.get("issuedOn"),
  });

  const repo = new CorporateRepository(await getSupabaseServerClient());
  const [programme, wearer, version, issues] = await Promise.all([
    repo.findProgrammeById(programmeId),
    repo.findWearerById(values.wearerId),
    repo.findLatestEntitlementVersion(programmeId),
    repo.findIssuesByWearer(values.wearerId),
  ]);
  if (!programme || !wearer || !version) {
    throw new Error("Programme, wearer or entitlement version not found.");
  }
  const balances = computeEntitlementBalance({
    version: {
      versionId: version.id,
      version: version.version,
      effectiveFrom: version.effectiveFrom,
      rules: version.rules,
    },
    roleKey: wearer.roleKey,
    joinedOn: wearer.joinedOn,
    issues,
    asOf: values.issuedOn,
  });
  const check = checkIssue({
    balances,
    garmentKey: values.garmentKey,
    quantity: values.quantity,
    wearerActive: wearer.active,
    programmeActive: programme.active,
  });
  if (!check.ok) {
    const reasonLabel: Record<typeof check.reason, string> = {
      not_entitled_to_garment: "This role is not entitled to that garment.",
      entitlement_exhausted: `Only ${check.remaining ?? 0} remaining under this entitlement.`,
      wearer_not_active: "This wearer is not active.",
      programme_not_active: "This programme is not active.",
    };
    throw new Error(reasonLabel[check.reason]);
  }

  await repo.recordIssue(session.retailerId, values);
  revalidatePath(`/corporate/${programmeId}`);
}

export async function createException(
  programmeId: string,
  formData: FormData,
): Promise<void> {
  const session = await requireModuleSession("enterprise_verticals");
  const wearerId = (formData.get("wearerId") as string | null) || undefined;
  const priorityRaw = formData.get("priority");
  const values = createCorporateExceptionInputSchema.parse({
    programmeId,
    wearerId,
    kind: formData.get("kind"),
    detail: formData.get("detail"),
    priority: priorityRaw ? priorityRaw : undefined,
  });
  await new CorporateRepository(
    await getSupabaseServerClient(),
  ).createException(session.retailerId, values);
  revalidatePath(`/corporate/${programmeId}`);
}

export async function assignExceptionToStaff(
  programmeId: string,
  formData: FormData,
): Promise<void> {
  const session = await requireModuleSession("enterprise_verticals");
  const exceptionId = String(formData.get("exceptionId") ?? "");
  const staffId = String(formData.get("staffId") ?? "");
  if (!exceptionId || !staffId) return;
  await new CorporateRepository(
    await getSupabaseServerClient(),
  ).assignException({ retailerId: session.retailerId, exceptionId, staffId });
  revalidatePath(`/corporate/${programmeId}`);
}

export async function changeExceptionPriority(
  programmeId: string,
  formData: FormData,
): Promise<void> {
  const session = await requireModuleSession("enterprise_verticals");
  const exceptionId = String(formData.get("exceptionId") ?? "");
  const priority = String(formData.get("priority") ?? "");
  if (
    !exceptionId ||
    !CORPORATE_EXCEPTION_PRIORITIES.includes(
      priority as CorporateExceptionPriority,
    )
  ) {
    return;
  }
  await new CorporateRepository(
    await getSupabaseServerClient(),
  ).changeExceptionPriority({
    retailerId: session.retailerId,
    exceptionId,
    priority: priority as CorporateExceptionPriority,
  });
  revalidatePath(`/corporate/${programmeId}`);
}

export async function resolveException(
  programmeId: string,
  exceptionId: string,
): Promise<void> {
  const session = await requireModuleSession("enterprise_verticals");
  await new CorporateRepository(
    await getSupabaseServerClient(),
  ).resolveException(exceptionId, session.retailerId);
  revalidatePath(`/corporate/${programmeId}`);
}

export async function resolveOfficeVisitRequest(
  programmeId: string,
  requestId: string,
  status: Extract<
    CorporateOfficeVisitRequestStatus,
    "contacted" | "scheduled" | "declined"
  >,
): Promise<void> {
  await requireModuleSession("enterprise_verticals");
  await new CorporateOfficeVisitRepository(
    await getSupabaseServerClient(),
  ).resolve({
    requestId: asId<"CorporateOfficeVisitRequestId">(requestId),
    status,
  });
  revalidatePath(`/corporate/${programmeId}`);
}

const SCHEDULE_APPOINTMENT_REJECTION_MESSAGES: Record<string, string> = {
  already_resolved: "This request was already resolved.",
  request_not_found: "That request no longer exists.",
  contact_email_required:
    "This requester left no contact email — mark it Scheduled without an appointment instead.",
  invalid_time_window: "Choose a real end time after the start time.",
};

/**
 * Closes 18.4's own named gap: a real appointment, not just a status
 * label. `DateTimePicker` submits an offset-less wall-clock value
 * (`YYYY-MM-DDTHH:MM`) — interpreted in UTC since an office-visit
 * request has no branch/timezone of its own, matching this app's own
 * fallback for every other timezone-less booking surface.
 */
export async function scheduleOfficeVisitAppointment(
  programmeId: string,
  requestId: string,
  formData: FormData,
): Promise<void> {
  await requireModuleSession("enterprise_verticals");
  const startsAtLocal = String(formData.get("startsAt") ?? "");
  const endsAtLocal = String(formData.get("endsAt") ?? "");
  const [startDate, startTime] = startsAtLocal.split("T");
  const [endDate, endTime] = endsAtLocal.split("T");
  if (!startDate || !startTime || !endDate || !endTime) {
    throw new Error("Choose a day and a time for both start and end.");
  }
  const startsAt = wallTimeInZoneToUtcIso(
    startDate,
    startTime.slice(0, 5),
    "UTC",
  );
  const endsAt = wallTimeInZoneToUtcIso(endDate, endTime.slice(0, 5), "UTC");

  const result = await new CorporateOfficeVisitRepository(
    await getSupabaseServerClient(),
  ).scheduleAppointment({
    requestId: asId<"CorporateOfficeVisitRequestId">(requestId),
    startsAt,
    endsAt,
  });
  if (!result.ok) {
    throw new Error(
      SCHEDULE_APPOINTMENT_REJECTION_MESSAGES[result.reason] ??
        "That appointment could not be scheduled.",
    );
  }
  revalidatePath(`/corporate/${programmeId}`);
}

export async function createRolloutDay(
  programmeId: string,
  formData: FormData,
): Promise<void> {
  const session = await requireModuleSession("enterprise_verticals");
  const fittingDate = String(formData.get("fittingDate") ?? "");
  const capacity = Number(formData.get("capacity"));
  const advisorNote = String(formData.get("advisorNote") ?? "").trim();
  const siteKey = String(formData.get("siteKey") ?? "").trim();
  if (!fittingDate || !Number.isFinite(capacity) || capacity <= 0) {
    throw new Error("Enter a date and a capacity greater than zero.");
  }
  await new CorporateRolloutRepository(
    await getSupabaseServerClient(),
  ).createDay({
    retailerId: session.retailerId,
    programmeId: asId<"CorporateProgrammeId">(programmeId),
    fittingDate,
    capacity,
    ...(advisorNote ? { advisorNote } : {}),
    ...(siteKey ? { siteKey } : {}),
  });
  revalidatePath(`/corporate/${programmeId}`);
}

const ASSIGN_REJECTION_MESSAGES: Record<string, string> = {
  day_at_capacity: "That day is already at capacity.",
  site_mismatch: "That wearer's site does not match this day's site.",
};

export async function assignWearerToRolloutDay(
  programmeId: string,
  formData: FormData,
): Promise<void> {
  const session = await requireModuleSession("enterprise_verticals");
  const client = await getSupabaseServerClient();
  const rolloutDayId = String(formData.get("rolloutDayId") ?? "");
  const wearerId = String(formData.get("wearerId") ?? "");
  const capacity = Number(formData.get("capacity"));
  const daySiteKey = String(formData.get("daySiteKey") ?? "").trim();
  if (!rolloutDayId || !wearerId) return;
  // Re-derived server-side from the real wearer row, never trusted from
  // the form — the same "never trust caller input for an authorization
  // check" discipline used throughout this stage.
  const wearer = await new CorporateRepository(client).findWearerById(wearerId);
  const result = await new CorporateRolloutRepository(client).assignWearer({
    retailerId: session.retailerId,
    rolloutDayId: asId<"CorporateRolloutDayId">(rolloutDayId),
    wearerId,
    capacity,
    ...(daySiteKey ? { daySiteKey } : {}),
    ...(wearer?.siteKey ? { wearerSiteKey: wearer.siteKey } : {}),
  });
  if (!result.ok) {
    throw new Error(
      ASSIGN_REJECTION_MESSAGES[result.reason] ??
        "That wearer could not be assigned.",
    );
  }
  revalidatePath(`/corporate/${programmeId}`);
}

export async function markRolloutSlotCompleted(
  programmeId: string,
  slotId: string,
): Promise<void> {
  await requireModuleSession("enterprise_verticals");
  await new CorporateRolloutRepository(
    await getSupabaseServerClient(),
  ).markCompleted(asId<"CorporateRolloutSlotId">(slotId));
  revalidatePath(`/corporate/${programmeId}`);
}

export async function markRolloutSlotNoShow(
  programmeId: string,
  slotId: string,
): Promise<void> {
  const session = await requireModuleSession("enterprise_verticals");
  // Reslot failure (no day has spare capacity) is a real, visible gap in
  // the plan, not an error — the no-show is still recorded either way,
  // so this never throws on that path.
  await new CorporateRolloutRepository(
    await getSupabaseServerClient(),
  ).markNoShowAndReslot({
    retailerId: session.retailerId,
    slotId: asId<"CorporateRolloutSlotId">(slotId),
    programmeId: asId<"CorporateProgrammeId">(programmeId),
  });
  revalidatePath(`/corporate/${programmeId}`);
}

export async function recomputeRenewalRisk(programmeId: string): Promise<void> {
  const session = await requireModuleSession("enterprise_verticals");
  await new CitedRecommendationRepository(
    await getSupabaseServerClient(),
  ).computeCorporateRenewalRisk({
    retailerId: session.retailerId,
    programmeId,
  });
  revalidatePath(`/corporate/${programmeId}`);
}

export async function resolveRenewalTask(
  programmeId: string,
  taskId: string,
): Promise<void> {
  await requireModuleSession("enterprise_verticals");
  await new CorporateRepository(
    await getSupabaseServerClient(),
  ).resolveRenewalTask(taskId);
  revalidatePath(`/corporate/${programmeId}`);
}
