import {
  asId,
  checkCreateTender,
  checkCreateTenderVersion,
  type CorporateOpportunityStage,
  type CorporateTender,
  type CorporateTenderApproval,
  type CorporateTenderId,
  type CorporateTenderVersion,
  type CorporateTenderVersionId,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type TenderRow = Database["public"]["Tables"]["corporate_tenders"]["Row"];
type VersionRow =
  Database["public"]["Tables"]["corporate_tender_versions"]["Row"];
type ApprovalRow =
  Database["public"]["Tables"]["corporate_tender_approvals"]["Row"];

function toTender(row: TenderRow): CorporateTender {
  return {
    id: asId<"CorporateTenderId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    opportunityId: row.opportunity_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toVersion(row: VersionRow): CorporateTenderVersion {
  return {
    id: asId<"CorporateTenderVersionId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    tenderId: asId<"CorporateTenderId">(row.tender_id),
    version: row.version,
    summary: row.summary,
    garmentConcepts: row.garment_concepts,
    ...(row.pricing_note ? { pricingNote: row.pricing_note } : {}),
    createdAt: row.created_at,
  };
}

function toApproval(row: ApprovalRow): CorporateTenderApproval {
  return {
    id: asId<"CorporateTenderApprovalId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    tenderVersionId: asId<"CorporateTenderVersionId">(row.tender_version_id),
    approvedByStaffId: row.approved_by_staff_id,
    approvedAt: row.approved_at,
  };
}

export type CreateTenderResult =
  | { readonly ok: true; readonly tender: CorporateTender }
  | {
      readonly ok: false;
      readonly reason: "title_required" | "opportunity_lost";
    };

export type CreateTenderVersionResult =
  | { readonly ok: true; readonly version: CorporateTenderVersion }
  | {
      readonly ok: false;
      readonly reason: "summary_required" | "garment_concepts_required";
    };

export type ApproveVersionResult =
  | { readonly ok: true; readonly approval: CorporateTenderApproval }
  | { readonly ok: false; readonly reason: "already_approved" };

/**
 * Corporate tenders (PHASE 18.2 / BD-102). Versions are append-only and
 * this repository never issues an update against
 * `corporate_tender_versions` — the migration grants none, so an attempt
 * would fail at the database, not just be discouraged in code.
 */
export class CorporateTenderRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findByOpportunity(
    opportunityId: string,
  ): Promise<readonly CorporateTender[]> {
    const { data, error } = await this.client
      .from("corporate_tenders")
      .select("*")
      .eq("opportunity_id", opportunityId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toTender);
  }

  async findById(tenderId: CorporateTenderId): Promise<CorporateTender | null> {
    const { data, error } = await this.client
      .from("corporate_tenders")
      .select("*")
      .eq("id", tenderId)
      .maybeSingle();
    if (error) throw error;
    return data ? toTender(data) : null;
  }

  async listVersions(
    tenderId: CorporateTenderId,
  ): Promise<readonly CorporateTenderVersion[]> {
    const { data, error } = await this.client
      .from("corporate_tender_versions")
      .select("*")
      .eq("tender_id", tenderId)
      .order("version", { ascending: false });
    if (error) throw error;
    return data.map(toVersion);
  }

  async listApprovals(
    tenderId: CorporateTenderId,
  ): Promise<readonly CorporateTenderApproval[]> {
    const versions = await this.listVersions(tenderId);
    if (versions.length === 0) return [];
    const { data, error } = await this.client
      .from("corporate_tender_approvals")
      .select("*")
      .in(
        "tender_version_id",
        versions.map((v) => v.id),
      );
    if (error) throw error;
    return data.map(toApproval);
  }

  async create(args: {
    readonly retailerId: RetailerId;
    readonly opportunityId: string;
    readonly opportunityStage: CorporateOpportunityStage;
    readonly title: string;
  }): Promise<CreateTenderResult> {
    const check = checkCreateTender({
      title: args.title,
      opportunityStage: args.opportunityStage,
    });
    if (!check.ok) return check;
    const { data, error } = await this.client
      .from("corporate_tenders")
      .insert({
        retailer_id: args.retailerId,
        opportunity_id: args.opportunityId,
        title: args.title.trim(),
      })
      .select("*")
      .single();
    if (error) throw error;
    return { ok: true, tender: toTender(data) };
  }

  /** Appends the next version number for this tender — never edits a
   * prior version in place. */
  async createVersion(args: {
    readonly retailerId: RetailerId;
    readonly tenderId: CorporateTenderId;
    readonly summary: string;
    readonly garmentConcepts: readonly string[];
    readonly pricingNote?: string;
    readonly createdByStaffId?: string;
  }): Promise<CreateTenderVersionResult> {
    const check = checkCreateTenderVersion({
      summary: args.summary,
      garmentConcepts: args.garmentConcepts,
    });
    if (!check.ok) return check;

    const existing = await this.listVersions(args.tenderId);
    const nextVersion = (existing[0]?.version ?? 0) + 1;

    const insert: Database["public"]["Tables"]["corporate_tender_versions"]["Insert"] =
      {
        retailer_id: args.retailerId,
        tender_id: args.tenderId,
        version: nextVersion,
        summary: args.summary.trim(),
        garment_concepts: args.garmentConcepts.filter(
          (c) => c.trim().length > 0,
        ),
        ...(args.pricingNote ? { pricing_note: args.pricingNote } : {}),
        ...(args.createdByStaffId
          ? { created_by_staff_id: args.createdByStaffId }
          : {}),
      };
    const { data, error } = await this.client
      .from("corporate_tender_versions")
      .insert(insert)
      .select("*")
      .single();
    if (error) throw error;
    return { ok: true, version: toVersion(data) };
  }

  /** The `unique(tender_version_id)` constraint on
   * `corporate_tender_approvals` is what actually prevents a second
   * approval — this catches that specific violation and turns it into a
   * typed refusal rather than a raw database error. */
  async approveVersion(args: {
    readonly retailerId: RetailerId;
    readonly tenderVersionId: CorporateTenderVersionId;
    readonly approvedByStaffId: string;
  }): Promise<ApproveVersionResult> {
    const { data, error } = await this.client
      .from("corporate_tender_approvals")
      .insert({
        retailer_id: args.retailerId,
        tender_version_id: args.tenderVersionId,
        approved_by_staff_id: args.approvedByStaffId,
      })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505")
        return { ok: false, reason: "already_approved" };
      throw error;
    }
    return { ok: true, approval: toApproval(data) };
  }
}
