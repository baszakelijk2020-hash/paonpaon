"use server";

import { CorporateRepository } from "@paon/database";
import {
  asId,
  checkAccommodationNote,
  createCorporateAccountInputSchema,
  createCorporateProgrammeInputSchema,
  createCorporateEntitlementVersionInputSchema,
  createCorporateWearerInputSchema,
} from "@paon/domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

async function requireOwnedProgramme(
  repo: CorporateRepository,
  programmeId: string,
  retailerId: string,
) {
  const programme = await repo.findProgrammeById(programmeId);
  if (!programme || programme.retailerId !== retailerId) {
    throw new Error("Programme not found.");
  }
  return programme;
}

export async function startWizard(formData: FormData): Promise<void> {
  const session = await requireModuleSession("enterprise_verticals");
  const repo = new CorporateRepository(await getSupabaseServerClient());

  const accountChoice = formData.get("accountChoice");
  let accountId: string;

  if (accountChoice === "new") {
    const legalName = formData.get("newAccountLegalName") as string;
    const accountReference = formData.get("newAccountReference") as string;
    const values = createCorporateAccountInputSchema.parse({
      legalName,
      accountReference,
    });
    const account = await repo.createAccount(session.retailerId, values);
    accountId = account.id;
  } else {
    const existingAccountId = formData.get("existingAccountId") as string;
    const account = await repo.findAccountById(
      asId<"CorporateAccountId">(existingAccountId),
    );
    if (!account || account.retailerId !== session.retailerId) {
      throw new Error("Account not found.");
    }
    accountId = account.id;
  }

  const siteKeys = (formData.get("siteKeys") as string | null)
    ?.split(",")
    .map((key) => key.trim())
    .filter(Boolean);

  const values = createCorporateProgrammeInputSchema.parse({
    accountId,
    name: formData.get("programmeName"),
    siteKeys: siteKeys ?? [],
  });

  const programme = await repo.createProgramme(session.retailerId, values);

  redirect(`/corporate/setup-wizard/${programme.id}?step=roles`);
}

export async function saveRoles(
  programmeId: string,
  formData: FormData,
): Promise<void> {
  const session = await requireModuleSession("enterprise_verticals");
  const repo = new CorporateRepository(await getSupabaseServerClient());
  await requireOwnedProgramme(repo, programmeId, session.retailerId);

  const rulesJson = formData.get("rules");
  const rules = JSON.parse(String(rulesJson ?? "[]"));

  const today = new Date().toISOString().split("T")[0];

  const values = createCorporateEntitlementVersionInputSchema.parse({
    programmeId,
    effectiveFrom: today,
    rules,
  });

  await repo.createEntitlementVersion(session.retailerId, values);

  redirect(`/corporate/setup-wizard/${programmeId}?step=employees`);
}

export async function addEmployee(
  programmeId: string,
  formData: FormData,
): Promise<void> {
  const session = await requireModuleSession("enterprise_verticals");
  const repo = new CorporateRepository(await getSupabaseServerClient());
  await requireOwnedProgramme(repo, programmeId, session.retailerId);

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

  await repo.createWearer(session.retailerId, values);

  revalidatePath(`/corporate/setup-wizard/${programmeId}`);
}
