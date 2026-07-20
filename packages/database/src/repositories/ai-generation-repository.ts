import {
  asId,
  type AIGeneration,
  type AIGenerationKind,
  type AIGenerationStatus,
  type CustomerId,
  type RetailerId,
  type StaffId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

type AIGenerationRow = Database["public"]["Tables"]["ai_generations"]["Row"];

function toDomain(row: AIGenerationRow): AIGeneration {
  return {
    id: row.id,
    retailerId: asId<"RetailerId">(row.retailer_id),
    ...(row.customer_id
      ? { customerId: asId<"CustomerId">(row.customer_id) }
      : {}),
    ...(row.requested_by_staff_id
      ? { requestedByStaffId: asId<"StaffId">(row.requested_by_staff_id) }
      : {}),
    kind: row.kind,
    status: row.status,
    provider: row.provider,
    model: row.model,
    inputSummary: row.input_summary,
    ...(row.output ? { output: row.output as Record<string, unknown> } : {}),
    ...(row.error_message ? { errorMessage: row.error_message } : {}),
    ...(row.latency_ms !== null ? { latencyMs: row.latency_ms } : {}),
    createdAt: row.created_at,
  };
}

export interface RecordAIGenerationParams {
  retailerId: RetailerId;
  customerId?: CustomerId;
  requestedByStaffId?: StaffId;
  kind: AIGenerationKind;
  status: AIGenerationStatus;
  provider: string;
  model: string;
  inputSummary: string;
  output?: Record<string, unknown>;
  errorMessage?: string;
  latencyMs?: number;
}

/** See `docs/ARCHITECTURE.md` "Data access layer" — this repository is the only code allowed to query `ai_generations`. Append-only: no update/delete method exists, matching the table's own grants. */
export class AIGenerationRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async record(params: RecordAIGenerationParams): Promise<AIGeneration> {
    const { data, error } = await this.client
      .from("ai_generations")
      .insert({
        retailer_id: params.retailerId,
        customer_id: params.customerId ?? null,
        requested_by_staff_id: params.requestedByStaffId ?? null,
        kind: params.kind,
        status: params.status,
        provider: params.provider,
        model: params.model,
        input_summary: params.inputSummary,
        output: (params.output as Json) ?? null,
        error_message: params.errorMessage ?? null,
        latency_ms: params.latencyMs ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toDomain(data);
  }

  async findByCustomer(
    customerId: CustomerId,
    limit = 10,
  ): Promise<AIGeneration[]> {
    const { data, error } = await this.client
      .from("ai_generations")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data.map(toDomain);
  }

  /** Platform-staff monitoring — see PAON Admin's AI monitoring page. */
  async findRecent(limit = 50): Promise<AIGeneration[]> {
    const { data, error } = await this.client
      .from("ai_generations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data.map(toDomain);
  }
}
