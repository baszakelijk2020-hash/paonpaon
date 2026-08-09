"use server";

import { requireRetailerRole } from "@paon/auth";
import {
  MetadataRepository,
  OutfitRepository,
  RetailerStaffRepository,
  RetailerVisualPresetRepository,
  StylePortraitRepository,
  WardrobeRoadmapRepository,
  WardrobeVisualizationJobRepository,
} from "@paon/database";
import {
  asId,
  createOutfitInputSchema,
  deriveTailoringAttributesFromFitArchetype,
  parseFitArchetypeSlug,
  type OutfitSlotKind,
  type WardrobeVisualizationInputSnapshot,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/** Founder brief: "Support up to 12 looks." A UI-level cap on the
 * roadmap's linked outfits, not a new business-rule table. */
const MAX_ROADMAP_LOOKS = 12;

async function resolveStaff(retailerId: string, userId: string) {
  const supabase = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(supabase).findByUserId(
    userId as never,
  );
  if (!staff || staff.retailerId !== retailerId) return null;
  return { staff, supabase };
}

export interface RoadmapLookActionState {
  formError?: string;
  success?: boolean;
}

/**
 * Advisor composes one visual look linked to a roadmap (VWS-001 / PHASE
 * 4.9) — an `Outfit` with `roadmapId` set, authored by staff, reusing the
 * exact same slot-consistency rules as every other outfit in this
 * codebase. Not a new "Look" entity (ADR-074).
 */
export async function createRoadmapLook(
  roadmapId: string,
  _previous: RoadmapLookActionState,
  formData: FormData,
): Promise<RoadmapLookActionState> {
  const session = await requireModuleSession("wardrobe_styling");
  const resolved = await resolveStaff(session.retailerId, session.userId);
  if (!resolved) return { formError: "Staff session required." };
  const { staff, supabase } = resolved;
  requireRetailerRole(staff.role, "sales_associate");

  const roadmapRepo = new WardrobeRoadmapRepository(supabase);
  const roadmap = await roadmapRepo.findById(
    asId<"WardrobeRoadmapId">(roadmapId),
  );
  if (!roadmap || roadmap.retailerId !== staff.retailerId) {
    return { formError: "Roadmap not found." };
  }

  const outfitRepo = new OutfitRepository(supabase);
  const existingLooks = await outfitRepo.findByRoadmap(roadmap.id);
  if (existingLooks.length >= MAX_ROADMAP_LOOKS) {
    return {
      formError: `A roadmap holds at most ${MAX_ROADMAP_LOOKS} looks.`,
    };
  }

  const title = String(formData.get("title") ?? "").trim() || "Untitled look";
  const occasionLabel = String(formData.get("occasionLabel") ?? "").trim();
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
    retailerId: roadmap.retailerId,
    customerId: roadmap.customerId,
    roadmapId: roadmap.id,
    title,
    ...(occasionLabel ? { occasionLabel } : {}),
    slots,
  });
  if (!parsed.success) {
    return {
      formError: parsed.error.issues[0]?.message ?? "Pick at least one item.",
    };
  }

  try {
    await outfitRepo.create(parsed.data, staff.id);
  } catch (error) {
    return {
      formError:
        error instanceof Error ? error.message : "Could not create look.",
    };
  }

  revalidatePath(`/customers/${roadmap.customerId}`);
  return { success: true };
}

interface EnqueueResult {
  readonly error?: string;
}

async function enqueueLook(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  params: {
    readonly retailerId: string;
    readonly customerId: string;
    readonly outfitId: string;
  },
): Promise<EnqueueResult> {
  const portrait = await new StylePortraitRepository(
    supabase,
  ).findApprovedForCustomer(asId<"CustomerId">(params.customerId));
  if (!portrait) {
    return { error: "This client has no approved Style Portrait yet." };
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
    kind: "outfit",
    outfitId: asId<"OutfitId">(params.outfitId),
    stylePortraitId: portrait.id,
    stylePortraitVersion: portrait.version,
    retailerVisualPresetId: preset.id,
    tailoringAttributes: tailoring,
    providerName: "openai",
    model: "gpt-image-2",
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

export async function generateRoadmapLook(
  customerId: string,
  outfitId: string,
): Promise<{ readonly error?: string }> {
  const session = await requireModuleSession("wardrobe_styling");
  const resolved = await resolveStaff(session.retailerId, session.userId);
  if (!resolved) return { error: "Staff session required." };
  const { supabase } = resolved;

  const result = await enqueueLook(supabase, {
    retailerId: session.retailerId,
    customerId,
    outfitId,
  });
  revalidatePath(`/customers/${customerId}`);
  return result;
}

/** "Create all pending looks" (VWS-001 / PHASE 4.9) — enqueues every
 * roadmap-linked look that has no active/ready job yet. Enqueuing is
 * sequential here (awaited in a loop, not Promise.all); the actual
 * generation ordering is enforced downstream by the queue processor's own
 * `for update skip locked` claim loop, same "generate sequentially"
 * requirement as the founder brief states for the customer's own
 * multi-look batch. */
export async function generateAllPendingRoadmapLooks(
  roadmapId: string,
): Promise<{ readonly enqueued: number; readonly errors: readonly string[] }> {
  const session = await requireModuleSession("wardrobe_styling");
  const resolved = await resolveStaff(session.retailerId, session.userId);
  if (!resolved) return { enqueued: 0, errors: ["Staff session required."] };
  const { staff, supabase } = resolved;

  const roadmapRepo = new WardrobeRoadmapRepository(supabase);
  const roadmap = await roadmapRepo.findById(
    asId<"WardrobeRoadmapId">(roadmapId),
  );
  if (!roadmap || roadmap.retailerId !== staff.retailerId) {
    return { enqueued: 0, errors: ["Roadmap not found."] };
  }

  const outfitRepo = new OutfitRepository(supabase);
  const jobRepo = new WardrobeVisualizationJobRepository(supabase);
  const looks = await outfitRepo.findByRoadmap(roadmap.id);

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
      retailerId: roadmap.retailerId,
      customerId: roadmap.customerId,
      outfitId: look.id,
    });
    if (result.error) {
      errors.push(`${look.title}: ${result.error}`);
    } else {
      enqueued += 1;
    }
  }

  revalidatePath(`/customers/${roadmap.customerId}`);
  return { enqueued, errors };
}

export async function cancelRoadmapLook(
  customerId: string,
  jobId: string,
): Promise<void> {
  const session = await requireModuleSession("wardrobe_styling");
  const resolved = await resolveStaff(session.retailerId, session.userId);
  if (!resolved) return;
  const { supabase } = resolved;
  await new WardrobeVisualizationJobRepository(supabase).cancel(
    asId<"WardrobeVisualizationJobId">(jobId),
  );
  revalidatePath(`/customers/${customerId}`);
}
