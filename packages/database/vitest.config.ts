import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./src/test-environment-guard.ts"],
    include: ["src/**/*.test.ts"],
    /**
     * The integration suites talk to the live cloud Postgres, and a single
     * case there is many sequential round trips (load, check, transition,
     * ledger writes). The 5s default is a latency budget, not a correctness
     * signal, so it is raised once here rather than per test — a per-case
     * timeout is how a real failure ends up looking like a slow network.
     */
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
