/**
 * CLI entrypoint for the shared demo seed (`../src/demo-seed.ts`,
 * also used by PAON Admin's in-app "Demo mode" toggle). Idempotent:
 * safe to re-run.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   pnpm --filter @paon/database seed:demo
 */
import { seedDemoData } from "../src/demo-seed";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new Error(`Missing required environment variable "${name}".`);
  return value;
}

async function main() {
  const logins = await seedDemoData({
    supabaseUrl: requireEnv("SUPABASE_URL"),
    anonKey: requireEnv("SUPABASE_ANON_KEY"),
    serviceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  });

  console.log("\n=== Demo logins (all use the same password) ===");
  console.log("Password: Demo-PAON-2026!\n");
  for (const l of logins) {
    console.log(`${l.role.padEnd(45)} ${l.email}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
