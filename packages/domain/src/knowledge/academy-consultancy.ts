/**
 * Consultancy, guided tiers, staff academy and media incubation
 * (KNW-101..105 / PHASE 16.1, 16.2).
 *
 * The governing non-goals are "no unreviewed AI publication" and "no
 * copied publisher content or speculative stock purchase". Both are
 * enforced as refusals:
 *
 * - `checkPublication` refuses any article whose provenance is
 *   `ai_generated` and whose review state is not `human_approved`. The
 *   provenance field is required, so an AI draft cannot be laundered into
 *   the library by omitting it.
 * - `checkMediaActivation` refuses content whose rights have expired, whose
 *   territory does not cover the retailer, or which names no licence at
 *   all — a piece with no stated licence is a piece somebody assumed was
 *   free.
 * - `evaluateProductHypothesis` returns `hypothesis` until four distinct
 *   kinds of evidence exist. There is no path from an idea to a purchase
 *   order in this module.
 */

export const CONTENT_AUDIENCES = [
  "customer",
  "staff",
  "owner",
  "media",
] as const;
export type ContentAudience = (typeof CONTENT_AUDIENCES)[number];

export const CONTENT_PROVENANCE = [
  "human_authored",
  "ai_assisted",
  "ai_generated",
  "licensed_third_party",
] as const;
export type ContentProvenance = (typeof CONTENT_PROVENANCE)[number];

export const REVIEW_STATES = [
  "draft",
  "in_review",
  "human_approved",
  "rejected",
] as const;
export type ContentReviewState = (typeof REVIEW_STATES)[number];

export type PublicationCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "ai_content_requires_human_approval"
        | "licensed_content_requires_licence_ref"
        | "not_approved"
        | "reviewer_cannot_be_author";
    };

/**
 * The publication gate. Note that `ai_assisted` is treated exactly like
 * `ai_generated`: a human who edited a machine draft is still publishing a
 * machine draft, and the distinction is too easy to claim to be worth
 * trusting.
 */
export function checkPublication(args: {
  readonly provenance: ContentProvenance;
  readonly reviewState: ContentReviewState;
  readonly authorStaffId: string;
  readonly reviewerStaffId?: string;
  readonly licenceRef?: string;
}): PublicationCheck {
  if (args.reviewState !== "human_approved") {
    if (
      args.provenance === "ai_generated" ||
      args.provenance === "ai_assisted"
    ) {
      return { ok: false, reason: "ai_content_requires_human_approval" };
    }
    return { ok: false, reason: "not_approved" };
  }
  if (args.provenance === "licensed_third_party" && !args.licenceRef) {
    return { ok: false, reason: "licensed_content_requires_licence_ref" };
  }
  if (
    args.reviewerStaffId !== undefined &&
    args.reviewerStaffId === args.authorStaffId
  ) {
    return { ok: false, reason: "reviewer_cannot_be_author" };
  }
  return { ok: true };
}

export interface GuidedTier {
  readonly tierKey: string;
  readonly includedPackageKeys: readonly string[];
  readonly priceMinorUnits: number;
}

export type TierCoherenceCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "tier_includes_unknown_package"
        | "higher_tier_omits_lower_tier_package"
        | "higher_tier_not_more_expensive";
      readonly detail?: string;
    };

/**
 * "Customer selects a coherent tier" is the acceptance criterion, and
 * incoherence has a specific shape: a more expensive tier that silently
 * drops something a cheaper one included. A customer who upgrades and
 * loses a service will not read the small print first — they will simply
 * be angry, correctly.
 */
