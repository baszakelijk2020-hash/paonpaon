import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const retailerDir = configDir;
const customerDir = path.resolve(configDir, "../customer");
const CUSTOMER_APP_ORIGIN = "http://localhost:3002";
const RETAILER_APP_ORIGIN = "http://127.0.0.1:3011";

export default defineConfig({
  testDir: "./e2e",
  testMatch: /prospect-ai-conversation\.spec\.ts$/,
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: CUSTOMER_APP_ORIGIN,
    trace: "on-first-retry",
    actionTimeout: 30_000,
    navigationTimeout: 45_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      name: "customer-production",
      cwd: customerDir,
      command: "pnpm exec next start -p 3002 -H 127.0.0.1",
      url: CUSTOMER_APP_ORIGIN,
      reuseExistingServer: false,
    },
    {
      name: "retailer-production",
      cwd: retailerDir,
      command: "pnpm exec next start -p 3011 -H 127.0.0.1",
      url: RETAILER_APP_ORIGIN,
      reuseExistingServer: false,
    },
  ],
});
