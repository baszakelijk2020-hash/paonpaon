import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // These journeys intentionally reuse one customer identity. Supabase magic
  // links are single-use, so parallel sign-ins for that identity invalidate
  // one another and create false failures.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  // These journeys run against the live cloud Postgres, several regions away.
  // A single step is many sequential round trips, so the defaults (30s test,
  // 5s expect) are a latency budget rather than a correctness signal — they
  // fail honest code and hide real breakage in a wall of timeouts. Raised
  // once here, matching apps/retailer.
  timeout: 120_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: "http://localhost:3002",
    trace: "on-first-retry",
    actionTimeout: 30_000,
    navigationTimeout: 45_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm start",
    url: "http://localhost:3002",
    reuseExistingServer: !process.env.CI,
  },
});
