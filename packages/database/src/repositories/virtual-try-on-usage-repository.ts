/**
 * Virtual try-on transactional budget ledger persistence (PHASE 17.10 /
 * ADV-110). Every write goes through `reserve_virtual_try_on_generation` /
 * `settle_virtual_try_on_generation` (migration `20260809170000`) — this
 * repository never inserts/updates either table directly, same discipline
 * as `WardrobeVisualizationJobRepository`.
 */

import {
  asId,
  type CurrencyCode,
  type CustomerId,
  type ReserveVirtualTryOnGenerationInput,
  type RetailerId,
  type RetailerVirtualTryOnPolicy,
  type SettleVirtualTryOnGenerationInput,
  type VirtualTryOnDenialReason,
  type VirtualTryOnLedgerStatus,
  type VirtualTryOnMediaKind,
  type VirtualTryOnQualityLevel,
  type VirtualTryOnTrigger,
  type VirtualTryOnUsageLedgerEntry,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type LedgerRow =
  Database["public"]["Tables"]["virtual_try_on_usage_ledger"]["Row"];
type PolicyRow =
  Database["public"]["Tables"]["retailer_virtual_try_on_policies"]["Row"];

function toEntry(row: LedgerRow): VirtualTryOnUsageLedgerEntry {
  return {
    id: asId<"VirtualTryOnUsageLedgerId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    ...(row.store_id
      ? { storeId: asId<"RetailerBranchId">(row.store_id) }
      : {}),
    customerId: asId<"CustomerId">(row.customer_id),
    ...(row.requested_by_staff_id
      ? { requestedByStaffId: asId<"StaffId">(row.requested_by_staff_id) }
      : {}),
    ...(row.campaign_id
      ? { campaignId: asId<"CampaignId">(row.campaign_id) }
      : {}),
    provider: row.provider,
    model: row.model,
    endpoint: row.endpoint,
    mediaKind: row.media_kind as VirtualTryOnMediaKind,
    quality: row.quality as VirtualTryOnQualityLevel,
    trigger: row.trigger as VirtualTryOnTrigger,
    inputAssetIds: row.input_asset_ids,
    ...(row.output_asset_id ? { outputAssetId: row.output_asset_id } : {}),
    ...(row.credits_reserved !== null
      ? { creditsReserved: row.credits_reserved }
      : {}),
    ...(row.credits_consumed !== null
      ? { creditsConsumed: row.credits_consumed }
      : {}),
    estimatedCost: {
      amountMinorUnits: row.estimated_cost_minor_units,
      currency: row.estimated_cost_currency as CurrencyCode,
    },
    ...(row.actual_cost_minor_units !== null && row.actual_cost_currency
      ? {
          actualCost: {
            amountMinorUnits: row.actual_cost_minor_units,
            currency: row.actual_cost_currency as CurrencyCode,
          },
        }
      : {}),
    ...(row.internal_cost_minor_units !== null && row.internal_cost_currency
      ? {
          internalCost: {
            amountMinorUnits: row.internal_cost_minor_units,
            currency: row.internal_cost_currency as CurrencyCode,
          },
        }
      : {}),
    ...(row.conversion_event ? { conversionEvent: row.conversion_event } : {}),
    ...(row.attributed_revenue_minor_units !== null &&
    row.attributed_revenue_currency
      ? {
          attributedRevenue: {
            amountMinorUnits: row.attributed_revenue_minor_units,
            currency: row.attributed_revenue_currency as CurrencyCode,
          },
        }
      : {}),
    cacheHit: row.cache_hit,
    status: row.status as VirtualTryOnLedgerStatus,
    ...(row.denial_reason
      ? { denialReason: row.denial_reason as VirtualTryOnDenialReason }
      : {}),
    ...(row.failure_code ? { failureCode: row.failure_code } : {}),
    createdAt: row.created_at,
    ...(row.settled_at ? { settledAt: row.settled_at } : {}),
  };
}

