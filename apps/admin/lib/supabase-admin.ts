import "server-only";

import { createSupabaseAdminClient } from "@paon/database";

import { env } from "./env";

/**
 * Service-role client. Only ever imported from Server Actions that have
 * already checked `requirePlatformOperator` — see
 * docs/DATABASE.md "Row Level Security". Used here to invite retailer
 * owners and platform staff via `auth.admin.*`, which the anon-key
 * client cannot do.
 */
export function getSupabaseAdminClient() {
  return createSupabaseAdminClient(env.supabaseUrl, env.supabaseServiceRoleKey);
}
