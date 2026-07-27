import "server-only";

import {
  requirePlatformSession,
  resolveAppSession,
  type AppSession,
} from "@paon/auth";
import { PlatformStaffRepository, retryUntilFound } from "@paon/database";
import { redirect } from "next/navigation";

import { getSupabaseServerClient } from "./supabase-server";

export async function getSession(): Promise<AppSession | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return resolveAppSession(data.user);
}

/**
 * Server Component / Server Action guard: redirects to /login instead
 * of throwing when unauthenticated.
 *
 * The staff lookup retries on an empty result: confirmed in production
 * that this query intermittently comes back with zero rows — with no
 * error, and reproducible even bypassing RLS with a service-role
 * client — for a staff record proven to exist a moment later,
 * consistent with read-replica lag on Supabase's hosted Postgres. See
 * `retryUntilFound`.
 */
export async function requireSession(): Promise<
  AppSession & { platformRole: NonNullable<AppSession["platformRole"]> }
> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  const session = error || !data.user ? null : resolveAppSession(data.user);
  try {
    requirePlatformSession(session);
  } catch {
    redirect("/login");
  }
  const staff = await retryUntilFound(
    () => new PlatformStaffRepository(supabase).findByUserId(session.userId),
    (value) => Boolean(value?.acceptedAt),
  );
  if (!staff?.acceptedAt) redirect("/accept-invite");
  return session;
}
