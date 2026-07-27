import "server-only";

import {
  requireRetailerSession,
  resolveAppSession,
  type AppSession,
} from "@paon/auth";
import { RetailerStaffRepository, retryUntilFound } from "@paon/database";
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
 *
 * The staff lookup retries on an empty result: confirmed in production
 * that this query intermittently comes back with zero rows — with no
 * error, and reproducible even bypassing RLS with a service-role
 * client — for a staff record proven to exist a moment later,
 * consistent with read-replica lag on Supabase's hosted Postgres. See
 * `retryUntilFound`.
 */
export async function requireSession(): Promise<
  AppSession & {
    retailerId: NonNullable<AppSession["retailerId"]>;
    retailerRole: NonNullable<AppSession["retailerRole"]>;
  }
> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  const session = error || !data.user ? null : resolveAppSession(data.user);
  try {
    requireRetailerSession(session);
  } catch {
    redirect("/login");
  }

  const staff = await retryUntilFound(
    () => new RetailerStaffRepository(supabase).findByUserId(session.userId),
    (value) => Boolean(value?.acceptedAt),
  );

  if (!staff || !staff.acceptedAt) {
    const { createSupabaseAdminClient } = await import("@paon/database");
    const { env } = await import("./env");
    const adminClient = createSupabaseAdminClient(
      env.supabaseUrl,
      env.supabaseServiceRoleKey,
    );
    const { data: allRows } = await adminClient
      .from("retailer_staff_members")
      .select("id, retailer_id, user_id, role, accepted_at, deleted_at");
    const { data: authUsers } = await adminClient.auth.admin.listUsers({
      perPage: 1000,
    });
    const matchingAuthUsers = authUsers?.users.filter(
      (u) => u.email === session.email,
    );
    const { count: totalStaffCount } = await adminClient
      .from("retailer_staff_members")
      .select("*", { count: "exact", head: true });
    const { count: totalRetailerCount } = await adminClient
      .from("retailers")
      .select("*", { count: "exact", head: true });
    console.warn(
      "RETAILER_STAFF_DEBUG sessionUserId=" +
        session.userId +
        " sessionEmail=" +
        session.email +
        " supabaseUrl=" +
        env.supabaseUrl +
        " matchingAuthUserIds=" +
        JSON.stringify(matchingAuthUsers?.map((u) => u.id)) +
        " totalStaffCount=" +
        totalStaffCount +
        " totalRetailerCount=" +
        totalRetailerCount +
        " allStaffRows=" +
        JSON.stringify(
          allRows?.map((r) => ({
            id: r.id,
            user_id: r.user_id,
            role: r.role,
            accepted_at: r.accepted_at,
          })),
        ),
    );
    redirect("/accept-invite");
  }

  return session;
}
