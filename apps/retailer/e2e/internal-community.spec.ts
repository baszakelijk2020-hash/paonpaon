import { createSupabaseAdminClient } from "@paon/database";
import { DEMO_PASSWORD } from "@paon/database/demo-seed";
import { ensureProgrammeProofSeed } from "@paon/database/programme-proof-seed";
import { PROGRAMME_PROOF_PERSONAS } from "@paon/domain";
import { expect, test, type Page } from "@playwright/test";

import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "11.4";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/internal-community.spec.ts";

let proofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: proofPassed ? "passed" : "failed",
  });
});

async function signIn(page: Page, email: string): Promise<void> {
  // The middleware redirects an already-authenticated session straight from
  // /login to /dashboard (see middleware.ts), so switching personas
  // mid-test requires dropping the existing session cookie first — without
  // it the login form never renders and getByLabel("Email") times out.
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

/**
 * PHASE 11.4 / WFM-107 browser proof: learning contributions (moderated,
 * versioned), service-recovery budget requests (requester/approver split,
 * no money moved), and the read-only support-resource catalogue.
 *
 * The advisor and the manager are two real, distinct signed-in identities
 * from the programme-proof house so the self-moderation / self-approval
 * guards are exercised as they actually are in production — one person
 * submits, a different one decides.
 */
test("an advisor submits a contribution and requests a budget; a manager moderates and decides", async ({
  page,
}) => {
  test.setTimeout(300_000);

  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const proof = await ensureProgrammeProofSeed({
    supabaseUrl,
    anonKey,
    serviceRoleKey,
  });
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  const stamp = Date.now();
  const title = `Fitting-room reset routine ${stamp}`;

  // ---- Learning: a body under the floor is refused by the running app ---
  await signIn(page, PROGRAMME_PROOF_PERSONAS.advisor.email);
  await page.goto("/staff/learning");
  await expect(page.locator("#title")).toBeVisible({ timeout: 30_000 });
  await page.fill("#title", title);
  await page.fill("#body", "Too short to teach anyone anything.");
  await page.getByRole("button", { name: "Submit for review" }).click();
  expect(
    await page
      .locator("#body")
      .evaluate((el: HTMLTextAreaElement) => el.validity.tooShort),
  ).toBe(true);

  // ---- A real contribution submits and lands in the moderation queue ----
  const body = `Reset every fitting room between clients: mirror, bench, hooks. It takes ninety seconds and the next client always notices. ${stamp}`;
  await page.goto("/staff/learning");
  await page.fill("#title", title);
  await page.fill("#body", body);
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText("Submitted for review.")).toBeVisible({
    timeout: 15_000,
  });

  const submitted = await (async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const { data } = await admin
        .from("staff_learning_contributions")
        .select("id, state")
        .eq("retailer_id", proof.retailerId)
        .eq("title", title)
        .maybeSingle();
      if (data) return data;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    return null;
  })();
  expect(submitted, "the contribution was never submitted").not.toBeNull();
  expect(submitted!.state).toBe("submitted");

  // ---- The advisor cannot see a moderation queue: only managers can -----
  // ("Awaiting review" alone would also match this contribution's own state
  // badge in "Your contributions" below — the queue card's heading is the
  // thing that must not exist for a non-manager.)
  await expect(page.getByText(/Awaiting review \(/)).toHaveCount(0);

  // ---- A manager — a different person — moderates it -------------------
  await signIn(page, PROGRAMME_PROOF_PERSONAS.manager.email);
  await page.goto("/staff/learning");
  const queueItem = page.locator("li", { hasText: title });
  await expect(queueItem).toBeVisible({ timeout: 30_000 });

  // Rejecting with no note is refused — an anonymous veto teaches nothing.
  await queueItem.getByRole("button", { name: "Reject" }).click();
  await expect(
    queueItem.getByText(/Say why, so the author knows/i),
  ).toBeVisible({ timeout: 15_000 });

  // Approving succeeds and publishes it. Not asserting the form's inline
  // notice here: approval revalidates the page, and this row's own
  // moderation form (mounted only while state === "submitted") can unmount
  // before the notice paints — the DB poll below is the reliable check,
  // same reasoning as the reviewed-list poll in staff-recognition.spec.ts.
  await queueItem.getByRole("button", { name: "Approve" }).click();

  await expect
    .poll(
      async () => {
        const { data } = await admin
          .from("staff_learning_contributions")
          .select("state")
          .eq("id", submitted!.id)
          .single();
        return data?.state;
      },
      { timeout: 30_000 },
    )
    .toBe("approved");

  // Now visible in the "Published" section for anyone, including the
  // advisor who wrote it.
  await signIn(page, PROGRAMME_PROOF_PERSONAS.advisor.email);
  await page.goto("/staff/learning");
  await expect(page.locator("#learning-approved").getByText(title)).toBeVisible(
    { timeout: 30_000 },
  );

  // ---- Service recovery: no client and no order is refused --------------
  const reason = `Reprinted a soaked invoice for a client after a storm ${stamp}`;
  await page.goto("/staff/service-recovery");
  await expect(page.locator("#amount")).toBeVisible({ timeout: 30_000 });
  await page.fill("#amount", "45");
  await page.fill("#reason", reason);
  await page.getByRole("button", { name: "Request budget" }).click();
  await expect(
    page.getByText(/Attach this to a client or an order/i),
  ).toBeVisible({ timeout: 15_000 });

  // ---- Attached to the real proof customer, it submits -------------------
  await page.goto("/staff/service-recovery");
  await page.fill("#amount", "45");
  await page.fill("#reason", reason);
  await page
    .locator("#customerId")
    .selectOption({ label: PROGRAMME_PROOF_PERSONAS.customer.displayName });
  await page.getByRole("button", { name: "Request budget" }).click();
  await expect(
    page.getByText("Requested. A manager will review it."),
  ).toBeVisible({ timeout: 15_000 });

  const requestRow = page.locator("li", { hasText: reason });
  await expect(requestRow).toBeVisible({ timeout: 15_000 });
  await expect(requestRow.getByText("Requested")).toBeVisible();
  // No decision control for the requester themselves.
  await expect(requestRow.getByRole("button", { name: "Approve" })).toHaveCount(
    0,
  );

  // ---- A manager — again, a different person — approves it --------------
  await signIn(page, PROGRAMME_PROOF_PERSONAS.manager.email);
  await page.goto("/staff/service-recovery");
  const managerRow = page.locator("li", { hasText: reason });
  await expect(managerRow).toBeVisible({ timeout: 30_000 });
  await managerRow.getByRole("button", { name: "Approve" }).click();
  // Same reasoning as above: the decision form unmounts once the request
  // leaves the "requested" state, so the persistent status badge — not the
  // form's own ephemeral notice — is the reliable post-decision check.
  await expect(managerRow.getByText("Approved", { exact: true })).toBeVisible({
    timeout: 15_000,
  });

  // No payment provider or payout reference anywhere on the page — this
  // is an authorisation record, not a payment.
  const recoveryPageText = (
    await page.locator("body").innerText()
  ).toLowerCase();
  expect(recoveryPageText).not.toContain("stripe");
  expect(recoveryPageText).not.toContain("payout");

  // ---- Support resources: a read-only, seeded catalogue ------------------
  await page.goto("/staff/support");
  await expect(page.getByText("Employee assistance line")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("link", { name: "Visit" }).first()).toBeVisible();

  proofPassed = true;
});
