"use server";

import {
  CustomerConsentRepository,
  CustomerRepository,
  MetadataRepository,
  OutfitRepository,
  RetailerVisualPresetRepository,
  StyleProfileRepository,
  StylePortraitRepository,
  WardrobeRepository,
  WardrobeVisualizationFeedbackRepository,
  WardrobeVisualizationJobRepository,
} from "@paon/database";
import {
  asId,
  createOutfitInputSchema,
  deriveTailoringAttributesFromFitArchetype,
  mayCapturePersonalizationForCustomer,
  parseFitArchetypeSlug,
  recordWardrobeVisualizationFeedbackInputSchema,
  styleEvidenceForWardrobeVisualizationFeedback,
  type CustomerId,
  type OutfitSlotKind,
  type ProductId,
  type RetailerId,
  type WardrobeVisualizationFeedbackSignal,
  type WardrobeVisualizationInputSnapshot,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

type Supabase = Awaited<ReturnType<typeof getSupabaseServerClient>>;

async function resolveCustomer(retailerId: string) {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const customer = customers.find((row) => row.retailerId === retailerId);
  if (!customer) throw new Error("Customer relationship not found.");
  return { customer, supabase };
}

export interface ComposeOutfitState {
  formError?: string;
}

/**
 * The customer composes their own try-on look (VWS-001 / PHASE 4.8) —
 * `Outfit.createdByCustomerId`, not `createdByStaffId`, the one real
 * authorship gap closed for this feature. Slots come from the same
 * owned-wardrobe/wishlist library the account already has; no parallel
 * "Look" entity.
 */
export async function composeCustomerOutfit(
  retailerId: string,
  _previous: ComposeOutfitState,
  formData: FormData,
): Promise<ComposeOutfitState> {
  const { customer, supabase } = await resolveCustomer(retailerId);

  const title = String(formData.get("title") ?? "").trim();
  const slotEntries = formData.getAll("slotItem");
  const slots = slotEntries
    .map((raw) => {
      const [slotKind, refKind, refId] = String(raw).split("::");
      if (!slotKind || !refKind || !refId) return null;
      return {
        slotKind: slotKind as OutfitSlotKind,
        label: slotKind,
        available: true,
        displayOrder: 0,
        ...(refKind === "wardrobe" ? { wardrobeItemId: refId } : {}),
        ...(refKind === "product" ? { productId: refId } : {}),
      };
    })
    .filter((slot): slot is NonNullable<typeof slot> => slot !== null)
    .map((slot, index) => ({ ...slot, displayOrder: index }));

  const parsed = createOutfitInputSchema.safeParse({
    retailerId: customer.retailerId,
    customerId: customer.id,
    title: title || "My look",
    slots,
  });
  if (!parsed.success) {
    return {
      formError: parsed.error.issues[0]?.message ?? "Pick at least one item.",
    };
  }

  try {
    await new OutfitRepository(supabase).createByCustomer(
      parsed.data,
      customer.id,
    );
  } catch (error) {
    return {
      formError:
        error instanceof Error ? error.message : "Could not create look.",
    };
  }

  revalidatePath("/wardrobe");
  return {};
}

interface EnqueueResult {
  readonly error?: string;
}

/**
 * Enqueues generation for an existing outfit (VWS-001). Blocked without an
 * approved Style Portrait and a retailer default visual preset — the same
 * fail-closed posture every other AI-assisted surface in this codebase
 * uses. Sequential/queued processing happens in
 * `apps/admin/app/api/cron/process-wardrobe-visualizations`, not here —
 * no long-running browser request. Shared by the single-look action and
 * the "create all saved looks" batch action (PHASE 4.10) so the two never
 * drift on enqueue logic, mirroring the retailer roadmap's own
 * `enqueueLook` helper (PHASE 4.9).
 */
async function enqueueLook(
  supabase: Supabase,
  params: {
    readonly retailerId: string;
    readonly customerId: string;
    readonly outfitId: string;
    readonly writtenInstructions?: string;
  },
): Promise<EnqueueResult> {
  const portrait = await new StylePortraitRepository(
    supabase,
  ).findApprovedForCustomer(asId<"CustomerId">(params.customerId));
  if (!portrait) {
    return { error: "Approve a Style Portrait in Settings first." };
  }

  const preset = await new RetailerVisualPresetRepository(
    supabase,
  ).findDefaultForRetailer(asId<"RetailerId">(params.retailerId));
  if (!preset) {
    return { error: "This house has not configured a visual preset yet." };
  }

  let tailoring = deriveTailoringAttributesFromFitArchetype("classic");
  if (portrait.fitArchetypeConceptId) {
    const concept = await new MetadataRepository(supabase).findConceptById(
      asId<"RetailerId">(params.retailerId),
      asId<"MetadataConceptId">(portrait.fitArchetypeConceptId),
    );
    const slug = concept ? parseFitArchetypeSlug(concept.slug) : null;
    if (slug) tailoring = deriveTailoringAttributesFromFitArchetype(slug);
  }

  const snapshot: WardrobeVisualizationInputSnapshot = {
    outfitId: asId<"OutfitId">(params.outfitId),
    stylePortraitId: portrait.id,
    stylePortraitVersion: portrait.version,
    retailerVisualPresetId: preset.id,
    tailoringAttributes: tailoring,
    ...(params.writtenInstructions?.trim()
      ? { writtenInstructions: params.writtenInstructions.trim() }
      : {}),
    providerName: "openai",
    model: "dall-e-3",
  };

  try {
    await new WardrobeVisualizationJobRepository(supabase).enqueue(
      {
        retailerId: params.retailerId,
        customerId: params.customerId,
        outfitId: params.outfitId,
        stylePortraitId: portrait.id,
        retailerVisualPresetId: preset.id,
      },
      snapshot,
    );
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not start generation.",
    };
  }
  return {};
}

