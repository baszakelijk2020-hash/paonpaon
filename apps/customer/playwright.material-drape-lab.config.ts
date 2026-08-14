import { defineConfig, devices } from "@playwright/test";

/**
 * This deliberately has no global fixture setup: the lab is a public,
 * deterministic zero-data harness and must be provable without Supabase.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "material-drape-lab.spec.ts",
  snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}{ext}",
  use: {
    baseURL: "http://localhost:3002",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command:
      "NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=not-a-real-key pnpm dev",
    cwd: ".",
    url: "http://localhost:3002/material-drape-lab",
    reuseExistingServer: true,
  },
});
