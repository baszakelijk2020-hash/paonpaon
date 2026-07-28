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

/**
 * First non-empty of several names. The Vercel↔Supabase marketplace
 * integration injects its own variable names, which do not match the ones
 * this app was written against, so a deploy configured entirely by that
 * integration would otherwise fail at boot. Accepting both spellings means
 * a fresh deploy needs no hand-copied values — see docs/DEPLOYMENT.md.
 */
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
    // `PUBLISHABLE_KEY` is Supabase's newer name for the same client-safe
    // key, and is what the Vercel integration injects.
    return firstEnv(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  },
  /** Only for the Stripe webhook Route Handler, which has no user session to run an RLS-scoped client under. */
  get supabaseServiceRoleKey() {
    return firstEnv("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY");
  },
  /**
   * This app's own base URL — magic-link redirectTo (`/auth/confirm`) and
   * Stripe Checkout success/cancel URLs. Falls back to Vercel's own
   * `VERCEL_PROJECT_PRODUCTION_URL` so a deploy is never left pointing at
   * whatever `localhost` value a developer's `.env.local` happened to hold.
   */
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
  /** Signing secret for Connect webhook events — absent until the webhook endpoint is registered in the Stripe dashboard. */
  get stripeConnectWebhookSecret() {
    return optionalEnv("STRIPE_CONNECT_WEBHOOK_SECRET");
  },
  /** Same key the Retailer Portal reads (ADR-033/ADR-035) — absent until a platform operator provisions one, see docs/PROJECT_STATE.md "Credentials needed". */
  get openaiApiKey() {
    return optionalEnv("OPENAI_API_KEY");
  },
  /** Powers Today's Pick's weather line (ADR-035 MorningRoutine). */
  get openWeatherApiKey() {
    return optionalEnv("OPENWEATHER_API_KEY");
  },
  /** Retailer Portal base URL — private demo Mission Control CTA. */
  get retailerAppUrl() {
    return optionalEnv("NEXT_PUBLIC_RETAILER_APP_URL");
  },
};
