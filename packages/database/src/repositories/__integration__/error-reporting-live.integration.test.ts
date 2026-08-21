/**
 * Live integration proof for production error observability (ship-readiness
 * Blocker 2): a controlled test error must reach error_events, and any
 * value that looks like a secret must be stripped before it lands there.
 *
 * Run with:
 *   PAON_INTEGRATION=1 pnpm --filter @paon/database exec vitest run \
 *     src/repositories/__integration__/error-reporting-live.integration.test.ts
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PaonSupabaseClient } from "../../client-type";
import { createSupabaseAdminClient } from "../../clients/admin";
import { reportError } from "../../error-reporting";

const LIVE = process.env["PAON_INTEGRATION"] === "1";
const RUN = Date.now();
const TEST_MESSAGE = `ship-readiness controlled test error ${RUN}`;

let admin: PaonSupabaseClient;

beforeAll(() => {
  if (!LIVE) return;
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Live integration refused: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
});

afterAll(async () => {
  if (!LIVE) return;
  await admin.from("error_events").delete().eq("message", TEST_MESSAGE);
});

describe.skipIf(!LIVE)("error-reporting (live)", () => {
  it("persists a reported error and strips secret-shaped context keys", async () => {
    await reportError({
      app: "admin",
      environment: "test",
      route: "/ship-readiness/controlled-test",
      message: TEST_MESSAGE,
      stack: "Error: controlled test\n    at test",
      context: {
        // Safe values — must survive.
        userFacingCode: "controlled_test",
        retryCount: 1,
        // Secret-shaped keys — must be stripped, never stored.
        password: "should-not-be-stored",
        sessionToken: "should-not-be-stored",
        apiKey: "should-not-be-stored",
      },
    });

    const { data, error } = await admin
      .from("error_events")
      .select("*")
      .eq("message", TEST_MESSAGE)
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data?.app).toBe("admin");
    expect(data?.route).toBe("/ship-readiness/controlled-test");

    const context = data?.context as Record<string, unknown>;
    expect(context["userFacingCode"]).toBe("controlled_test");
    expect(context["retryCount"]).toBe(1);
    expect(context).not.toHaveProperty("password");
    expect(context).not.toHaveProperty("sessionToken");
    expect(context).not.toHaveProperty("apiKey");

    const rawText = JSON.stringify(data);
    expect(rawText).not.toContain("should-not-be-stored");
  });

  it("never throws even when Supabase credentials are missing", async () => {
    const originalUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
    delete process.env["NEXT_PUBLIC_SUPABASE_URL"];
    delete process.env["SUPABASE_URL"];
    try {
      await expect(
        reportError({
          app: "admin",
          environment: "test",
          message: "should be dropped, not thrown",
        }),
      ).resolves.toBeUndefined();
    } finally {
      if (originalUrl) process.env["NEXT_PUBLIC_SUPABASE_URL"] = originalUrl;
    }
  });
});
