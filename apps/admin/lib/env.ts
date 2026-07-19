function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable "${name}". See .env.example.`,
    );
  }
  return value;
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
};
