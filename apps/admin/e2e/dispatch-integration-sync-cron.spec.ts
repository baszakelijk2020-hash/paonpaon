import { expect, test } from "@playwright/test";

/**
 * PHASE 9.2 scheduled sync execution: dispatch-integration-sync cron route
 * authenticates via CRON_SECRET, only processes active Shopify connections,
 * and tolerates per-connection failures without stopping the batch.
 */
test.describe("dispatch-integration-sync cron route", () => {
  test("rejects a request with no bearer token", async ({ request }) => {
    const cronSecret = process.env["CRON_SECRET"];
    test.skip(!cronSecret, "CRON_SECRET is not set for this run.");

    const response = await request.post("/api/cron/dispatch-integration-sync");
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  test("rejects a request with the wrong bearer token", async ({ request }) => {
    const cronSecret = process.env["CRON_SECRET"];
    test.skip(!cronSecret, "CRON_SECRET is not set for this run.");

    const response = await request.post("/api/cron/dispatch-integration-sync", {
      headers: { authorization: "Bearer definitely-the-wrong-secret" },
    });
    expect(response.status()).toBe(401);
  });

  test("an authorized request processes active Shopify connections and reports counts", async ({
    request,
  }) => {
    const cronSecret = process.env["CRON_SECRET"];
    test.skip(!cronSecret, "CRON_SECRET is not set for this run.");

    const response = await request.post("/api/cron/dispatch-integration-sync", {
      headers: { authorization: `Bearer ${cronSecret}` },
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(typeof body.processed).toBe("number");
    expect(typeof body.succeeded).toBe("number");
    expect(typeof body.failed).toBe("number");
    expect(Array.isArray(body.errors)).toBe(true);
    expect(body.processed).toBeGreaterThanOrEqual(0);
    expect(body.succeeded + body.failed).toBe(body.processed);
  });
});
