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

export const env = {
  get supabaseUrl() {
    return requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey() {
    return requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  /** Only for the Stripe webhook Route Handler, which has no user session to run an RLS-scoped client under. */
  get supabaseServiceRoleKey() {
    return requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  },
  /** This app's own base URL — used to build the magic-link redirectTo (see /auth/confirm) and Stripe Checkout success/cancel URLs. */
  get appUrl() {
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
};
