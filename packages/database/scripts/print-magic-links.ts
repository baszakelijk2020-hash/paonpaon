/**
 * Prints a real one-click sign-in link (Supabase magic link) for every
 * @nebelspiegel.com demo account — no password needed, click and land
 * signed in. Each link is single-use and expires (Supabase default).
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   ADMIN_APP_URL=https://paon-admin.vercel.app \
 *   RETAILER_APP_URL=https://paon-retailer.vercel.app \
 *   CUSTOMER_APP_URL=https://paon-customer.vercel.app \
 *   pnpm --filter @paon/database print:magic-links
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

const ADMIN_APP_URL = requireEnv("ADMIN_APP_URL");
const RETAILER_APP_URL = requireEnv("RETAILER_APP_URL");
const CUSTOMER_APP_URL = requireEnv("CUSTOMER_APP_URL");

function appUrlFor(email: string): string {
  if (email === "contact@nebelspiegel.com") return ADMIN_APP_URL;
  if (
    email.includes("-owner@") ||
    email.includes("-manager@") ||
    email.includes("-sales@") ||
    email.includes("-workshop@")
  ) {
    return RETAILER_APP_URL;
  }
  return CUSTOMER_APP_URL;
}

async function main() {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;

  const demoUsers = data.users
    .filter((u) => u.email?.endsWith("@nebelspiegel.com"))
    .sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));

  for (const user of demoUsers) {
    const email = user.email!;
    const appUrl = appUrlFor(email);
    const { data: linkData, error: linkError } =
      await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
      });
    if (linkError || !linkData) {
      console.error(`${email}: FAILED — ${linkError?.message}`);
      continue;
    }
    // Deliberately NOT properties.action_link — that points at
    // Supabase's own /auth/v1/verify endpoint, which redirects with
    // tokens in a URL *fragment* (implicit-flow style), and our
    // server-side /auth/confirm route handlers only read the
    // token_hash *query* param (see apps/*/app/auth/confirm/route.ts).
    // Building the link straight to each app's own confirm endpoint
    // with hashed_token as token_hash matches what those handlers
    // actually expect.
    const link = `${appUrl}/auth/confirm?token_hash=${linkData.properties.hashed_token}&type=magiclink`;
    console.log(`${email}\n  ${link}\n`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
