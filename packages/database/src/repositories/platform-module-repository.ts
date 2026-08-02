import {
  type ModuleEntitlementSource,
  type ModuleLifecycleState,
  type PlatformModuleKey,
  type RetailerId,
  type RetailerModuleConfiguration,
  type SourceAuthorityMode,
  type SubscriptionPlanId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";

export interface ModuleConfigurationEvent {
  readonly id: string;
  readonly retailerId: RetailerId;
  readonly moduleKey: PlatformModuleKey;
  readonly previousState?: ModuleLifecycleState;
  readonly nextState: ModuleLifecycleState;
  readonly previousAuthorityMode?: SourceAuthorityMode;
  readonly nextAuthorityMode: SourceAuthorityMode;
  readonly source: Exclude<ModuleEntitlementSource, "plan">;
  readonly reason?: string;
  readonly occurredAt: string;
}

/**
 * Effective module access and lifecycle operations (R0.3 / ADR-070).
 *
 * Resolution happens in the database because it combines a retailer's live
 * subscription with explicit add-ons/overrides. Navigation may consume the
 * result, but every protected operation must still enforce its module at the
 * server/database boundary.
 */
export class PlatformModuleRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async resolveRetailer(
    retailerId: RetailerId,
  ): Promise<readonly RetailerModuleConfiguration[]> {
    const { data, error } = await this.client.rpc("resolve_retailer_modules", {
      p_retailer_id: retailerId,
    });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      moduleKey: row.module_key as PlatformModuleKey,
      state: row.state as ModuleLifecycleState,
      authorityMode: row.authority_mode as SourceAuthorityMode,
      source: row.source as ModuleEntitlementSource,
    }));
  }

  /**
   * A single module's lifecycle state for a retailer, callable without a
   * platform-staff or retailer session. `resolveRetailer` above requires
   * one, so customer-facing entry points (storefront cart/checkout) need
   * this narrower lookup to enforce module state without a service-role
   * client on the request path.
   */
  async publicAccessState(
    retailerId: RetailerId,
    moduleKey: PlatformModuleKey,
  ): Promise<ModuleLifecycleState> {
    const { data, error } = await this.client.rpc(
      "retailer_module_access_state",
      {
        p_retailer_id: retailerId,
        p_module_key: moduleKey,
      },
    );
    if (error) throw error;
    return data as ModuleLifecycleState;
  }

  async configure(args: {
    readonly retailerId: RetailerId;
    readonly moduleKey: PlatformModuleKey;
    readonly state: ModuleLifecycleState;
    readonly authorityMode: SourceAuthorityMode;
    readonly source: Exclude<ModuleEntitlementSource, "plan">;
    readonly reason?: string;
  }): Promise<string> {
    const { data, error } = await this.client.rpc(
      "set_retailer_module_configuration",
      {
        p_retailer_id: args.retailerId,
        p_module_key: args.moduleKey,
        p_state: args.state,
        p_authority_mode: args.authorityMode,
        p_source: args.source,
        ...(args.reason ? { p_reason: args.reason } : {}),
      },
    );
    if (error) throw error;
    return data;
  }

  async jobEnabled(args: {
    readonly retailerId: RetailerId;
    readonly jobKey: string;
  }): Promise<boolean> {
    const { data, error } = await this.client.rpc(
      "retailer_module_job_enabled",
      {
        p_retailer_id: args.retailerId,
        p_job_key: args.jobKey,
      },
    );
    if (error) throw error;
    return data;
  }

  async replacePlanModules(
    planId: SubscriptionPlanId,
    moduleKeys: readonly PlatformModuleKey[],
  ): Promise<void> {
    const { error } = await this.client.rpc(
      "replace_subscription_plan_modules",
      {
        p_plan_id: planId,
        p_module_keys: [...moduleKeys],
      },
    );
    if (error) throw error;
  }

  async history(
    retailerId: RetailerId,
  ): Promise<readonly ModuleConfigurationEvent[]> {
    const { data, error } = await this.client
      .from("retailer_module_configuration_events")
      .select("*")
      .eq("retailer_id", retailerId)
      .order("occurred_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      retailerId: row.retailer_id as RetailerId,
      moduleKey: row.module_key as PlatformModuleKey,
      ...(row.previous_state
        ? { previousState: row.previous_state as ModuleLifecycleState }
        : {}),
      nextState: row.next_state as ModuleLifecycleState,
      ...(row.previous_authority_mode
        ? {
            previousAuthorityMode:
              row.previous_authority_mode as SourceAuthorityMode,
          }
        : {}),
      nextAuthorityMode: row.next_authority_mode as SourceAuthorityMode,
      source: row.source as Exclude<ModuleEntitlementSource, "plan">,
      ...(row.reason ? { reason: row.reason } : {}),
      occurredAt: row.occurred_at,
    }));
  }
}
