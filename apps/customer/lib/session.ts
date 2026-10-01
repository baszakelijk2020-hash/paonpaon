import "server-only";

import {
  requireCustomerSession,
  requireCorporateManagerSession,
  requireWearerSession,
  resolveAppSession,
  type AppSession,
} from "@paon/auth";
import type { UserId } from "@paon/domain";
import { redirect } from "next/navigation";
import { cache } from "react";

import { getSupabaseServerClient } from "./supabase-server";

/**
 * Deduplicated per request.
 *
 * Every dashboard route resolved its own session even though `(dashboard)/layout.tsx`
 * had already resolved one for the same request — and `/dashboard` did it three times,
 * because `RoutineSections` resolves independently again. Each of those is a real
 * `supabase.auth.getUser()` round trip, paid on every tab switch.
 *
 * React's `cache()` collapses all callers within one request into a single call, so the
 * layout, the page and any nested server component now share one result. Nothing about
 * the call sites has to change.
 */
export const getSession = cache(
  async function getSession(): Promise<AppSession | null> {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return null;
    }

    return resolveAppSession(data.user);
  },
);

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

/**
 * Stands in for the customer when a visitor opens the Wardrobe without an
 * account. The nil UUID never belongs to an auth user, so every RLS-scoped
 * read made under it returns nothing: the guest sees the environment with
 * empty personal data and no orders, never anyone else's rows.
 */
export const GUEST_USER_ID = "00000000-0000-0000-0000-000000000000" as UserId;

/** The demo persona the guest Wardrobe greets. */
export const GUEST_FIRST_NAME = "Marc";

export type ViewerSession = AppSession & {
  accountType: "customer";
  isGuest: boolean;
};

/**
 * Read-only page guard for the guest-browsable Wardrobe tabs: the signed-in
 * customer, or the guest stand-in instead of a redirect to /login. Server
 * Actions keep `requireSession`, so anything that writes still needs an
 * account.
 */
export const getViewerSession = cache(
  async function getViewerSession(): Promise<ViewerSession> {
    const session = await getSession();
    if (session?.accountType === "customer") {
      return { ...session, accountType: "customer", isGuest: false };
    }
    return {
      userId: GUEST_USER_ID,
      email: "",
      accountType: "customer",
      isGuest: true,
    };
  },
);

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

/** Manager Portal (PHASE 14.1) equivalent of `requireSession` — redirects
 * to `/manager/login` instead of throwing when not a corporate manager session. */
export async function requireCorporateManagerAppSession(): Promise<
  AppSession & { accountType: "corporate_manager"; managerId: string }
> {
  const session = await getSession();
  try {
    requireCorporateManagerSession(session);
  } catch {
    redirect("/manager/login");
  }
  return session;
}