export async function generateOutfitLook(
  retailerId: string,
  outfitId: string,
  writtenInstructions: string | undefined,
): Promise<{ readonly error?: string }> {
  const { customer, supabase } = await resolveCustomer(retailerId);
  const result = await enqueueLook(supabase, {
    retailerId: customer.retailerId,
    customerId: customer.id,
    outfitId,
    ...(writtenInstructions ? { writtenInstructions } : {}),
  });
  revalidatePath("/wardrobe");
  return result;
}

/** "Create all saved looks" (VWS-001 / PHASE 4.10) — enqueues generation
 * for every one of the customer's own, non-roadmap outfits that has no
 * active/ready job yet. Enqueuing is sequential (awaited in a loop, not
 * Promise.all), same posture as the retailer roadmap's own batch action —
 * the queue processor's `for update skip locked` claim loop (now ordered
 * by `created_at, id` for a deterministic claim order) is what actually
 * serializes generation. */
export async function generateAllSavedLooks(
  retailerId: string,
): Promise<{ readonly enqueued: number; readonly errors: readonly string[] }> {
  const { customer, supabase } = await resolveCustomer(retailerId);

  const outfitRepo = new OutfitRepository(supabase);
  const jobRepo = new WardrobeVisualizationJobRepository(supabase);
  const looks = (await outfitRepo.findByCustomer(customer.id))
    .filter((outfit) => !outfit.roadmapId)
    .slice()
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  let enqueued = 0;
  const errors: string[] = [];
  for (const look of looks) {
    const jobs = await jobRepo.findByOutfit(look.id);
    const hasActiveOrReady = jobs.some(
      (job) =>
        job.status === "queued" ||
        job.status === "generating" ||
        job.status === "ready",
    );
    if (hasActiveOrReady) continue;

    const result = await enqueueLook(supabase, {
      retailerId: customer.retailerId,
      customerId: customer.id,
      outfitId: look.id,
    });
    if (result.error) {
      errors.push(`${look.title}: ${result.error}`);
    } else {
      enqueued += 1;
    }
  }

  revalidatePath("/wardrobe");
  return { enqueued, errors };
}

export async function cancelOutfitGeneration(
  retailerId: string,
  jobId: string,
): Promise<void> {
  const { supabase } = await resolveCustomer(retailerId);
  await new WardrobeVisualizationJobRepository(supabase).cancel(
    asId<"WardrobeVisualizationJobId">(jobId),
  );
  revalidatePath("/wardrobe");
}

/** "Cancel all queued" (PHASE 4.10) — cancels every still-queued job across
 * the customer's own saved looks. Only `queued` jobs are cancellable
 * (`canCancelWardrobeVisualizationJob`, enforced by the
 * `cancel_wardrobe_visualization_job` RPC itself); a job already
 * `generating` runs to completion. */
