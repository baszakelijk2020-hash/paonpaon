import {
  PlatformModuleRepository,
  type PaonSupabaseClient,
} from "@paon/database";
import {
  moduleAllowsAccess,
  type ModuleAccessMode,
  type PlatformModuleKey,
  type RetailerId,
} from "@paon/domain";

/**
 * The retailer app's equivalent (`requireModuleSession`) resolves the
 * caller's own retailer from an authenticated staff session. Customer-facing
 * entry points have no such session — a signed-in customer, or an anonymous
 * storefront visitor, always targets a retailer named by the URL/request
 * instead — so this takes the target retailer explicitly and calls the
 * narrow public lookup rather than `resolveRetailer`, which requires a
 * platform-staff or retailer session the customer app never has.
 */
export async function assertRetailerModuleActive(
  supabase: PaonSupabaseClient,
  retailerId: RetailerId,
  moduleKey: PlatformModuleKey,
  mode: ModuleAccessMode = "mutate",
  message = "This isn't available right now. Please check back soon.",
): Promise<void> {
  const state = await new PlatformModuleRepository(supabase).publicAccessState(
    retailerId,
    moduleKey,
  );
  const allowed = moduleAllowsAccess(
    { moduleKey, state, authorityMode: "external", source: "plan" },
    mode,
  );
  if (!allowed) {
    throw new Error(message);
  }
}
