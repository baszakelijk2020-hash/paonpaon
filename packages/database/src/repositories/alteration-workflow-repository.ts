import {
  asId,
  money,
  type AlterationId,
  type AlterationTaskId,
  type CurrencyCode,
  type PriceChangeProposal,
  type PriceChangeProposalId,
  type StaffId,
  type WorkshopId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type ProposalRow =
  Database["public"]["Tables"]["price_change_proposals"]["Row"];

function proposalToDomain(row: ProposalRow): PriceChangeProposal {
  return {
    id: asId<"PriceChangeProposalId">(row.id),
    alterationId: asId<"AlterationId">(row.alteration_id),
    ...(row.task_id ? { taskId: asId<"AlterationTaskId">(row.task_id) } : {}),
    retailerId: asId<"RetailerId">(row.retailer_id),
    originalAmount: money(
      row.original_amount_minor_units,
      row.currency as CurrencyCode,
    ),
    proposedAmount: money(
      row.proposed_amount_minor_units,
      row.currency as CurrencyCode,
    ),
    explanation: row.explanation,
    ...(row.evidence_attachment_id
      ? {
          evidenceAttachmentId: asId<"AlterationAttachmentId">(
            row.evidence_attachment_id,
          ),
        }
      : {}),
    status: row.status,
    proposedByStaffId: asId<"StaffId">(row.proposed_by_staff_id),
    ...(row.decided_by_staff_id
      ? { decidedByStaffId: asId<"StaffId">(row.decided_by_staff_id) }
      : {}),
    ...(row.decided_at ? { decidedAt: row.decided_at } : {}),
    ...(row.decision_reason ? { decisionReason: row.decision_reason } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export class AlterationWorkflowRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findPriceProposals(
    alterationId: AlterationId,
  ): Promise<PriceChangeProposal[]> {
    const { data, error } = await this.client
      .from("price_change_proposals")
      .select("*")
      .eq("alteration_id", alterationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data.map(proposalToDomain);
  }

  async proposePriceChange(params: {
    alterationId: AlterationId;
    taskId?: AlterationTaskId;
    proposedAmountMinorUnits: number;
    explanation: string;
    evidenceAttachmentId?: string;
  }): Promise<PriceChangeProposalId> {
    const { data, error } = await this.client.rpc(
      "propose_alteration_price_change",
      {
        p_alteration_id: params.alterationId,
        p_task_id: (params.taskId ?? null) as never,
        p_proposed_amount_minor_units: params.proposedAmountMinorUnits,
        p_explanation: params.explanation,
        ...(params.evidenceAttachmentId
          ? { p_evidence_attachment_id: params.evidenceAttachmentId }
          : {}),
      },
    );
    if (error) throw error;
    return asId<"PriceChangeProposalId">(data);
  }

  async decidePriceChange(params: {
    proposalId: PriceChangeProposalId;
    decision: "approved" | "rejected";
    reason: string;
  }): Promise<void> {
    const { error } = await this.client.rpc("decide_alteration_price_change", {
      p_proposal_id: params.proposalId,
      p_decision: params.decision,
      p_reason: params.reason,
    });
    if (error) throw error;
  }

  async assign(params: {
    alterationId: AlterationId;
    workshopId: WorkshopId;
    targetCompletionDate?: string;
  }): Promise<void> {
    const { error } = await this.client.rpc("assign_alteration_work_order", {
      p_alteration_id: params.alterationId,
      p_workshop_id: params.workshopId,
      p_target_completion_date: (params.targetCompletionDate ?? null) as never,
    });
    if (error) throw error;
  }

  async findActiveAssignment(alterationId: AlterationId) {
    const { data, error } = await this.client
      .from("work_order_assignments")
      .select("*")
      .eq("alteration_id", alterationId)
      .eq("active", true)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async updateWorkshopAssignment(params: {
    alterationId: AlterationId;
    workerId?: StaffId;
    targetCompletionDate?: string;
  }): Promise<void> {
    const { error } = await this.client.rpc("update_workshop_assignment", {
      p_alteration_id: params.alterationId,
      p_worker_id: (params.workerId ?? null) as never,
      p_target_completion_date: (params.targetCompletionDate ?? null) as never,
    });
    if (error) throw error;
  }
}
