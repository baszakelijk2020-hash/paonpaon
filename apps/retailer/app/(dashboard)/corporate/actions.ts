"use server";

import { CorporateRepository } from "@paon/database";
import {
  checkAccommodationNote,
  checkIssue,
  computeEntitlementBalance,
  createCorporateAccountInputSchema,
  createCorporateEntitlementVersionInputSchema,
  createCorporateExceptionInputSchema,
  createCorporateProgrammeInputSchema,
  createCorporateWearerInputSchema,
  recordCorporateIssueInputSchema,
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
  const values = createCorporateExceptionInputSchema.parse({
    programmeId,
    wearerId,
    kind: formData.get("kind"),
    detail: formData.get("detail"),
  });
  await new CorporateRepository(
    await getSupabaseServerClient(),
  ).createException(session.retailerId, values);
  revalidatePath(`/corporate/${programmeId}`);
}

export async function resolveException(
  programmeId: string,
  exceptionId: string,
): Promise<void> {
  await requireModuleSession("enterprise_verticals");
  await new CorporateRepository(
    await getSupabaseServerClient(),
  ).resolveException(exceptionId);
  revalidatePath(`/corporate/${programmeId}`);
}
