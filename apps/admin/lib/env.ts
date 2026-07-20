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
  get supabaseServiceRoleKey() {
    return requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  },
  /** Retailer Portal's base URL — an invited owner's confirm link must land there, not on this app. */
  get retailerAppUrl() {
    return requireEnv("NEXT_PUBLIC_RETAILER_APP_URL");
  },
  get adminAppUrl() {
    return requireEnv("NEXT_PUBLIC_ADMIN_APP_URL");
  },
  /** PAON's own platform Stripe secret key — absent until a platform operator provisions one, see docs/PROJECT_STATE.md "Credentials needed". */
  get stripeSecretKey() {
    return optionalEnv("STRIPE_SECRET_KEY");
  },
  /** Signing secret for platform billing webhook events (retailer subscriptions) — distinct from apps/customer's Connect webhook secret. */
  get stripeBillingWebhookSecret() {
    return optionalEnv("STRIPE_BILLING_WEBHOOK_SECRET");
  },
  /** Resend API key — absent until a platform operator provisions one, see docs/PROJECT_STATE.md "Credentials needed". */
  get resendApiKey() {
    return optionalEnv("RESEND_API_KEY");
  },
  /** The verified "from" address a Resend account is allowed to send as — configured alongside the API key, not a secret itself but has no safe hardcoded default. */
  get resendFromEmail() {
    return optionalEnv("RESEND_FROM_EMAIL");
  },
  /** Shared secret Vercel Cron sends as `Authorization: Bearer <value>` — see /api/cron/dispatch-emails. */
  get cronSecret() {
    return optionalEnv("CRON_SECRET");
  },
};
