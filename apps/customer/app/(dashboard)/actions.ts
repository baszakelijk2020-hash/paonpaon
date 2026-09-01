"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getSupabaseServerClient } from "@/lib/supabase-server";

export type SignOutState = { error: string } | null;

/**
 * Global sign-out: `supabase.auth.signOut()` with no `scope` uses the
 * default `scope: "global"`, which revokes every refresh token for this
 * user across all devices/sessions, not just this one (founder decision
 * 2026-09-01). A failed signOut must not redirect to /login as if the
 * session were cleared — that would claim success while cookies remain
 * live — so an error is returned to the caller instead, and only a
 * verified-clean signOut revalidates and redirects.
 */
export async function signOut(
  _prevState: SignOutState,
  _formData: FormData,
): Promise<SignOutState> {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/login");
}
