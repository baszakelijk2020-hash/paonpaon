import { PlatformModuleRepository } from "@paon/database";
import {
  moduleAllowsAccess,
  type ModuleAccessMode,
  type PlatformModuleKey,
} from "@paon/domain";

import { requireSession } from "./session";
import { getSupabaseServerClient } from "./supabase-server";

/**
 * Authenticates a retailer request and enforces its effective module at the
 * server boundary. Navigation is only presentation; every mutation capable
 * of changing canonical state must pass this gate as well.
 */
export async function requireModuleSession(
  moduleKey: PlatformModuleKey,
  mode: ModuleAccessMode = "mutate",
) {
  const session = await requireSession();
  const configurations = await new PlatformModuleRepository(
    await getSupabaseServerClient(),
  ).resolveRetailer(session.retailerId);
  const configuration = configurations.find(
    (entry) => entry.moduleKey === moduleKey,
  );
  if (!moduleAllowsAccess(configuration, mode)) {
    throw new Error(
      `Module ${moduleKey} is not active for ${mode} access. ` +
        "Refresh the workspace or ask an owner to review the retailer plan.",
    );
  }
  return session;
}