export function checkTierCoherence(args: {
  readonly tiers: readonly GuidedTier[];
  readonly knownPackageKeys: readonly string[];
}): TierCoherenceCheck {
  const known = new Set(args.knownPackageKeys);
  for (const tier of args.tiers) {
    for (const key of tier.includedPackageKeys) {
      if (!known.has(key)) {
        return {
          ok: false,
          reason: "tier_includes_unknown_package",
          detail: `${tier.tierKey} -> ${key}`,
        };
      }
    }
  }
  const ordered = [...args.tiers].sort(
    (a, b) => a.priceMinorUnits - b.priceMinorUnits,
  );
  for (let index = 1; index < ordered.length; index += 1) {
    const lower = ordered[index - 1]!;
    const higher = ordered[index]!;
    if (higher.priceMinorUnits === lower.priceMinorUnits) {
      return {
        ok: false,
        reason: "higher_tier_not_more_expensive",
        detail: `${lower.tierKey} and ${higher.tierKey}`,
      };
    }
    const missing = lower.includedPackageKeys.filter(
      (key) => !higher.includedPackageKeys.includes(key),
    );
    if (missing.length > 0) {
      return {
        ok: false,
        reason: "higher_tier_omits_lower_tier_package",
        detail: `${higher.tierKey} omits ${missing.join(", ")}`,
      };
    }
  }
  return { ok: true };
}

/**
 * Roleplay training personas (ADV-108 / PHASE 17.8) — a published,
 * fixed catalog, not AI-invented on the fly, so every advisor practices
 * against the same named scenarios regardless of who is running the
 * session. The live AI conversation that plays a persona out loud is a
 * separate, provider-backed concern (`@paon/ai`); this catalog is only
 * the scenario definition a grade can be tagged against, layered onto
 * the existing `academy_roleplay_grades` grading loop rather than a
 * second one.
 */
export const ACADEMY_ROLEPLAY_PERSONAS = [
  "first_time_buyer",
  "browser",
  "know_it_all",
  "couple",
  "complaint_handling",
  "white_glove",
] as const;
export type AcademyRoleplayPersona = (typeof ACADEMY_ROLEPLAY_PERSONAS)[number];

export const ACADEMY_ROLEPLAY_PERSONA_LABELS: Record<
  AcademyRoleplayPersona,
  string
> = {
  first_time_buyer:
    "First-time buyer — never owned a tailored garment, needs education before a decision.",
  browser:
    "Browser — no urgency, testing whether the advisor adds value before committing time.",
  know_it_all:
    "Know-it-all — has strong opinions (often wrong), needs correcting without condescension.",
  couple:
    "Couple — two decision-makers with different priorities in the same conversation.",
  complaint_handling:
    "Complaint handling — dissatisfied with a past purchase or service, needs recovery, not just an apology.",
  white_glove:
    "White-glove — an established client expecting a fully anticipatory, low-friction experience.",
};

export interface RubricEvidence {
  readonly criterionKey: string;
  readonly evidenceRef: string;
  readonly observedBehaviour: string;
}

export type RoleplayGradeCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        "grade_without_evidence" | "no_criteria" | "evidence_ref_required";
    };

/**
 * A roleplay grade must cite what was actually observed. Ungrounded
 * feedback ("be more consultative") teaches nothing and cannot be
 * disputed, which are the same problem seen from two sides.
 */
export function checkRoleplayGrade(args: {
  readonly evidence: readonly RubricEvidence[];
}): RoleplayGradeCheck {
  if (args.evidence.length === 0) return { ok: false, reason: "no_criteria" };
  for (const entry of args.evidence) {
    if (entry.observedBehaviour.trim().length < 10) {
      return { ok: false, reason: "grade_without_evidence" };
    }
    if (entry.evidenceRef.trim().length === 0) {
      return { ok: false, reason: "evidence_ref_required" };
    }
  }
  return { ok: true };
}

export const PROJECT_STATES = [
  "requested",
  "scoped",
  "in_delivery",
  "delivered",
  "closed",
] as const;
export type ProjectState = (typeof PROJECT_STATES)[number];

export type ProjectCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "transition_not_allowed"
        | "scope_requires_deliverables"
        | "delivery_requires_retailer_visible_deliverable"
        | "close_requires_approval";
    };

