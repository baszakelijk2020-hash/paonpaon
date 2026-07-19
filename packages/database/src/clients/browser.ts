import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "../generated/database.types";

/** Client-component Supabase client. Respects RLS via the anon key. */
export function createSupabaseBrowserClient(
  supabaseUrl: string,
  supabaseAnonKey: string,
) {
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