export async function cancelAllQueuedLooks(
  retailerId: string,
): Promise<{ readonly cancelled: number }> {
  const { customer, supabase } = await resolveCustomer(retailerId);

  const outfitRepo = new OutfitRepository(supabase);
  const jobRepo = new WardrobeVisualizationJobRepository(supabase);
  const looks = (await outfitRepo.findByCustomer(customer.id)).filter(
    (outfit) => !outfit.roadmapId,
  );

  let cancelled = 0;
  for (const look of looks) {
    const jobs = await jobRepo.findByOutfit(look.id);
    for (const job of jobs.filter((j) => j.status === "queued")) {
      await jobRepo.cancel(job.id);
      cancelled += 1;
    }
  }

  revalidatePath("/wardrobe");
  return { cancelled };
}

/**
 * Best-effort StyleProfile evidence feed for look feedback (VWS-001 /
 * PHASE 4.10 / blueprint §7): only love_it/save/not_for_me carry garment
 * taste (`styleEvidenceForWardrobeVisualizationFeedback`); every other
 * signal returns null and feeds nothing. Gated by the same personalization
 * consent check every other inferred-evidence capture site uses
 * (`mayCapturePersonalizationForCustomer`), and resolves concepts from the
 * outfit's own slots — a slot's product either directly, or via its linked
 * WardrobeItem's optional `productId` — the same accepted-taxonomy lookup
 * `swipe/actions.ts` uses for a product interaction. Never blocks the
 * feedback write itself.
 */
async function feedStyleProfileEvidence(
  supabase: Supabase,
  params: {
    readonly retailerId: RetailerId;
    readonly customerId: CustomerId;
    readonly jobId: string;
    readonly signal: WardrobeVisualizationFeedbackSignal;
  },
): Promise<void> {
  const evidence = styleEvidenceForWardrobeVisualizationFeedback(params.signal);
  if (!evidence) return;

  const consentState = await new CustomerConsentRepository(supabase).getState(
    params.retailerId,
    params.customerId,
  );
  if (!mayCapturePersonalizationForCustomer(consentState)) return;

  const job = await new WardrobeVisualizationJobRepository(supabase).findById(
    asId<"WardrobeVisualizationJobId">(params.jobId),
  );
  if (!job) return;

  const outfit = await new OutfitRepository(supabase).findById(job.outfitId);
  if (!outfit) return;

  const wardrobeRepo = new WardrobeRepository(supabase);
  const productIds: ProductId[] = [];
  for (const slot of outfit.slots) {
    if (slot.productId) {
      productIds.push(slot.productId);
      continue;
    }
    if (slot.wardrobeItemId) {
      const item = await wardrobeRepo.findById(slot.wardrobeItemId);
      if (item?.productId) productIds.push(item.productId);
    }
  }
  if (productIds.length === 0) return;

  const metadataRepo = new MetadataRepository(supabase);
  const conceptIds = new Set<string>();
  for (const productId of productIds) {
    const ids = await metadataRepo.findAcceptedConceptIdsForProduct(
      params.retailerId,
      productId,
    );
    for (const id of ids) conceptIds.add(id);
  }
  if (conceptIds.size === 0) return;

  const styleRepo = new StyleProfileRepository(supabase);
  for (const conceptId of conceptIds) {
    await styleRepo.recordEvidence(params.customerId, {
      conceptId: asId<"MetadataConceptId">(conceptId),
      source: evidence.source,
      polarity: evidence.polarity,
      confidence: 1,
    });
  }
  await styleRepo.recompute(params.retailerId, params.customerId);
}

export async function recordLookFeedback(
  retailerId: string,
  jobId: string,
  signal: WardrobeVisualizationFeedbackSignal,
  note?: string,
): Promise<void> {
  const { customer, supabase } = await resolveCustomer(retailerId);
  const parsed = recordWardrobeVisualizationFeedbackInputSchema.parse({
    retailerId: customer.retailerId,
    customerId: customer.id,
    jobId,
    signal,
    ...(note?.trim() ? { note: note.trim() } : {}),
  });
  await new WardrobeVisualizationFeedbackRepository(supabase).record(parsed);
  revalidatePath("/wardrobe");

  try {
    await feedStyleProfileEvidence(supabase, {
      retailerId: customer.retailerId,
      customerId: customer.id,
      jobId,
      signal,
    });
  } catch {
    // Best-effort: a failed evidence capture must never break feedback.
  }
}
