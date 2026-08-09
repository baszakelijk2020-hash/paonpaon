import { runWardrobeVisualizationJob } from "@paon/ai";
import {
  OutfitRepository,
  PlatformModuleRepository,
  ProductRepository,
  RetailerRepository,
  RetailerVisualPresetRepository,
  StylePortraitConsentRepository,
  StylePortraitRepository,
  WardrobeRepository,
  WardrobeVisualizationJobRepository,
} from "@paon/database";
import type { OutfitSlot, WardrobeVisualizationJob } from "@paon/domain";
import { NextResponse } from "next/server";

import { getAIProvider } from "@/lib/ai";
import { env } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const BUCKET = "wardrobe-studio";
const BATCH_SIZE = 5;

async function describeSlot(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  slot: OutfitSlot,
): Promise<string | null> {
  if (!slot.available) return null;
  if (slot.wardrobeItemId) {
    const item = await new WardrobeRepository(admin).findById(
      slot.wardrobeItemId,
    );
    return item ? `${slot.slotKind}: ${item.displayName}` : null;
  }
  if (slot.productId) {
    const product = await new ProductRepository(admin).findById(slot.productId);
    return product ? `${slot.slotKind}: ${product.name}` : null;
  }
  return null;
}

/** Downloads the provider's temporary image and re-uploads it into
 * PAON-controlled private Storage — a customer/advisor never sees a raw
 * provider URL, matching the founder brief's "PAON-controlled Storage"
 * requirement. */
