import { createClient } from "@supabase/supabase-js";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

/**
 * Cookie-free client for trusted Node scripts and end-to-end setup code.
 * Browser UI must use createSupabaseBrowserClient instead.
 */
export function createSupabaseDirectClient(
  supabaseUrl: string,
  supabaseKey: string,
): PaonSupabaseClient {
  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as PaonSupabaseClient;
}
