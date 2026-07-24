/**
 * Bans every @nebelspiegel.com demo auth user created by seed-demo.ts
 * (ban_duration, not delete — fully reversible via
 * reactivate-demo-logins.ts). Run after sharing the role/link roster
 * so nobody can actually sign in with the passwords in that message.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   pnpm --filter @paon/database deactivate:demo
 */
import { createSupabaseAdminClient } from "../src";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new Error(`Missing required environment variable "${name}".`);
  return value;
}

const admin = createSupabaseAdminClient(
  requireEnv("SUPABASE_URL"),
  requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
);

async function main() {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;

  const demoUsers = data.users.filter((u) =>
    u.email?.endsWith("@nebelspiegel.com"),
  );
  for (const user of demoUsers) {
    await admin.auth.admin.updateUserById(user.id, { ban_duration: "876000h" });
    console.log(`Deactivated ${user.email}`);
  }
  console.log(`\n${demoUsers.length} demo logins deactivated.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
