import { type CookieMethodsServer, createServerClient } from "@supabase/ssr";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { fetchWithJwtClockSkewRetry } from "./resilient-fetch";

/**
 * Server-side Supabase client (Server Components, Route Handlers,
 * Server Actions). Takes the cookie adapter as a parameter rather than
 * reaching into `next/headers` itself, so this package stays usable
 * from any server runtime, not just Next.js.
 */
export function createSupabaseServerClient(
  supabaseUrl: string,
  supabaseAnonKey: string,
  cookies: CookieMethodsServer,
): PaonSupabaseClient {
  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies,
    global: { fetch: fetchWithJwtClockSkewRetry },
  }) as unknown as PaonSupabaseClient;
}
