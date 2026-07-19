/**
 * One-time bootstrap for the very first PAON Admin user. Every
 * platform staff member after this one is provisioned from inside
 * PAON Admin itself (see docs/ROADMAP.md Phase 1) — this script only
 * exists because that UI has nobody able to sign in to use it yet.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   ADMIN_APP_URL=http://localhost:3000 \
 *   BOOTSTRAP_EMAIL=you@paon.com BOOTSTRAP_FULL_NAME="Your Name" \
 *   pnpm --filter @paon/database bootstrap:platform-admin
 *
 * BOOTSTRAP_ROLE defaults to "platform_owner". Requires a running
 * Supabase instance (local `supabase start` or a remote project) with
 * migrations applied.
 */
import { invitePlatformStaffInputSchema, type UserId } from "@paon/domain";

import { createSupabaseAdminClient } from "../src/clients/admin";
import { PlatformStaffRepository } from "../src/repositories/platform-staff-repository";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable "${name}".`);
  }
  return value;
}

async function main() {
  const parsed = invitePlatformStaffInputSchema.parse({
    email: requireEnv("BOOTSTRAP_EMAIL"),
    fullName: requireEnv("BOOTSTRAP_FULL_NAME"),
    role: process.env["BOOTSTRAP_ROLE"] ?? "platform_owner",
  });

  const admin = createSupabaseAdminClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );

  const { data, error } = await admin.auth.admin.inviteUserByEmail(
    parsed.email,
    {
      data: { full_name: parsed.fullName },
      redirectTo: requireEnv("ADMIN_APP_URL") + "/auth/confirm",
    },
  );

  if (error || !data.user) {
    throw new Error(
      `Failed to invite ${parsed.email}: ${error?.message ?? "unknown error"}`,
    );
  }

  const repo = new PlatformStaffRepository(admin);
  const staff = await repo.create({
    userId: data.user.id as UserId,
    fullName: parsed.fullName,
    role: parsed.role,
  });

  console.log(
    `Invited ${staff.fullName} <${parsed.email}> as ${staff.role}. They'll receive an email to set a password and sign in to PAON Admin.`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