function toPolicy(row: PolicyRow): RetailerVirtualTryOnPolicy {
  return {
    retailerId: asId<"RetailerId">(row.retailer_id),
    enabled: row.enabled,
    currency: row.currency as CurrencyCode,
    monthlyBudgetMinorUnits: row.monthly_budget_minor_units,
    perCustomerMonthlyBudgetMinorUnits:
      row.per_customer_monthly_budget_minor_units,
    maxCustomerGenerationsPerDay: row.max_customer_generations_per_day,
    maxCustomerGenerationsPerWeek: row.max_customer_generations_per_week,
    maxCustomerGenerationsPerMonth: row.max_customer_generations_per_month,
    allowImage: row.allow_image,
    allowVideo: row.allow_video,
  };
}

export class VirtualTryOnUsageRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  /** Re-derives caller identity and every authorization gate server-side —
   * always inserts one row, including a denial. */
  async reserve(
    input: ReserveVirtualTryOnGenerationInput,
  ): Promise<VirtualTryOnUsageLedgerEntry> {
    const { data, error } = await this.client.rpc(
      "reserve_virtual_try_on_generation",
      {
        p_retailer_id: input.retailerId,
        p_customer_id: input.customerId,
        // The generated RPC arg types don't reflect that these SQL uuid
        // params accept null (supabase-js codegen only marks a param
        // nullable when it has an explicit SQL default) — both genuinely
        // are optional server-side.
        p_store_id: (input.storeId ?? null) as string,
        p_campaign_id: (input.campaignId ?? null) as string,
        p_provider: input.provider,
        p_model: input.model,
        p_endpoint: input.endpoint,
        p_media_kind: input.mediaKind,
        p_quality: input.quality,
        p_trigger: input.trigger,
        p_input_asset_ids: [...input.inputAssetIds],
        p_persist_portrait: input.persistPortrait,
        p_provider_estimate_minor_units:
          input.providerEstimate.amountMinorUnits,
        p_provider_estimate_currency: input.providerEstimate.currency,
        p_cache_hit: input.cacheHit,
        p_commercially_justified: input.commerciallyJustified,
      },
    );
    if (error) throw error;
    return toEntry(data);
  }

  /** service_role only — settles exactly one reserved (`authorized`) row. */
  async settle(
    input: SettleVirtualTryOnGenerationInput,
  ): Promise<VirtualTryOnUsageLedgerEntry> {
    const { data, error } = await this.client.rpc(
      "settle_virtual_try_on_generation",
      {
        p_ledger_id: input.ledgerId,
        p_status: input.status,
        ...(input.outputAssetId !== undefined
          ? { p_output_asset_id: input.outputAssetId }
          : {}),
        ...(input.creditsConsumed !== undefined
          ? { p_credits_consumed: input.creditsConsumed }
          : {}),
        ...(input.actualCost !== undefined
          ? {
              p_actual_cost_minor_units: input.actualCost.amountMinorUnits,
              p_actual_cost_currency: input.actualCost.currency,
            }
          : {}),
        ...(input.internalCost !== undefined
          ? {
              p_internal_cost_minor_units: input.internalCost.amountMinorUnits,
              p_internal_cost_currency: input.internalCost.currency,
            }
          : {}),
        ...(input.conversionEvent !== undefined
          ? { p_conversion_event: input.conversionEvent }
          : {}),
        ...(input.attributedRevenue !== undefined
          ? {
              p_attributed_revenue_minor_units:
                input.attributedRevenue.amountMinorUnits,
              p_attributed_revenue_currency: input.attributedRevenue.currency,
            }
          : {}),
        ...(input.failureCode !== undefined
          ? { p_failure_code: input.failureCode }
          : {}),
      },
    );
    if (error) throw error;
    return toEntry(data);
  }

  async findPolicyForRetailer(
    retailerId: RetailerId,
  ): Promise<RetailerVirtualTryOnPolicy | null> {
    const { data, error } = await this.client
      .from("retailer_virtual_try_on_policies")
      .select("*")
      .eq("retailer_id", retailerId)
      .maybeSingle();
    if (error) throw error;
    return data ? toPolicy(data) : null;
  }

  async findById(id: string): Promise<VirtualTryOnUsageLedgerEntry | null> {
    const { data, error } = await this.client
      .from("virtual_try_on_usage_ledger")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? toEntry(data) : null;
  }

  async findByCustomer(
    customerId: CustomerId,
    limit = 50,
  ): Promise<VirtualTryOnUsageLedgerEntry[]> {
    const { data, error } = await this.client
      .from("virtual_try_on_usage_ledger")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data.map(toEntry);
  }
}
