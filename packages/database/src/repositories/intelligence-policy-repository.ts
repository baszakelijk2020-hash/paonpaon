/**
 * Typed intelligence policy repository (CLI-009 / PHASE 7.8).
 */

import {
  asId,
  buildDefaultPlatformPolicyConfig,
  type ConsentPurpose,
  type IntelligencePolicyConfig,
  type IntelligencePolicyRule,
  type PolicyDecision,
  type PolicyPlane,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type Row = Database["public"]["Tables"]["intelligence_policy_configs"]["Row"];

function toRule(row: Row): IntelligencePolicyRule {
  return {
    plane: row.plane as PolicyPlane,
    purpose: row.purpose as ConsentPurpose,
    decision: row.decision as PolicyDecision,
    reason: row.reason,
  };
}

export class IntelligencePolicyRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async loadForRetailer(args: {
    readonly retailerId?: RetailerId;
    readonly now?: string;
  }): Promise<IntelligencePolicyConfig> {
    const now = args.now ?? new Date().toISOString();
    const { data, error } = await this.client
      .from("intelligence_policy_configs")
      .select("*")
      .or(
        args.retailerId
          ? `retailer_id.is.null,retailer_id.eq.${args.retailerId}`
          : "retailer_id.is.null",
      );
    if (error) throw error;

    const rows = data ?? [];
    const retailerRows = args.retailerId
      ? rows.filter((row) => row.retailer_id === args.retailerId)
      : [];
    const platformRows = rows.filter((row) => row.retailer_id === null);

    const merged = new Map<string, Row>();
    for (const row of platformRows) {
      merged.set(`${row.plane}:${row.purpose}`, row);
    }
    for (const row of retailerRows) {
      merged.set(`${row.plane}:${row.purpose}`, row);
    }

    if (merged.size === 0) {
      return buildDefaultPlatformPolicyConfig({ now });
    }

    const rules = [...merged.values()].map(toRule);
    const anonymousCaptureAllowed = [...merged.values()].some(
      (row) => row.anonymous_capture_allowed,
    );
    const jurisdictionCode =
      retailerRows.find((row) => row.jurisdiction_code)?.jurisdiction_code ??
      platformRows.find((row) => row.jurisdiction_code)?.jurisdiction_code ??
      undefined;

    return {
      ...(args.retailerId
        ? { retailerId: asId<"RetailerId">(args.retailerId) }
        : {}),
      ...(jurisdictionCode ? { jurisdictionCode } : {}),
      anonymousCaptureAllowed,
      rules,
      updatedAt: now,
    };
  }
}
