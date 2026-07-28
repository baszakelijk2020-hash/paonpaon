function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable "${name}". See .env.example.`,
    );
  }
  return value;
}

/** Unlike `requireEnv`, missing is a valid (if unconfigured) state — see `lib/stripe.ts`. */
function optionalEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}

/** See apps/customer/lib/env.ts and docs/DEPLOYMENT.md — the Vercel↔Supabase
 * integration injects its own variable names, so both spellings are accepted
 * and a deploy configured purely by that integration boots correctly. */
function firstEnv(...names: readonly string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  throw new Error(
    `Missing required environment variable. Set one of: ${names.join(", ")}. See docs/DEPLOYMENT.md.`,
  );
}

export const env = {
  get supabaseUrl() {
    return firstEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
  },
  get supabaseAnonKey() {
    return firstEnv(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  },
  get supabaseServiceRoleKey() {
    return firstEnv("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY");
  },
  /** This app's own base URL — used to build invite redirectTo links (see /auth/confirm). */
  get appUrl() {
    const explicit = optionalEnv("NEXT_PUBLIC_APP_URL");
    if (explicit && !explicit.includes("localhost")) return explicit;
    const vercelHost = optionalEnv("VERCEL_PROJECT_PRODUCTION_URL");
    if (vercelHost) return `https://${vercelHost}`;
    return requireEnv("NEXT_PUBLIC_APP_URL");
  },
  /** PAON's own platform Stripe secret key — absent until a platform operator provisions one, see docs/PROJECT_STATE.md "Credentials needed". */
  get stripeSecretKey() {
    return optionalEnv("STRIPE_SECRET_KEY");
  },
  /** OpenAI API key for AI personalisation (@paon/ai) — absent until a platform operator provisions one, see docs/PROJECT_STATE.md "Credentials needed". */
  get openaiApiKey() {
    return optionalEnv("OPENAI_API_KEY");
  },
};
