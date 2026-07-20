/**
 * Reverses deactivate-demo-logins.ts — lifts the ban on every
 * @nebelspiegel.com demo auth user so the passwords work again.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   pnpm --filter @paon/database reactivate:demo
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
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw error;

  const demoUsers = data.users.filter((u) =>
    u.email?.endsWith("@nebelspiegel.com"),
  );
  for (const user of demoUsers) {
    await admin.auth.admin.updateUserById(user.id, { ban_duration: "none" });
    console.log(`Reactivated ${user.email}`);
  }
  console.log(`\n${demoUsers.length} demo logins reactivated.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
