import "server-only";

import { createSupabaseServerClient } from "@paon/database";
import { cookies } from "next/headers";

import { env } from "./env";

/**
 * Server Component / Server Action Supabase client. Reads the current
 * request's cookies for the session; writes are silently dropped when
 * called from a Server Component that can't set cookies (middleware
 * refreshes the session cookie on the next request instead) — the
 * documented @supabase/ssr Next.js App Router pattern.
 */
export async function getSupabaseServerClient() {
  const cookieStore = await cookies();

  return createSupabaseServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet) {
      try {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      } catch {
        // Called from a Server Component — no response to write to.
      }
    },
  });
}
