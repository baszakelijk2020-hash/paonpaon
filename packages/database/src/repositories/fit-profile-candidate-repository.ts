import {
  asId,
  type CustomerId,
  type FitProfileCandidate,
  type FitProfileCandidateAction,
  type FitProfileCandidateId,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type FitProfileCandidateRow =
  Database["public"]["Tables"]["fit_profile_candidates"]["Row"];
type FitProfileCandidateActionRow =
  Database["public"]["Tables"]["fit_profile_candidate_actions"]["Row"];

export class FitProfileCandidateRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  private candidateToDomain(row: FitProfileCandidateRow): FitProfileCandidate {
    return {
      id: asId<"FitProfileCandidateId">(row.id),
      retailerId: asId<"RetailerId">(row.retailer_id),
      customerId: asId<"CustomerId">(row.customer_id),
      ...(row.fitting_session_id
        ? {
            fittingSessionId: asId<"FittingSessionId">(row.fitting_session_id),
          }
        : {}),
      status: row.status as
        | "proposed"
        | "advisor_approved"
        | "advisor_rejected"
        | "customer_confirmed",
      proposedMeasurements:
        (row.proposed_measurements as Record<string, unknown>) ?? {},
      idempotencyKey: row.idempotency_key,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private actionToDomain(
    row: FitProfileCandidateActionRow,
  ): FitProfileCandidateAction {
    return {
      id: asId<"FitProfileCandidateActionId">(row.id),
      fitProfileCandidateId: asId<"FitProfileCandidateId">(
        row.fit_profile_candidate_id,
      ),
      ...(row.action_by_staff_id
        ? { actionByStaffId: asId<"StaffId">(row.action_by_staff_id) }
        : {}),
      action: row.action as "approved" | "rejected",
      ...(row.note ? { note: row.note } : {}),
      createdAt: row.created_at,
    };
  }

  async findById(
    candidateId: FitProfileCandidateId,
  ): Promise<FitProfileCandidate | null> {
    const { data, error } = await this.client
      .from("fit_profile_candidates")
      .select("*")
      .eq("id", candidateId)
      .maybeSingle();
    if (error) throw error;
    return data ? this.candidateToDomain(data) : null;
  }

  async listByCustomer(
    customerId: CustomerId,
  ): Promise<readonly FitProfileCandidate[]> {
    const { data, error } = await this.client
      .from("fit_profile_candidates")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row: FitProfileCandidateRow) =>
      this.candidateToDomain(row),
    );
  }

  async listByRetailerAndStatus(
    retailerId: RetailerId,
    status:
      | "proposed"
      | "advisor_approved"
      | "advisor_rejected"
      | "customer_confirmed",
  ): Promise<readonly FitProfileCandidate[]> {
    const { data, error } = await this.client
      .from("fit_profile_candidates")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("status", status)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row: FitProfileCandidateRow) =>
      this.candidateToDomain(row),
    );
  }

  async propose(params: {
    observationIds: string[];
    proposedMeasurements: Record<string, unknown>;
    idempotencyKey: string;
  }): Promise<FitProfileCandidateId> {
    const { data, error } = await this.client.rpc(
      "propose_fit_profile_candidate",
      {
        p_observation_ids: params.observationIds,
        p_proposed_measurements: params.proposedMeasurements,
        p_idempotency_key: params.idempotencyKey,
      },
    );
    if (error) throw error;
    return asId<"FitProfileCandidateId">(data as string);
  }

  async approve(
    candidateId: FitProfileCandidateId,
    note?: string,
  ): Promise<void> {
    const { error } = await this.client.rpc("approve_fit_profile_candidate", {
      p_candidate_id: candidateId,
      p_note: note ?? null,
    });
    if (error) throw error;
  }

  async reject(
    candidateId: FitProfileCandidateId,
    note?: string,
  ): Promise<void> {
    const { error } = await this.client.rpc("reject_fit_profile_candidate", {
      p_candidate_id: candidateId,
      p_note: note ?? null,
    });
    if (error) throw error;
  }

  async confirm(candidateId: FitProfileCandidateId): Promise<void> {
    const { error } = await this.client.rpc("confirm_fit_profile_candidate", {
      p_candidate_id: candidateId,
    });
    if (error) throw error;
  }

  async getActions(
    candidateId: FitProfileCandidateId,
  ): Promise<readonly FitProfileCandidateAction[]> {
    const { data, error } = await this.client
      .from("fit_profile_candidate_actions")
      .select("*")
      .eq("fit_profile_candidate_id", candidateId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row: FitProfileCandidateActionRow) =>
      this.actionToDomain(row),
    );
  }
}
