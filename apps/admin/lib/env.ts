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
  /** Retailer Portal's base URL — an invited owner's confirm link must land there, not on this app. */
  get retailerAppUrl() {
    return requireEnv("NEXT_PUBLIC_RETAILER_APP_URL");
  },
  get adminAppUrl() {
    return requireEnv("NEXT_PUBLIC_ADMIN_APP_URL");
  },
  /** Customer Portal's base URL — the daily newsletter digest links back here, not to this app. */
  get customerAppUrl() {
    return optionalEnv("NEXT_PUBLIC_CUSTOMER_APP_URL");
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
  /** Twilio covers both SMS and WhatsApp through one account — absent until a platform operator provisions one, see docs/PROJECT_STATE.md "Credentials needed". */
  get twilioAccountSid() {
    return optionalEnv("TWILIO_ACCOUNT_SID");
  },
  get twilioAuthToken() {
    return optionalEnv("TWILIO_AUTH_TOKEN");
  },
  /** The Twilio-provisioned sending number for plain SMS. */
  get twilioSmsFrom() {
    return optionalEnv("TWILIO_SMS_FROM");
  },
  /** The Twilio-approved WhatsApp sender (no `whatsapp:` prefix — `@paon/sms` adds it). */
  get twilioWhatsappFrom() {
    return optionalEnv("TWILIO_WHATSAPP_FROM");
  },
  get openWeatherApiKey() {
    return optionalEnv("OPENWEATHER_API_KEY");
  },
};
