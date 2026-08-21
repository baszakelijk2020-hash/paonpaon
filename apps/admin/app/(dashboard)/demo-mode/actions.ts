"use server";

import { createSupabaseAdminClient } from "@paon/database";
import { seedDemoData } from "@paon/database/demo-seed";
import { revalidatePath } from "next/cache";

import { env } from "@/lib/env";
import { requireSession } from "@/lib/session";

export interface DemoModeState {
  result?: { count: number };
  formError?: string;
}

/** platform_owner only — this populates real data on the live
 * project, not a sandboxed preview. Reuses the exact seed logic the
 * CLI script (`packages/database/scripts/seed-demo.ts`) already runs
 * — one implementation, two entry points. */
export async function runDemoSeed(
  _prevState: DemoModeState,
): Promise<DemoModeState> {
  const session = await requireSession();
  if (session.platformRole !== "platform_owner") {
    return { formError: "Only a platform owner can populate demo data." };
  }

  try {
    const logins = await seedDemoData({
      supabaseUrl: env.supabaseUrl,
      anonKey: env.supabaseAnonKey,
      serviceRoleKey: env.supabaseServiceRoleKey,
    });
    revalidatePath("/demo-mode");
    return { result: { count: logins.length } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { formError: message };
  }
}

export interface DemoLoginsActionState {
  formError?: string;
  saved?: boolean;
}

/** Reversible ban/unban of every @nebelspiegel.com demo auth user —
 * same shape as the standalone deactivate/reactivate-demo-logins
 * scripts, now reachable without a terminal. */
export async function setDemoLoginsActive(
  _previous: DemoLoginsActionState,
  formData: FormData,
): Promise<DemoLoginsActionState> {
  const session = await requireSession();
  if (session.platformRole !== "platform_owner") {
    return {
      formError: "Only a platform owner can toggle demo logins.",
    };
  }

  const active = formData.get("active") === "true";

  try {
    const admin = createSupabaseAdminClient(
      env.supabaseUrl,
      env.supabaseServiceRoleKey,
    );
    const { data, error } = await admin.auth.admin.listUsers({
      perPage: 1000,
    });
    if (error) throw error;
    const demoUsers = data.users.filter((u) =>
      u.email?.endsWith("@nebelspiegel.com"),
    );
    for (const user of demoUsers) {
      await admin.auth.admin.updateUserById(user.id, {
        ban_duration: active ? "none" : "876000h",
      });
    }
  } catch (error) {
    return {
      formError:
        error instanceof Error
          ? error.message
          : "Could not toggle demo logins.",
    };
  }

  revalidatePath("/demo-mode");
  return { saved: true };
}
