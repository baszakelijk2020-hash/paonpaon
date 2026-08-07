"use server";

import {
  CustomerRepository,
  MetadataRepository,
  OutfitRepository,
  RetailerVisualPresetRepository,
  StylePortraitRepository,
  WardrobeVisualizationFeedbackRepository,
  WardrobeVisualizationJobRepository,
} from "@paon/database";
import {
  asId,
  createOutfitInputSchema,
  deriveTailoringAttributesFromFitArchetype,
  parseFitArchetypeSlug,
  recordWardrobeVisualizationFeedbackInputSchema,
  type OutfitSlotKind,
  type WardrobeVisualizationFeedbackSignal,
  type WardrobeVisualizationInputSnapshot,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

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

/**
 * Enqueues generation for an existing outfit (VWS-001). Blocked without an
 * approved Style Portrait and a retailer default visual preset — the same
 * fail-closed posture every other AI-assisted surface in this codebase
 * uses. Sequential/queued processing happens in
 * `apps/admin/app/api/cron/process-wardrobe-visualizations`, not here —
 * no long-running browser request.
 */
export async function generateOutfitLook(
  retailerId: string,
  outfitId: string,
  writtenInstructions: string | undefined,
): Promise<{ readonly error?: string }> {
  const { customer, supabase } = await resolveCustomer(retailerId);

  const portrait = await new StylePortraitRepository(
    supabase,
  ).findApprovedForCustomer(customer.id);
  if (!portrait) {
    return { error: "Approve a Style Portrait in Settings first." };
  }

  const preset = await new RetailerVisualPresetRepository(
    supabase,
  ).findDefaultForRetailer(customer.retailerId);
  if (!preset) {
    return { error: "This house has not configured a visual preset yet." };
  }

  let tailoring = deriveTailoringAttributesFromFitArchetype("classic");
  if (portrait.fitArchetypeConceptId) {
    const concept = await new MetadataRepository(supabase).findConceptById(
      customer.retailerId,
      asId<"MetadataConceptId">(portrait.fitArchetypeConceptId),
    );
    const slug = concept ? parseFitArchetypeSlug(concept.slug) : null;
    if (slug) tailoring = deriveTailoringAttributesFromFitArchetype(slug);
  }

  const snapshot: WardrobeVisualizationInputSnapshot = {
    outfitId: asId<"OutfitId">(outfitId),
    stylePortraitId: portrait.id,
    stylePortraitVersion: portrait.version,
    retailerVisualPresetId: preset.id,
    tailoringAttributes: tailoring,
    ...(writtenInstructions?.trim()
      ? { writtenInstructions: writtenInstructions.trim() }
      : {}),
    providerName: "openai",
    model: "dall-e-3",
  };

  try {
    await new WardrobeVisualizationJobRepository(supabase).enqueue(
      {
        retailerId: customer.retailerId,
        customerId: customer.id,
        outfitId,
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

  revalidatePath("/wardrobe");
  return {};
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
}
