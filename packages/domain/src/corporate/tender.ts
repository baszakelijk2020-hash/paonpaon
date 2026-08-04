/**
 * Corporate tenders (BD-102 / PHASE 18.2).
 *
 * A tender is authored against an opportunity, never a dead one: a
 * `lost` opportunity gets no new tenders, because a tender is a live
 * commercial document, not a pitch archive.
 *
 * Versions are append-only and immutable once written — the same
 * discipline `corporate_entitlement_versions` (14.1) already applies to
 * policy, applied here to commercial content for the same reason: a
 * tender that could be silently edited after a company has seen it is a
 * tender whose history nobody can trust. Approval is modelled as its own
 * append-only fact (`corporate_tender_approvals`), not a mutable flag on
 * the version — a `unique` constraint on the version id is what actually
 * prevents double-approval, not application code alone.
 */

import type {
  CorporateTenderApprovalId,
  CorporateTenderId,
  CorporateTenderVersionId,
  RetailerId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

import type { CorporateOpportunityStage } from "./business-development";

export interface CorporateTender extends Timestamps {
  readonly id: CorporateTenderId;
  readonly retailerId: RetailerId;
  readonly opportunityId: string;
  readonly title: string;
}

export interface CorporateTenderVersion {
  readonly id: CorporateTenderVersionId;
  readonly retailerId: RetailerId;
  readonly tenderId: CorporateTenderId;
  readonly version: number;
  readonly summary: string;
  readonly garmentConcepts: readonly string[];
  readonly pricingNote?: string;
  readonly createdAt: string;
}

export interface CorporateTenderApproval {
  readonly id: CorporateTenderApprovalId;
  readonly retailerId: RetailerId;
  readonly tenderVersionId: CorporateTenderVersionId;
  readonly approvedByStaffId: string;
  readonly approvedAt: string;
}

export type CreateTenderCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: "title_required" | "opportunity_lost";
    };

export function checkCreateTender(args: {
  readonly title: string;
  readonly opportunityStage: CorporateOpportunityStage;
}): CreateTenderCheck {
  if (args.opportunityStage === "lost") {
    return { ok: false, reason: "opportunity_lost" };
  }
  if (args.title.trim().length === 0) {
    return { ok: false, reason: "title_required" };
  }
  return { ok: true };
}

export type CreateTenderVersionCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: "summary_required" | "garment_concepts_required";
    };

export function checkCreateTenderVersion(args: {
  readonly summary: string;
  readonly garmentConcepts: readonly string[];
}): CreateTenderVersionCheck {
  if (args.summary.trim().length === 0) {
    return { ok: false, reason: "summary_required" };
  }
  if (args.garmentConcepts.filter((c) => c.trim().length > 0).length === 0) {
    return { ok: false, reason: "garment_concepts_required" };
  }
  return { ok: true };
}
