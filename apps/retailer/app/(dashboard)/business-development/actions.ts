"use server";

import {
  CorporateOpportunityRepository,
  CorporateTenderRepository,
  RetailerStaffRepository,
} from "@paon/database";
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

export async function createTender(formData: FormData): Promise<void> {
  const session = await requireModuleSession("enterprise_verticals");
  const client = await getSupabaseServerClient();
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const title = String(formData.get("title") ?? "");
  const opportunity = await new CorporateOpportunityRepository(client).findById(
    asId<"CorporateOpportunityId">(opportunityId),
  );
  if (!opportunity || opportunity.retailerId !== session.retailerId) return;
  await new CorporateTenderRepository(client).create({
    retailerId: session.retailerId,
    opportunityId,
    opportunityStage: opportunity.stage,
    title,
  });
  revalidatePath(`/business-development/${opportunityId}`);
}

export async function createTenderVersion(formData: FormData): Promise<void> {
  const session = await requireModuleSession("enterprise_verticals");
  const client = await getSupabaseServerClient();
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const tenderId = String(formData.get("tenderId") ?? "");
  const summary = String(formData.get("summary") ?? "");
  const pricingNote = String(formData.get("pricingNote") ?? "");
  const garmentConcepts = String(formData.get("garmentConcepts") ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const staff = await new RetailerStaffRepository(client).findByUserId(
    session.userId,
  );
  await new CorporateTenderRepository(client).createVersion({
    retailerId: session.retailerId,
    tenderId: asId<"CorporateTenderId">(tenderId),
    summary,
    garmentConcepts,
    ...(pricingNote ? { pricingNote } : {}),
    ...(staff ? { createdByStaffId: staff.id } : {}),
  });
  revalidatePath(`/business-development/${opportunityId}`);
}

export async function approveTenderVersion(formData: FormData): Promise<void> {
  const session = await requireModuleSession("enterprise_verticals");
  const client = await getSupabaseServerClient();
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const tenderVersionId = String(formData.get("tenderVersionId") ?? "");
  const staff = await new RetailerStaffRepository(client).findByUserId(
    session.userId,
  );
  if (!staff) return;
  await new CorporateTenderRepository(client).approveVersion({
    retailerId: session.retailerId,
    tenderVersionId: asId<"CorporateTenderVersionId">(tenderVersionId),
    approvedByStaffId: staff.id,
  });
  revalidatePath(`/business-development/${opportunityId}`);
}
