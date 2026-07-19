import "server-only";

import {
  requireRetailerSession,
  resolveAppSession,
  type AppSession,
} from "@paon/auth";
import { RetailerStaffRepository } from "@paon/database";
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
 * Server Component / Server Action guard for anything inside the
 * operational workspace: redirects to /login if unauthenticated or not
 * a Retailer Portal session, and to /accept-invite if the caller's
 * staff record hasn't accepted its invite yet (set a password) — an
 * invited-but-not-yet-accepted user is already "signed in" the moment
 * they follow the invite link (see /auth/confirm), so this is the one
 * place that stops them browsing the workspace before finishing setup.
 */
export async function requireSession(): Promise<
  AppSession & {
    retailerId: NonNullable<AppSession["retailerId"]>;
    retailerRole: NonNullable<AppSession["retailerRole"]>;
  }
> {
  const session = await getSession();
  try {
    requireRetailerSession(session);
  } catch {
    redirect("/login");
  }

  const supabase = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );

  if (!staff || !staff.acceptedAt) {
    redirect("/accept-invite");
  }

  return session;
}
