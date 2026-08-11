"use server";

import { requireRetailerRole } from "@paon/auth";
import {
  IntegrationLifecycleRepository,
  SourceAuthorityRepository,
  orchestrateShopifyDeltaSync,
} from "@paon/database";
import {
  INTEGRATION_PROVIDERS,
  type ConnectionOperationalState,
  type IntegrationProvider,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface CreateConnectionActionState {
  formError?: string;
  success?: boolean;
}

export interface ConnectionLifecycleActionState {
  formError?: string;
}

/**
 * Create a new integration connection (PHASE 9.2). Local/mock connections
 * require no secrets and are immediately usable for manual sync triggers.
 * Operator-initiated, admin-gated.
 *
 * Uses the admin client deliberately: `integration_connections` grants
 * INSERT to `service_role` only (no authenticated-role policy exists —
 * connections were originally meant to be created by service-role jobs,
 * per this page's own prior placeholder copy). The `requireRetailerRole`
 * check above is the real authorization boundary for this write, the same
 * pattern this codebase already uses elsewhere for an authorized action
 * with no RLS backstop of its own (see `rehearseCampaign`/
 * `activateCampaignToStaffMissions` in the campaigns settings actions).
 */
export async function createConnection(
  _previous: CreateConnectionActionState,
  formData: FormData,
): Promise<CreateConnectionActionState> {
  const session = await requireModuleSession("platform_core");
  requireRetailerRole(session.retailerRole, "admin");

  const provider = String(
    formData.get("provider") ?? "",
  ) as IntegrationProvider;
  const displayName = String(formData.get("displayName") ?? "").trim();

  if (!displayName) {
    return { formError: "Display name is required." };
  }

  if (!INTEGRATION_PROVIDERS.includes(provider)) {
    return { formError: "Invalid provider selected." };
  }

  try {
    const admin = getSupabaseAdminClient();
    const repo = new SourceAuthorityRepository(admin);
    await repo.createConnection({
      retailerId: session.retailerId,
      provider,
      displayName,
    });

    revalidatePath("/settings/integrations");
    return { success: true };
  } catch (error) {
    return {
      formError:
        error instanceof Error ? error.message : "Failed to create connection.",
    };
  }
}

/**
 * Operator-facing pause/resume/disconnect (PHASE 9.2). Legality of the
 * requested transition is decided by the domain layer via
 * `IntegrationLifecycleRepository.transitionConnection` — this action only
 * authorizes the caller and reports the outcome, never re-implements the
 * state machine.
 */
export async function transitionConnection(
  _previous: ConnectionLifecycleActionState,
  formData: FormData,
): Promise<ConnectionLifecycleActionState> {
  const session = await requireModuleSession("platform_core");
  requireRetailerRole(session.retailerRole, "admin");

  const connectionId = String(formData.get("connectionId") ?? "");
  const requestedState = String(
    formData.get("requestedState") ?? "",
  ) as ConnectionOperationalState;
  const reason = formData.get("reason");

  if (
    !connectionId ||
    !["active", "paused", "disconnected"].includes(requestedState)
  ) {
    return { formError: "Invalid connection or requested state." };
  }

  const supabase = await getSupabaseServerClient();
  const repo = new IntegrationLifecycleRepository(supabase);
  const result = await repo.transitionConnection({
    retailerId: session.retailerId,
    connectionId,
    requestedState,
    ...(typeof reason === "string" && reason.trim()
      ? { reason: reason.trim() }
      : {}),
    // AppSession does not currently carry the retailer_staff_members row
    // id (only the auth.users id), so operational_state_changed_by is left
    // unset here — the column is nullable for exactly this reason. Wiring
    // real actor attribution is a follow-up, not a defect: nothing in 9.2's
    // acceptance requires it, and leaving it null is honest about what this
    // slice does not yet do.
  });

  if (!result.ok) {
    return {
      formError:
        result.reason === "already_in_state"
          ? "That connection is already in the requested state."
          : "That transition is not allowed from the connection's current state.",
    };
  }

  revalidatePath("/settings/integrations");
  return {};
}

export interface ShopifySyncActionState {
  formError?: string;
  lastRunSummary?: string;
}

/**
 * Manual trigger for one Shopify delta-sync cycle (PHASE 9.2). Uses the
 * service-role client because the underlying migration publish path
 * (packages/database/src/repositories/migration-job-repository.ts) writes
 * canonical customer/product/order rows that only `service_role` may write —
 * the same boundary 9.1's own migration cockpit already relies on. The
 * retailer session only ever authorizes the trigger; it never gets a write
 * path to canonical tables directly.
 */
export async function runShopifySync(
  _previous: ShopifySyncActionState,
  formData: FormData,
): Promise<ShopifySyncActionState> {
  const session = await requireModuleSession("platform_core");
  requireRetailerRole(session.retailerRole, "admin");

  const connectionId = String(formData.get("connectionId") ?? "");
  if (!connectionId) {
    return { formError: "Missing connection." };
  }

  const admin = getSupabaseAdminClient();
  const result = await orchestrateShopifyDeltaSync(admin, {
    retailerId: session.retailerId,
    connectionId,
    triggerKind: "manual",
  });

  revalidatePath("/settings/integrations");

  if (result.status === "failed") {
    return {
      formError: result.errorSummary ?? "Shopify sync failed.",
    };
  }
  return {
    lastRunSummary: `Synced ${result.recordsProcessed} record(s) into job ${result.jobId}.`,
  };
}