async function copyIntoStorage(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  job: WardrobeVisualizationJob,
  sourceUrl: string,
): Promise<{ bucket: string; path: string }> {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download generated image (${response.status})`);
  }
  const bytes = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") ?? "image/png";
  const extension = contentType.includes("png") ? "png" : "jpg";
  const path = `${job.retailerId}/${job.customerId}/generations/${job.id}.${extension}`;

  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw error;

  return { bucket: BUCKET, path };
}

export interface WardrobeVisualizationProcessingResult {
  readonly claimed: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly skipped?: boolean;
  readonly reason?: string;
}

/**
 * Processes `wardrobe_visualization_jobs` sequentially (VWS-001 / PHASE
 * 4.6/4.8). Claims a bounded batch and generates each image in turn —
 * never in parallel, the founder brief's explicit "generate sequentially"
 * requirement — copies the result into private Storage, and completes
 * the job. No image is ever shown to a customer or advisor until its job
 * row says `ready`. Exported so `/api/cron/dispatch-emails` can piggyback
 * this onto its own tick: Vercel Hobby caps cron jobs at two daily slots,
 * already spent on dispatch-emails/dispatch-sms, same reason that route
 * already piggybacks MorningRoutine and campaign delivery.
 */
export async function processWardrobeVisualizationJobs(
  admin: ReturnType<typeof getSupabaseAdminClient>,
): Promise<WardrobeVisualizationProcessingResult> {
  const provider = getAIProvider();
  if (!provider) {
    return {
      claimed: 0,
      succeeded: 0,
      failed: 0,
      skipped: true,
      reason: "OpenAI is not configured on this deployment.",
    };
  }

  const jobRepo = new WardrobeVisualizationJobRepository(admin);
  const outfitRepo = new OutfitRepository(admin);
  const portraitRepo = new StylePortraitRepository(admin);
  const consentRepo = new StylePortraitConsentRepository(admin);
  const presetRepo = new RetailerVisualPresetRepository(admin);
  const moduleRepo = new PlatformModuleRepository(admin);
  const retailerRepo = new RetailerRepository(admin);

  const claimed = await jobRepo.claimPending(BATCH_SIZE);

  let succeeded = 0;
  let failed = 0;

  // Sequential, not Promise.all — the founder brief explicitly requires
  // sequential generation for a customer/advisor batch, not fan-out.
  for (const job of claimed) {
    try {
      const [portrait, preset, retailer, consent, moduleState] =
        await Promise.all([
          portraitRepo.findById(job.stylePortraitId),
          presetRepo.findById(job.retailerVisualPresetId),
          retailerRepo.findById(job.retailerId),
          consentRepo.findForCustomer(job.retailerId, job.customerId),
          moduleRepo.publicAccessState(job.retailerId, "wardrobe_styling"),
        ]);
      if (!portrait || !preset || !retailer) {
        throw new Error("Job references a missing portrait/preset/retailer.");
      }
      if (consent.status !== "granted" || !consent.disclosuresAcknowledged) {
        throw new Error("Image-generation consent is not active.");
      }
      if (moduleState !== "active") {
        throw new Error("Wardrobe styling is not active for this house.");
      }

      const referenceImageUrls: string[] = [];
      for (const reference of portrait.references) {
        const { data: signed, error } = await admin.storage
          .from(reference.storageBucket)
          .createSignedUrl(reference.storagePath, 15 * 60);
        if (error) throw error;
        referenceImageUrls.push(signed.signedUrl);
      }

      let garmentDescriptions: string[] = [];
      if (job.kind === "outfit") {
        if (!job.outfitId) throw new Error("Outfit job has no Outfit.");
        const outfit = await outfitRepo.findById(job.outfitId);
        if (!outfit) throw new Error("Job references a missing Outfit.");
        garmentDescriptions = (
          await Promise.all(
            outfit.slots.map((slot) => describeSlot(admin, slot)),
          )
        ).filter((value): value is string => value !== null);
      }

      const tailoring = job.inputSnapshot.tailoringAttributes;
      const tailoringInstructions = Object.entries(tailoring)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ");

      const result = await runWardrobeVisualizationJob(provider, {
        retailerName: retailer.displayName,
        referenceImageUrls,
        garmentDescriptions,
        tailoringInstructions,
        ...(job.inputSnapshot.writtenInstructions
          ? { writtenInstructions: job.inputSnapshot.writtenInstructions }
          : {}),
        backgroundType: preset.backgroundType,
        poseFamily: preset.poseFamily,
        cameraHeight: preset.cameraHeight,
        cameraDistance: preset.cameraDistance,
        crop: preset.crop,
        aspectRatio: preset.aspectRatio,
        lighting: preset.lighting,
        expression: preset.expression,
        visualTreatment: preset.visualTreatment,
        negativeConstraints: preset.negativeConstraints,
      });

      if (!result.ok) {
        await jobRepo.complete({
          jobId: job.id,
          status: "failed",
          errorMessage: result.errorMessage,
        });
        failed += 1;
        continue;
      }

      const { bucket, path } = await copyIntoStorage(
        admin,
        job,
        result.result.imageUrl,
      );
      await jobRepo.complete({
        jobId: job.id,
        status: "ready",
        outputStorageBucket: bucket,
        outputStoragePath: path,
      });
      succeeded += 1;
    } catch (error) {
      await jobRepo.complete({
        jobId: job.id,
        status: "failed",
        errorMessage:
          error instanceof Error ? error.message : "Unknown generation error",
      });
      failed += 1;
    }
  }

  return { claimed: claimed.length, succeeded, failed };
}

/** Same shared-secret authentication as `/api/cron/dispatch-emails` — a
 * scheduled job, not a webhook. Also directly triggerable for local/manual
 * runs and as a fallback if the piggybacked dispatch-emails tick alone
 * isn't enough throughput. */
async function handleDispatch(request: Request): Promise<Response> {
  const cronSecret = env.cronSecret;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured on this deployment." },
      { status: 503 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processWardrobeVisualizationJobs(
    getSupabaseAdminClient(),
  );
  return NextResponse.json(result);
}

export async function GET(request: Request): Promise<Response> {
  return handleDispatch(request);
}

export async function POST(request: Request): Promise<Response> {
  return handleDispatch(request);
}
