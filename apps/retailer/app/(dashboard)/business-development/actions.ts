"use server";

import { CorporateOpportunityRepository } from "@paon/database";
import {
  asId,
  CORPORATE_OPPORTUNITY_SIGNAL_SOURCES,
  type CorporateOpportunitySignalSource,
  type CorporateOpportunityStage,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function createOpportunity(formData: FormData): Promise<void> {
  const session = await requireModuleSession("enterprise_verticals");
  const companyName = String(formData.get("companyName") ?? "");
  await new CorporateOpportunityRepository(
    await getSupabaseServerClient(),
  ).create({ retailerId: session.retailerId, companyName });
  revalidatePath("/business-development");
}

function parseSignalSource(value: FormDataEntryValue | null) {
  const source = String(value ?? "");
  return CORPORATE_OPPORTUNITY_SIGNAL_SOURCES.includes(
    source as CorporateOpportunitySignalSource,
  )
    ? (source as CorporateOpportunitySignalSource)
    : "other";
}

export async function addSignal(formData: FormData): Promise<void> {
  const session = await requireModuleSession("enterprise_verticals");
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const detail = String(formData.get("detail") ?? "");
  const source = parseSignalSource(formData.get("source"));
  await new CorporateOpportunityRepository(
    await getSupabaseServerClient(),
  ).addSignal({
    retailerId: session.retailerId,
    opportunityId: asId<"CorporateOpportunityId">(opportunityId),
    source,
    detail,
  });
  revalidatePath(`/business-development/${opportunityId}`);
}

export async function transitionStage(formData: FormData): Promise<void> {
  const session = await requireModuleSession("enterprise_verticals");
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const to = String(formData.get("to") ?? "") as CorporateOpportunityStage;
  await new CorporateOpportunityRepository(
    await getSupabaseServerClient(),
  ).transitionStage({
    retailerId: session.retailerId,
    opportunityId: asId<"CorporateOpportunityId">(opportunityId),
    to,
  });
  revalidatePath(`/business-development/${opportunityId}`);
  revalidatePath("/business-development");
}

export async function winOpportunity(formData: FormData): Promise<void> {
  const session = await requireModuleSession("enterprise_verticals");
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const accountReference = String(formData.get("accountReference") ?? "");
  await new CorporateOpportunityRepository(
    await getSupabaseServerClient(),
  ).winAndCreateAccount({
    retailerId: session.retailerId,
    opportunityId: asId<"CorporateOpportunityId">(opportunityId),
    accountReference,
  });
  revalidatePath(`/business-development/${opportunityId}`);
  revalidatePath("/business-development");
  revalidatePath("/corporate");
}
