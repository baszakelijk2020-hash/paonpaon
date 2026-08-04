"use server";

import { runConceptGenerationJob } from "@paon/ai";
import {
  AIGenerationRepository,
  CorporateConceptAssetRepository,
  CorporateOpportunityRepository,
  CorporateProjectRepository,
  CorporateTenderRepository,
  RetailerRepository,
  RetailerStaffRepository,
} from "@paon/database";
import {
  asId,
  CORPORATE_OPPORTUNITY_SIGNAL_SOURCES,
  type CorporateOpportunitySignalSource,
  type CorporateOpportunityStage,
  type CorporateProjectStage,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { getAIProvider } from "@/lib/ai";
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
  const citationUrl = String(formData.get("citationUrl") ?? "").trim();
  await new CorporateOpportunityRepository(
    await getSupabaseServerClient(),
  ).addSignal({
    retailerId: session.retailerId,
    opportunityId: asId<"CorporateOpportunityId">(opportunityId),
    source,
    ...(citationUrl ? { citationUrl } : {}),
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

/**
 * The manual half of PHASE 18.7's lifecycle state machine: for the
 * checkpoints with no other real-world trigger (award through launch),
 * a staff member is the caller who decides the project is ready to
 * move — with an audit trail (`CorporateProjectRepository.advanceStage`
 * records who and, optionally, why). `opportunity` -> `tender` and
 * `tender` -> `award` are NOT offered through this action — those fire
 * automatically from authoring a tender and winning the opportunity, so
 * a manual button here would let a stage be claimed without the real
 * event that stage is supposed to represent ever happening.
 */
export async function advanceProjectStage(formData: FormData): Promise<void> {
  const session = await requireModuleSession("enterprise_verticals");
  const client = await getSupabaseServerClient();
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const to = String(formData.get("to") ?? "") as CorporateProjectStage;
  const note = String(formData.get("note") ?? "");
  const staff = await new RetailerStaffRepository(client).findByUserId(
    session.userId,
  );
  await new CorporateProjectRepository(client).advanceStage({
    retailerId: session.retailerId,
    opportunityId: asId<"CorporateOpportunityId">(opportunityId),
    to,
    ...(note.trim() ? { note } : {}),
    ...(staff ? { staffId: staff.id } : {}),
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

/**
 * PHASE 18.10: requests a concept/moodboard image for one tender
 * version. When no AI image provider is configured in this environment
 * (`getAIProvider()` returns `null` — the same honest carve-out already
 * used for import enrichment) this records a real `failed`
 * `ai_generations` row and creates no asset, rather than fabricating an
 * image. On success, a new `corporate_concept_assets` row starts
 * `pending_approval` — it never becomes visible on 18.3's public page
 * until `decideConceptAsset` approves it.
 */
export async function generateConceptImages(formData: FormData): Promise<void> {
  const session = await requireModuleSession("enterprise_verticals");
  const client = await getSupabaseServerClient();
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const tenderVersionId = String(formData.get("tenderVersionId") ?? "");
  const tenderTitle = String(formData.get("tenderTitle") ?? "");
  const garmentConcepts = String(formData.get("garmentConcepts") ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const generationRepo = new AIGenerationRepository(client);
  const provider = getAIProvider();
  if (!provider) {
    await generationRepo.record({
      retailerId: session.retailerId,
      kind: "corporate_concept",
      status: "failed",
      provider: "none",
      model: "none",
      inputSummary: `Concept images for tender version ${tenderVersionId}`,
      errorMessage:
        "AI concept generation is not configured on this deployment (missing OPENAI_API_KEY).",
    });
    revalidatePath(`/business-development/${opportunityId}`);
    return;
  }

  const retailer = await new RetailerRepository(client).findById(
    session.retailerId,
  );
  const result = await runConceptGenerationJob(provider, {
    retailerName: retailer?.displayName ?? "PAON retailer",
    tenderTitle,
    garmentConcepts,
  });

  if (!result.ok) {
    await generationRepo.record({
      retailerId: session.retailerId,
      kind: "corporate_concept",
      status: "failed",
      provider: result.provider,
      model: result.model,
      inputSummary: `Concept images for tender version ${tenderVersionId}`,
      errorMessage: result.errorMessage,
      latencyMs: result.latencyMs,
    });
    revalidatePath(`/business-development/${opportunityId}`);
    return;
  }

  const generation = await generationRepo.record({
    retailerId: session.retailerId,
    kind: "corporate_concept",
    status: "succeeded",
    provider: result.provider,
    model: result.model,
    inputSummary: `Concept images for tender version ${tenderVersionId}`,
    output: { images: result.result.images },
    latencyMs: result.latencyMs,
  });

  const assetRepo = new CorporateConceptAssetRepository(client);
  for (const image of result.result.images) {
    await assetRepo.create({
      retailerId: session.retailerId,
      tenderVersionId: asId<"CorporateTenderVersionId">(tenderVersionId),
      aiGenerationId: generation.id,
      imageUrl: image.imageUrl,
      prompt: image.revisedPrompt,
    });
  }
  revalidatePath(`/business-development/${opportunityId}`);
}

/** One-time decision (approve/reject) — see `checkDecideConceptAsset`.
 * Approving is the only action that lets `resolve_corporate_tender`
 * (18.3) ever surface this image externally. */
export async function decideConceptAsset(formData: FormData): Promise<void> {
  const session = await requireModuleSession("enterprise_verticals");
  const client = await getSupabaseServerClient();
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const assetId = String(formData.get("assetId") ?? "");
  const decision = String(formData.get("decision") ?? "") as
    "approved" | "rejected";
  const staff = await new RetailerStaffRepository(client).findByUserId(
    session.userId,
  );
  if (!staff) return;
  await new CorporateConceptAssetRepository(client).decide({
    assetId: asId<"CorporateConceptAssetId">(assetId),
    decision,
    staffId: staff.id,
  });
  revalidatePath(`/business-development/${opportunityId}`);
}

/** PHASE 18.3's named gap, closed: a one-way revocation — see
 * `checkRevokeTender`. Once revoked, `resolve_corporate_tender` refuses
 * ALL content for this tender, approved or not. */
export async function revokeTender(formData: FormData): Promise<void> {
  const session = await requireModuleSession("enterprise_verticals");
  const client = await getSupabaseServerClient();
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const tenderId = String(formData.get("tenderId") ?? "");
  await new CorporateTenderRepository(client).revoke({
    retailerId: session.retailerId,
    tenderId: asId<"CorporateTenderId">(tenderId),
  });
  revalidatePath(`/business-development/${opportunityId}`);
}
