import { defineConfig, devices } from "@playwright/test";

const e2ePort = Number(process.env["PAON_E2E_PORT"] ?? "3102");
const e2eBaseUrl = `http://localhost:${e2ePort}`;
const e2eDistDir = process.env["PAON_NEXT_DIST_DIR"] ?? `.next-e2e-${e2ePort}`;
const e2eRuntimeEnvironment = `VERCEL_ENV=development PAON_NEXT_DIST_DIR=${e2eDistDir}`;

const WEBSERVER_TIMEOUT_MS_DEFAULT = 180_000;
const WEBSERVER_TIMEOUT_MS_MIN = 180_000;
const WEBSERVER_TIMEOUT_MS_MAX = 600_000;

function resolveWebServerTimeoutMs(): number {
  const raw = process.env["PAON_E2E_WEBSERVER_TIMEOUT_MS"];
  if (raw === undefined) return WEBSERVER_TIMEOUT_MS_DEFAULT;

  const parsed = Number(raw);
  if (
    !Number.isFinite(parsed) ||
    !Number.isInteger(parsed) ||
    parsed < WEBSERVER_TIMEOUT_MS_MIN ||
    parsed > WEBSERVER_TIMEOUT_MS_MAX
  ) {
    throw new Error(
      `PAON_E2E_WEBSERVER_TIMEOUT_MS must be a finite integer between ${WEBSERVER_TIMEOUT_MS_MIN} and ${WEBSERVER_TIMEOUT_MS_MAX} (got ${JSON.stringify(raw)}).`,
    );
  }
  return parsed;
}

const webServerTimeoutMs = resolveWebServerTimeoutMs();

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
  snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}{ext}",
  // These journeys run against the live cloud Postgres, several regions away.
  // A single step is many sequential round trips, so the defaults (30s test,
  // 5s expect) are a latency budget rather than a correctness signal — they
  // fail honest code and hide real breakage in a wall of timeouts. Raised
  // once here, matching apps/retailer.
  timeout: 120_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: e2eBaseUrl,
    trace: "on-first-retry",
    actionTimeout: 30_000,
    navigationTimeout: 45_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `${e2eRuntimeEnvironment} pnpm build && ${e2eRuntimeEnvironment} pnpm exec next start -p ${e2ePort}`,
    url: e2eBaseUrl,
    timeout: webServerTimeoutMs,
    reuseExistingServer: false,
  },
});
