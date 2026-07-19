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
  /** This app's own base URL — used to build the magic-link redirectTo (see /auth/confirm). */
  get appUrl() {
    return requireEnv("NEXT_PUBLIC_APP_URL");
  },
};
