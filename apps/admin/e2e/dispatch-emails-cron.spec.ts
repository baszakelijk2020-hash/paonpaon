import { expect, test } from "@playwright/test";

/**
 * The dispatch-emails Route Handler has never had any test coverage —
 * neither browser (it's an API route, not a page) nor unit (it's the
 * thin HTTP layer over orchestrateMorningRoutineDeliveries/
 * orchestrateCampaignDeliveries, which now have their own unit coverage
 * in packages/database). This proves the one thing only an HTTP-level
 * test can: the shared-secret auth gate (docs/DECISIONS.md ADR-032)
 * actually rejects requests without the right bearer token, and that an
 * authorized request reaches and coherently combines all four pieces of
 * work the route does on one tick (demo-environment expiry, MorningRoutine
 * delivery, campaign delivery, email drain).
 *
 * Requires CRON_SECRET to be set locally (apps/admin/.env.local) — without
 * it the route fails closed with 503 rather than skipping auth, which is
 * the correct behavior but not what this test is proving.
 */
test.describe("dispatch-emails cron route", () => {
  test("rejects a request with no bearer token", async ({ request }) => {
    const cronSecret = process.env["CRON_SECRET"];
    test.skip(!cronSecret, "CRON_SECRET is not set for this run.");

    const response = await request.post("/api/cron/dispatch-emails");
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  test("rejects a request with the wrong bearer token", async ({ request }) => {
    const cronSecret = process.env["CRON_SECRET"];
    test.skip(!cronSecret, "CRON_SECRET is not set for this run.");

    const response = await request.post("/api/cron/dispatch-emails", {
      headers: { authorization: "Bearer definitely-the-wrong-secret" },
    });
    expect(response.status()).toBe(401);
  });

  test("an authorized request runs demo expiry, MorningRoutine delivery, and campaign delivery, and reports email drain as unconfigured", async ({
    request,
  }) => {
    const cronSecret = process.env["CRON_SECRET"];
    test.skip(!cronSecret, "CRON_SECRET is not set for this run.");

    const response = await request.post("/api/cron/dispatch-emails", {
      headers: { authorization: `Bearer ${cronSecret}` },
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(typeof body.demosExpired).toBe("number");
    expect(body.morningRoutine).toMatchObject({
      considered: expect.any(Number),
      queued: expect.any(Number),
      skipped: expect.any(Number),
      failed: expect.any(Number),
    });
    expect(body.campaigns).toMatchObject({
      considered: expect.any(Number),
      queued: expect.any(Number),
      skipped: expect.any(Number),
      failed: expect.any(Number),
    });
    // No RESEND_API_KEY is configured in this local environment — the
    // route must say so rather than silently pretending to have sent mail.
    expect(body.email).toEqual({
      skipped: true,
      reason: "Resend is not configured on this deployment.",
    });
  });
});
