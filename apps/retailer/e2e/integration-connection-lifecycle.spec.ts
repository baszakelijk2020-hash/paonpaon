import { createHmac } from "node:crypto";

import {
  IntegrationLifecycleRepository,
  SourceAuthorityRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import { FADEN_SIGNATURE_SCHEME, asId, type RetailerId } from "@paon/domain";
import { expect, test, type Page } from "@playwright/test";

import { TEST_OWNER_EMAIL, TEST_OWNER_PASSWORD } from "./fixtures";

/**
 * PHASE 9.2 slice proof: pause/resume UI actually changes the operational
 * state a live webhook checks, and a real HMAC-signed request against the
 * running app is accepted while a tampered one is refused and dead-lettered
 * — end to end against this branch's own live Supabase project, not a mock.
 */

const FADEN_WEBHOOK_SECRET_ENV = "E2E_FADEN_WEBHOOK_SECRET";

async function signInOwner(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

function signEnvelope(args: {
  readonly providerEventId: string;
  readonly timestamp: string;
  readonly rawBody: string;
  readonly sharedSecret: string;
}): string {
  const payload = [
    FADEN_SIGNATURE_SCHEME,
    args.providerEventId,
    args.timestamp,
    args.rawBody,
  ].join("\n");
  const hex = createHmac("sha256", args.sharedSecret)
    .update(payload)
    .digest("hex");
  return `${FADEN_SIGNATURE_SCHEME}=${hex}`;
}

test("pause blocks a live webhook; resume plus a real signature admits it; a tampered body is refused", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(120_000);
  // Deliberately not set here: playwright.config.ts's webServer is a
  // separate `pnpm start` process this test runner does not share memory
  // with, so process.env writes at this point would never reach it. The
  // env var must already exist in the shell that launched `playwright test`
  // — see the E2E_FADEN_WEBHOOK_SECRET export this spec's run instructions
  // require.
  const sharedSecret = process.env[FADEN_WEBHOOK_SECRET_ENV];
  if (!sharedSecret) {
    throw new Error(
      `${FADEN_WEBHOOK_SECRET_ENV} must be exported before starting the webServer — set it in the shell, not in this test.`,
    );
  }

  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const sourceAuthority = new SourceAuthorityRepository(admin);
  const lifecycle = new IntegrationLifecycleRepository(admin);

  await signInOwner(page);
  await page.goto("/settings/integrations");

  // Provisions this test's own connection directly against the live
  // database rather than depending on global-setup already having one.
  const { data: staffRow, error: staffError } = await admin
    .from("retailer_staff_members")
    .select("retailer_id")
    .eq("email", TEST_OWNER_EMAIL)
    .single();
  if (staffError) throw staffError;
  const retailerId: RetailerId = asId<"RetailerId">(staffRow.retailer_id);

  const connection = await sourceAuthority.createConnection({
    retailerId,
    provider: "faden",
    displayName: `E2E Faden ${Date.now()}`,
  });

  await lifecycle.upsertConnectionSecretRef({
    retailerId,
    connectionId: connection.id,
    kind: "webhook_shared_secret",
    secretRef: FADEN_WEBHOOK_SECRET_ENV,
  });

  await admin.from("source_authority_policies").insert({
    retailer_id: retailerId,
    connection_id: connection.id,
    domain: "order",
    field_group: "order.status",
    authority: "external",
    allowed_directions: ["ingest"],
    mapping_version: "faden-webhook-adapter-v1",
  });

  await page.reload();
  await expect(page.getByText(connection.displayName)).toBeVisible();

  // 1. Pause it via the real UI, then confirm a live webhook is refused.
  const connectionRow = page
    .locator("li")
    .filter({ hasText: connection.displayName });
  await connectionRow.getByRole("button", { name: "Pause" }).click();
  await expect(connectionRow.getByText(/paused/i)).toBeVisible({
    timeout: 15_000,
  });
  // Verifies from the exact same vantage point the orchestrator itself
  // reads from (the admin/service-role client), independent of whatever
  // the browser is currently rendering, to rule out a UI/DB read
  // inconsistency before trusting the webhook response's status code.
  await expect
    .poll(
      async () =>
        lifecycle.getOperationalState({
          retailerId,
          connectionId: connection.id,
        }),
      { timeout: 15_000 },
    )
    .toBe("paused");

  const providerEventId = `e2e-faden-${Date.now()}`;
  const timestamp = new Date().toISOString();
  const rawBody = JSON.stringify({
    id: "FAD-ORD-E2E-1",
    type: "order.updated",
  });
  const signature = signEnvelope({
    providerEventId,
    timestamp,
    rawBody,
    sharedSecret,
  });

  const pausedResponse = await page.request.post(
    `${baseURL}/api/webhooks/faden/${connection.id}`,
    {
      headers: {
        "content-type": "application/json",
        "x-faden-event-id": providerEventId,
        "x-faden-timestamp": timestamp,
        "x-faden-signature": signature,
      },
      data: rawBody,
    },
  );
  expect(pausedResponse.status()).toBe(409);

  // 2. Resume, and the same signed request is accepted (though the order is
  // still unmapped, so it 422s as unmapped_external_object — a MEANINGFUL
  // rejection distinct from "paused", proving the connection check and the
  // mapping check are genuinely independent code paths).
  await connectionRow.getByRole("button", { name: "Resume" }).click();
  // healthStatus defaults to "disconnected" (createConnection never claims
  // live health) — this specifically checks the operationalState half of
  // the rendered "<health> · <operational>" text, not healthStatus.
  await expect(connectionRow.getByText("· active")).toBeVisible({
    timeout: 15_000,
  });

  const unmappedResponse = await page.request.post(
    `${baseURL}/api/webhooks/faden/${connection.id}`,
    {
      headers: {
        "content-type": "application/json",
        "x-faden-event-id": providerEventId,
        "x-faden-timestamp": timestamp,
        "x-faden-signature": signature,
      },
      data: rawBody,
    },
  );
  expect(unmappedResponse.status()).toBe(422);

  // 3. A tampered body (same length, different byte) is refused as a
  // signature mismatch — the exact forgery the deprecated fixture verifier
  // would have accepted.
  const tamperedBody = rawBody.replace("FAD-ORD-E2E-1", "FAD-ORD-E2E-9");
  expect(tamperedBody).toHaveLength(rawBody.length);
  const tamperedResponse = await page.request.post(
    `${baseURL}/api/webhooks/faden/${connection.id}`,
    {
      headers: {
        "content-type": "application/json",
        "x-faden-event-id": `${providerEventId}-tampered`,
        "x-faden-timestamp": timestamp,
        "x-faden-signature": signature, // still signs the ORIGINAL body
      },
      data: tamperedBody,
    },
  );
  expect(tamperedResponse.status()).toBe(401);

  // 4. Both rejections are visible as dead letters on the settings page,
  // not silently dropped. The page renders failureReason (mapping_error /
  // signature_invalid) — the more specific "unmapped_external_object" detail
  // lives in failure_detail, which the UI does not surface as text yet.
  await page.reload();
  await expect(
    page.getByText(/mapping_error|signature_invalid/i).first(),
  ).toBeVisible({ timeout: 15_000 });

  const deadLetters = await lifecycle.listUnresolvedDeadLetters({
    retailerId,
    connectionId: connection.id,
  });
  expect(deadLetters.length).toBeGreaterThanOrEqual(2);
});