const PROJECT_GRAPH: Readonly<Record<ProjectState, readonly ProjectState[]>> = {
  requested: ["scoped"],
  scoped: ["in_delivery"],
  in_delivery: ["delivered"],
  delivered: ["closed"],
  closed: [],
};

/**
 * A consultancy project cannot close without the retailer's approval, and
 * cannot enter delivery without at least one deliverable the retailer can
 * actually see. Consultancy whose output is invisible to the client is
 * consultancy nobody can evaluate.
 */
export function checkProjectTransition(args: {
  readonly from: ProjectState;
  readonly to: ProjectState;
  readonly deliverableCount: number;
  readonly retailerVisibleDeliverableCount: number;
  readonly retailerApproved?: boolean;
}): ProjectCheck {
  if (!PROJECT_GRAPH[args.from].includes(args.to)) {
    return { ok: false, reason: "transition_not_allowed" };
  }
  if (args.to === "in_delivery" && args.deliverableCount === 0) {
    return { ok: false, reason: "scope_requires_deliverables" };
  }
  if (args.to === "delivered" && args.retailerVisibleDeliverableCount === 0) {
    return {
      ok: false,
      reason: "delivery_requires_retailer_visible_deliverable",
    };
  }
  if (args.to === "closed" && !args.retailerApproved) {
    return { ok: false, reason: "close_requires_approval" };
  }
  return { ok: true };
}

export type MediaActivationCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "licence_required"
        | "rights_expired"
        | "territory_not_covered"
        | "not_approved";
    };

/**
 * Rights-aware activation. A piece with no stated licence is refused
 * rather than assumed free — "we found it online" is how a publisher
 * complaint starts.
 */
export function checkMediaActivation(args: {
  readonly provenance: ContentProvenance;
  readonly reviewState: ContentReviewState;
  readonly licenceRef?: string;
  readonly rightsExpireOn?: string;
  readonly territories?: readonly string[];
  readonly retailerTerritory: string;
  readonly asOf: string;
}): MediaActivationCheck {
  if (args.reviewState !== "human_approved") {
    return { ok: false, reason: "not_approved" };
  }
  if (args.provenance === "licensed_third_party" && !args.licenceRef) {
    return { ok: false, reason: "licence_required" };
  }
  if (
    args.rightsExpireOn &&
    Date.parse(args.asOf) > Date.parse(args.rightsExpireOn)
  ) {
    return { ok: false, reason: "rights_expired" };
  }
  if (
    args.territories &&
    args.territories.length > 0 &&
    !args.territories.includes(args.retailerTerritory)
  ) {
    return { ok: false, reason: "territory_not_covered" };
  }
  return { ok: true };
}

export const HYPOTHESIS_EVIDENCE_KINDS = [
  "demand",
  "margin",
  "supplier",
  "quality",
] as const;
export type HypothesisEvidenceKind = (typeof HYPOTHESIS_EVIDENCE_KINDS)[number];

export interface ProductHypothesisAssessment {
  readonly state: "hypothesis" | "evidenced";
  readonly missingEvidenceKinds: readonly HypothesisEvidenceKind[];
  /** Always false. Buying stock is a separate, human decision that this
   * module has no way to express. */
  readonly authorisesPurchase: false;
}

/**
 * A future product stays a hypothesis until demand, margin, supplier and
 * quality evidence all exist. Returning `authorisesPurchase: false`
 * unconditionally is deliberate: the non-goal is "no speculative stock
 * purchase", and the honest way to honour it is for this function to have
 * no success case that means "buy it".
 */
export function evaluateProductHypothesis(args: {
  readonly evidenceKinds: readonly HypothesisEvidenceKind[];
}): ProductHypothesisAssessment {
  const present = new Set(args.evidenceKinds);
  const missing = HYPOTHESIS_EVIDENCE_KINDS.filter(
    (kind) => !present.has(kind),
  );
  return {
    state: missing.length === 0 ? "evidenced" : "hypothesis",
    missingEvidenceKinds: missing,
    authorisesPurchase: false,
  };
}
