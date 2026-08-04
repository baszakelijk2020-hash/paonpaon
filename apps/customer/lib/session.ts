import "server-only";

import {
  requireCustomerSession,
  requireWearerSession,
  resolveAppSession,
  type AppSession,
} from "@paon/auth";
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

/** Server Component / Server Action guard: redirects to /login instead of throwing when unauthenticated. */
export async function requireSession(): Promise<
  AppSession & { accountType: "customer" }
> {
  const session = await getSession();
  try {
    requireCustomerSession(session);
  } catch {
    redirect("/login");
  }
  return session;
}

/** Employee Portal (PHASE 18.5) equivalent of `requireSession` — redirects
 * to `/employee/login` instead of throwing when not a wearer session. */
export async function requireWearerAppSession(): Promise<
  AppSession & { accountType: "corporate_wearer"; wearerId: string }
> {
  const session = await getSession();
  try {
    requireWearerSession(session);
  } catch {
    redirect("/employee/login");
  }
  return session;
}
