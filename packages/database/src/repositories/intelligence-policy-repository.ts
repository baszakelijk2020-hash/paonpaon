/**
 * Intelligence policy + projection health repositories (PHASE 7.8).
 */

import {
  DEFAULT_INTELLIGENCE_POLICY,
  type IntelligencePolicyConfig,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type PolicyRow =
  Database["public"]["Tables"]["intelligence_policy_configs"]["Row"];
type HealthRow =
  Database["public"]["Tables"]["intelligence_projection_health"]["Row"];

function toPolicy(row: PolicyRow): IntelligencePolicyConfig {
  return {
    id: row.id,
    retailerId: row.retailer_id,
    ...(row.jurisdiction_tag ? { jurisdictionTag: row.jurisdiction_tag } : {}),
    allowAnonymousCapture: row.allow_anonymous_capture,
    allowPersonalizationProjection: row.allow_personalization_projection,
    allowAdvisorDisplay: row.allow_advisor_display,
    allowCustomerDisplay: row.allow_customer_display,
    allowExport: row.allow_export,
    allowActivation: row.allow_activation,
    retentionDaysPersonalization: row.retention_days_personalization,
    fieldMask: row.field_mask ?? DEFAULT_INTELLIGENCE_POLICY.fieldMask,
    version: row.policy_version,
  };
}

export interface ProjectionHealthRow {
  readonly id: string;
  readonly retailerId: string | null;
  readonly projectorVersion: string;
  readonly status: "healthy" | "degraded" | "failed" | "stale";
  readonly lagSeconds: number;
  readonly correctionRate: number;
  readonly explainabilityOk: boolean;
  readonly notes?: string;
  readonly observedAt: string;
}

function toHealth(row: HealthRow): ProjectionHealthRow {
  return {
    id: row.id,
    retailerId: row.retailer_id,
    projectorVersion: row.projector_version,
    status: row.status as ProjectionHealthRow["status"],
    lagSeconds: row.lag_seconds,
    correctionRate: Number(row.correction_rate),
    explainabilityOk: row.explainability_ok,
    ...(row.notes ? { notes: row.notes } : {}),
    observedAt: row.observed_at,
  };
}

export class IntelligencePolicyRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async getForRetailer(
    retailerId: RetailerId,
  ): Promise<IntelligencePolicyConfig> {
    const { data, error } = await this.client
      .from("intelligence_policy_configs")
      .select("*")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    if (data) return toPolicy(data);
    return {
      ...DEFAULT_INTELLIGENCE_POLICY,
      retailerId,
    };
  }
}

export class IntelligenceHealthRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async listRecent(limit = 40): Promise<ProjectionHealthRow[]> {
    const { data, error } = await this.client
      .from("intelligence_projection_health")
      .select("*")
      .order("observed_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data.map(toHealth);
  }

  async record(args: {
    readonly retailerId?: RetailerId;
    readonly projectorVersion: string;
    readonly status: ProjectionHealthRow["status"];
    readonly lagSeconds?: number;
    readonly correctionRate?: number;
    readonly explainabilityOk?: boolean;
    readonly notes?: string;
  }): Promise<ProjectionHealthRow> {
    const { data, error } = await this.client
      .from("intelligence_projection_health")
      .insert({
        ...(args.retailerId ? { retailer_id: args.retailerId } : {}),
        projector_version: args.projectorVersion,
        status: args.status,
        lag_seconds: args.lagSeconds ?? 0,
        correction_rate: args.correctionRate ?? 0,
        explainability_ok: args.explainabilityOk ?? true,
        ...(args.notes ? { notes: args.notes } : {}),
      })
      .select("*")
      .single();
    if (error) throw error;
    return toHealth(data);
  }
}
