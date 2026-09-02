import { defineConfig, devices } from "@playwright/test";

// The Faden lifecycle proof signs its own fixture webhook. Keep the value
// local to Playwright: it is not a provider credential and production still
// requires an explicitly managed secret reference.
process.env["E2E_FADEN_WEBHOOK_SECRET"] ??=
  "paon-local-e2e-faden-webhook-secret";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  // The sandbox database is in another region, so a click that triggers a
  // Server Action round-trip regularly exceeds Playwright's 5s default
  // expect timeout and 30s default test timeout. These are WAIT budgets,
  // not weakened assertions: every condition asserted is unchanged. Set
  // once here rather than sprinkled per spec.
  timeout: 120_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
    actionTimeout: 30_000,
    navigationTimeout: 45_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm start",
    // `next start` sets NODE_ENV=production even for this disposable local
    // acceptance server. Make its deployment tier explicit so the real
    // production demo-password guard remains enabled only in production.
    env: { ...process.env, VERCEL_ENV: "development" },
    url: "http://localhost:3001",
    reuseExistingServer: !process.env.CI,
  },
});
