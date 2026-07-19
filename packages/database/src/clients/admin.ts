import { createClient } from "@supabase/supabase-js";

import type { Database } from "../generated/database.types";

/**
 * Service-role client. Bypasses RLS entirely — never import this into
 * client-rendered code or any module reachable from a browser bundle.
 * Restricted to trusted server contexts: webhooks, cron jobs, admin-only
 * server actions that have already authorized the caller. See
 * DATABASE.md "Row Level Security".
 */
export function createSupabaseAdminClient(
  supabaseUrl: string,
  serviceRoleKey: string,
) {
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
