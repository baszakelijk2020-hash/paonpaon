/**
 * AI-assisted corporate tender concept/moodboard generation (BD-110 /
 * PHASE 18.10). The live image generation call itself lives in
 * `@paon/ai` (`generateConceptImages`, `runConceptGenerationJob`) —
 * this file is the persistence-side "not a black box" rule that carries
 * over from `17.1` (advisor capture): every generated asset is
 * attributable to a real AI generation attempt via the existing
 * `AIGenerationRepository` audit trail (a `corporate_concept` kind, not
 * a second log), stays editable/removable, and can never reach `18.3`'s
 * public tender page without an explicit, one-time staff approval
 * action — enforced by `checkDecideConceptAsset` here and, ultimately,
 * by `resolve_corporate_tender` in SQL only ever selecting `approved`
 * rows.
 */

import type {
  CorporateConceptAssetId,
  CorporateTenderVersionId,
  RetailerId,
  StaffId,
} from "../shared/branded-id";

export const CORPORATE_CONCEPT_ASSET_STATUSES = [
  "pending_approval",
  "approved",
  "rejected",
] as const;
export type CorporateConceptAssetStatus =
  (typeof CORPORATE_CONCEPT_ASSET_STATUSES)[number];

export interface CorporateConceptAsset {
  readonly id: CorporateConceptAssetId;
  readonly retailerId: RetailerId;
  readonly tenderVersionId: CorporateTenderVersionId;
  /** The `ai_generations` row this asset came from — the existing audit
   * trail, never a second, parallel log of the same attempt. */
  readonly aiGenerationId: string;
  readonly imageUrl: string;
  readonly prompt: string;
  readonly status: CorporateConceptAssetStatus;
  readonly approvedByStaffId?: StaffId;
  readonly approvedAt?: string;
  readonly createdAt: string;
}

export type DecideConceptAssetCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "already_decided" };

/** A decision is exactly once — an already approved or rejected asset
 * cannot be re-decided, mirroring the tender-version approval discipline
 * (`18.2`) rather than allowing a quiet flip-flop on externally
 * shareable content. */
export function checkDecideConceptAsset(args: {
  readonly status: CorporateConceptAssetStatus;
}): DecideConceptAssetCheck {
  if (args.status !== "pending_approval") {
    return { ok: false, reason: "already_decided" };
  }
  return { ok: true };
}
