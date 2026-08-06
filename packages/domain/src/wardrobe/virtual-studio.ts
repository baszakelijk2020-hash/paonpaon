/**
 * Virtual Wardrobe Studio shared foundation (VWS-001..003 / PHASE 4.6 /
 * ADR-074). Generation attaches to the existing Outfit/WardrobeRoadmap
 * primitives (see docs/VIRTUAL_WARDROBE_STUDIO_BLUEPRINT.md); this module
 * adds only what has no existing PAON equivalent: identity/reference
 * photos, retailer generation presets, the generation job/snapshot, and
 * feedback. Fit preference itself is NOT modeled here — it reuses the
 * existing MetadataConcept("fit")/customer_style_preference_evidence path
 * (ADR-074 §3.2); this file only derives the tailoring attributes a chosen
 * archetype implies.
 */

import type {
  CustomerId,
  OutfitId,
  RetailerId,
  RetailerVisualPresetId,
  StylePortraitId,
  StylePortraitReferenceId,
  WardrobeVisualizationFeedbackId,
  WardrobeVisualizationJobId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

// ---------------------------------------------------------------------------
// Image-generation consent — deliberately independent of `ConsentPurpose`
// (intelligence/consent.ts). Reuses `ConsentStatus`'s vocabulary at the type
// level but is its own narrow state: this purpose carries disclosures
// (advisor visibility, AI-visualization disclaimer, deletion rights) the
// generic personalization/marketing/location purposes don't need. Keeping
// it separate avoids widening `CustomerConsentState`, a shared interface
// every existing consent consumer (advisor briefing, MorningRoutine,
// customer-interest scoring) would otherwise have to be touched to satisfy.
// ---------------------------------------------------------------------------

export const IMAGE_GENERATION_CONSENT_STATUSES = [
  "granted",
  "denied",
  "withdrawn",
] as const;

export type ImageGenerationConsentStatus =
  (typeof IMAGE_GENERATION_CONSENT_STATUSES)[number];

export interface StylePortraitConsent {
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly status: ImageGenerationConsentStatus;
  readonly grantedAt?: string;
  readonly withdrawnAt?: string;
  /** True once the customer has seen the exact disclosures the founder
   * brief requires (why images are needed, advisor visibility, AI-only
   * output, deletion path) — a bare opt-in checkbox is not consent here. */
  readonly disclosuresAcknowledged: boolean;
}

export function canGenerateWardrobeVisualization(
  consent: StylePortraitConsent,
): boolean {
  return consent.status === "granted" && consent.disclosuresAcknowledged;
}

// ---------------------------------------------------------------------------
// StylePortrait — approved visual reference set
// ---------------------------------------------------------------------------

export const STYLE_PORTRAIT_REFERENCE_KINDS = [
  "face",
  "full_body",
  "side",
  "pose",
  "outfit_reference",
] as const;
export type StylePortraitReferenceKind =
  (typeof STYLE_PORTRAIT_REFERENCE_KINDS)[number];

export const STYLE_PORTRAIT_STATUSES = [
  "draft",
  "preview_generated",
  "approved",
  "rejected",
  "superseded",
] as const;
export type StylePortraitStatus = (typeof STYLE_PORTRAIT_STATUSES)[number];

export interface StylePortraitReference {
  readonly id: StylePortraitReferenceId;
  readonly stylePortraitId: StylePortraitId;
  readonly retailerId: RetailerId;
  readonly kind: StylePortraitReferenceKind;
  readonly storageBucket: string;
  readonly storagePath: string;
  readonly createdAt: string;
}

export interface StylePortrait extends Timestamps {
  readonly id: StylePortraitId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly version: number;
  readonly status: StylePortraitStatus;
  readonly fitArchetypeConceptId?: string;
  readonly previewImageUrl?: string;
  readonly approvedAt?: string;
  readonly supersededAt?: string;
  readonly rejectedReason?: string;
  readonly references: readonly StylePortraitReference[];
}

const STYLE_PORTRAIT_TERMINAL: readonly StylePortraitStatus[] = [
  "rejected",
  "superseded",
];

export function isStylePortraitTerminal(status: StylePortraitStatus): boolean {
  return STYLE_PORTRAIT_TERMINAL.includes(status);
}

export type StylePortraitTransition =
  "generate_preview" | "approve" | "reject" | "supersede";

export type StylePortraitTransitionIssue =
  | "invalid_from_status"
  | "missing_face_reference"
  | "missing_full_body_reference";

export function stylePortraitTransitionIssues(params: {
  readonly action: StylePortraitTransition;
  readonly currentStatus: StylePortraitStatus;
  readonly hasFaceReference: boolean;
  readonly hasFullBodyReference: boolean;
}): readonly StylePortraitTransitionIssue[] {
  const issues: StylePortraitTransitionIssue[] = [];

  const allowedFrom: Record<
    StylePortraitTransition,
    readonly StylePortraitStatus[]
  > = {
    generate_preview: ["draft"],
    approve: ["preview_generated"],
    reject: ["preview_generated"],
    supersede: ["approved"],
  };

  if (!allowedFrom[params.action].includes(params.currentStatus)) {
    issues.push("invalid_from_status");
  }

  if (params.action === "generate_preview") {
    if (!params.hasFaceReference) issues.push("missing_face_reference");
    if (!params.hasFullBodyReference) {
      issues.push("missing_full_body_reference");
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Fit archetype -> tailoring attributes (ADR-074 §3.2). The archetype
// itself is a canonical MetadataConcept("fit") row; this is the pure,
// versioned mapping the seed migration's `attributes` JSONB mirrors, kept
// here too so domain logic never has to round-trip through a concept row
// just to reason about what an archetype implies.
// ---------------------------------------------------------------------------

export const FIT_ARCHETYPE_SLUGS = [
  "slim",
  "classic",
  "contemporary",
  "fashion_wide",
] as const;
export type FitArchetypeSlug = (typeof FIT_ARCHETYPE_SLUGS)[number];

export const TAILORING_WIDTH_VALUES = ["narrow", "moderate", "wide"] as const;
export type TailoringWidth = (typeof TAILORING_WIDTH_VALUES)[number];

export const TAILORING_LENGTH_VALUES = ["short", "regular", "long"] as const;
export type TailoringLength = (typeof TAILORING_LENGTH_VALUES)[number];

export interface TailoringAttributes {
  readonly lapelWidth: TailoringWidth;
  readonly waistSuppression: "high" | "moderate" | "low";
  readonly jacketLength: TailoringLength;
  readonly shoulderExpression: "natural" | "structured" | "roped";
  readonly sleeveWidth: TailoringWidth;
  readonly trouserRise: "low" | "mid" | "high";
  readonly thighEase: "close" | "moderate" | "full";
  readonly legWidth: TailoringWidth;
  readonly trouserBreak: "no_break" | "slight_break" | "full_break";
}

const FIT_ARCHETYPE_TAILORING_ATTRIBUTES: Record<
  FitArchetypeSlug,
  TailoringAttributes
> = {
  slim: {
    lapelWidth: "narrow",
    waistSuppression: "high",
    jacketLength: "short",
    shoulderExpression: "natural",
    sleeveWidth: "narrow",
    trouserRise: "mid",
    thighEase: "close",
    legWidth: "narrow",
    trouserBreak: "no_break",
  },
  classic: {
    lapelWidth: "moderate",
    waistSuppression: "moderate",
    jacketLength: "regular",
    shoulderExpression: "structured",
    sleeveWidth: "moderate",
    trouserRise: "high",
    thighEase: "moderate",
    legWidth: "moderate",
    trouserBreak: "slight_break",
  },
  contemporary: {
    lapelWidth: "moderate",
    waistSuppression: "moderate",
    jacketLength: "regular",
    shoulderExpression: "natural",
    sleeveWidth: "moderate",
    trouserRise: "mid",
    thighEase: "moderate",
    legWidth: "moderate",
    trouserBreak: "slight_break",
  },
  fashion_wide: {
    lapelWidth: "wide",
    waistSuppression: "low",
    jacketLength: "long",
    shoulderExpression: "roped",
    sleeveWidth: "wide",
    trouserRise: "high",
    thighEase: "full",
    legWidth: "wide",
    trouserBreak: "full_break",
  },
};

export function deriveTailoringAttributesFromFitArchetype(
  archetype: FitArchetypeSlug,
): TailoringAttributes {
  return FIT_ARCHETYPE_TAILORING_ATTRIBUTES[archetype];
}

// ---------------------------------------------------------------------------
// RetailerVisualPreset
// ---------------------------------------------------------------------------

export const VISUAL_PRESET_BACKGROUND_TYPES = [
  "studio_neutral",
  "retailer_image",
  "editorial_scene",
] as const;
export type VisualPresetBackgroundType =
  (typeof VISUAL_PRESET_BACKGROUND_TYPES)[number];

export interface RetailerVisualPreset extends Timestamps {
  readonly id: RetailerVisualPresetId;
  readonly retailerId: RetailerId;
  readonly name: string;
  readonly isDefault: boolean;
  readonly backgroundType: VisualPresetBackgroundType;
  readonly backgroundImageUrl?: string;
  readonly poseFamily: string;
  readonly cameraHeight: string;
  readonly cameraDistance: string;
  readonly crop: string;
  readonly aspectRatio: string;
  readonly lighting: string;
  readonly expression: string;
  readonly visualTreatment: string;
  readonly negativeConstraints: readonly string[];
  /** Always true. Not a configuration knob — refused at the domain/schema
   * level, not left to prompt wording (founder brief's identity-preservation
   * boundary: never slim, age-reduce, reshape or change skin tone). */
  readonly bodyModificationProhibited: true;
}

export function isPresetSafeForGeneration(
  preset: Pick<RetailerVisualPreset, "bodyModificationProhibited">,
): boolean {
  return preset.bodyModificationProhibited === true;
}

// ---------------------------------------------------------------------------
// WardrobeVisualizationJob — the generation snapshot/queue/result
// ---------------------------------------------------------------------------

export const WARDROBE_VISUALIZATION_JOB_STATUSES = [
  "queued",
  "generating",
  "ready",
  "failed",
  "cancelled",
] as const;
export type WardrobeVisualizationJobStatus =
  (typeof WARDROBE_VISUALIZATION_JOB_STATUSES)[number];

const WARDROBE_VISUALIZATION_JOB_TERMINAL: readonly WardrobeVisualizationJobStatus[] =
  ["ready", "failed", "cancelled"];

export function isWardrobeVisualizationJobTerminal(
  status: WardrobeVisualizationJobStatus,
): boolean {
  return WARDROBE_VISUALIZATION_JOB_TERMINAL.includes(status);
}

export function canCancelWardrobeVisualizationJob(
  status: WardrobeVisualizationJobStatus,
): boolean {
  return status === "queued";
}

export interface WardrobeVisualizationInputSnapshot {
  readonly outfitId: OutfitId;
  readonly stylePortraitId: StylePortraitId;
  readonly stylePortraitVersion: number;
  readonly retailerVisualPresetId: RetailerVisualPresetId;
  readonly tailoringAttributes: TailoringAttributes;
  readonly writtenInstructions?: string;
  readonly providerName: string;
  readonly model: string;
}

export interface WardrobeVisualizationJob extends Timestamps {
  readonly id: WardrobeVisualizationJobId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly outfitId: OutfitId;
  readonly stylePortraitId: StylePortraitId;
  readonly retailerVisualPresetId: RetailerVisualPresetId;
  readonly providerName: string;
  readonly model: string;
  readonly inputSnapshot: WardrobeVisualizationInputSnapshot;
  readonly inputHash: string;
  readonly status: WardrobeVisualizationJobStatus;
  readonly attempt: number;
  readonly outputImageUrl?: string;
  readonly errorMessage?: string;
  readonly estimatedCostCents?: number;
  readonly actualCostCents?: number;
}

/**
 * Deterministic, stable-key JSON so the same logical input always hashes
 * the same way regardless of object construction order. The actual digest
 * (sha256) is computed at the database/runner layer, which has Node's
 * crypto module available; this stays pure so it is unit-testable without
 * it, same split as every other domain/infrastructure boundary here.
 */
export function canonicalizeWardrobeVisualizationInput(
  input: WardrobeVisualizationInputSnapshot,
): string {
  const tailoring = input.tailoringAttributes as unknown as Record<
    string,
    string
  >;
  const sortedTailoring = Object.keys(tailoring)
    .sort()
    .reduce<Record<string, string>>((acc, key) => {
      acc[key] = tailoring[key] ?? "";
      return acc;
    }, {});

  return JSON.stringify({
    outfitId: input.outfitId,
    stylePortraitId: input.stylePortraitId,
    stylePortraitVersion: input.stylePortraitVersion,
    retailerVisualPresetId: input.retailerVisualPresetId,
    tailoringAttributes: sortedTailoring,
    writtenInstructions: input.writtenInstructions ?? "",
    providerName: input.providerName,
    model: input.model,
  });
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

export const WARDROBE_VISUALIZATION_FEEDBACK_SIGNALS = [
  "love_it",
  "save",
  "not_for_me",
  "regenerate",
  "looks_like_me_no",
  "fit_correction",
  "colour_correction",
] as const;
export type WardrobeVisualizationFeedbackSignal =
  (typeof WARDROBE_VISUALIZATION_FEEDBACK_SIGNALS)[number];

const POSITIVE_FEEDBACK_SIGNALS: readonly WardrobeVisualizationFeedbackSignal[] =
  ["love_it", "save"];

export function isPositiveWardrobeVisualizationSignal(
  signal: WardrobeVisualizationFeedbackSignal,
): boolean {
  return POSITIVE_FEEDBACK_SIGNALS.includes(signal);
}

export interface WardrobeVisualizationFeedback {
  readonly id: WardrobeVisualizationFeedbackId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly jobId: WardrobeVisualizationJobId;
  readonly signal: WardrobeVisualizationFeedbackSignal;
  readonly note?: string;
  readonly createdAt: string;
}
