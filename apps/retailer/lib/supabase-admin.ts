import "server-only";

import { createSupabaseAdminClient } from "@paon/database";

import { env } from "./env";

/**
 * Service-role client. Only ever imported from Server Actions that
 * have already checked `requireRetailerRole(role, "admin")` — see
 * docs/DATABASE.md "Row Level Security". Used here to invite
 * additional retailer staff via `auth.admin.*`, which the anon-key
 * client cannot do.
 */
export function getSupabaseAdminClient() {
  return createSupabaseAdminClient(env.supabaseUrl, env.supabaseServiceRoleKey);
}
