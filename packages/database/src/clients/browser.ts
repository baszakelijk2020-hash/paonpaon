import { createBrowserClient } from "@supabase/ssr";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

/** Client-component Supabase client. Respects RLS via the anon key. */
export function createSupabaseBrowserClient(
  supabaseUrl: string,
  supabaseAnonKey: string,
): PaonSupabaseClient {
  return createBrowserClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
  ) as unknown as PaonSupabaseClient;
}
