import "server-only";

import {
  requirePlatformSession,
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
  AppSession & { platformRole: NonNullable<AppSession["platformRole"]> }
> {
  const session = await getSession();
  try {
    requirePlatformSession(session);
  } catch {
    redirect("/login");
  }
  return session;
}
