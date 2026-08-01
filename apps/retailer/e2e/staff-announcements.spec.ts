import { createSupabaseAdminClient } from "@paon/database";
import { DEMO_PASSWORD } from "@paon/database/demo-seed";
import { ensureProgrammeProofSeed } from "@paon/database/programme-proof-seed";
import { PROGRAMME_PROOF_PERSONAS } from "@paon/domain";
import { expect, test, type Page } from "@playwright/test";

import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "11.4";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/staff-announcements.spec.ts";

let proofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: proofPassed ? "passed" : "failed",
  });
});

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

/**
 * Internal announcements and acknowledgement (PHASE 11.4).
 *
 * The rule worth proving: "I have read this" is a RECORD, not a checkbox.
 * `staff_announcement_acknowledgements` is append-only — no UPDATE, no
 * DELETE, for any role including service_role — so nobody can quietly
 * un-read a safety notice after the fact, and a second click cannot inflate
 * the reach figure a manager is reading.
 */
test("a manager publishes, a reader acknowledges once, and nobody can un-read it", async ({
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
  const title = `Steam press service window ${stamp}`;

  await signIn(page, PROGRAMME_PROOF_PERSONAS.manager.email);
  await page.goto("/staff/announcements");
  // The feed only exists once something has been posted, so the page is
  // identified by the publish form the manager is standing in front of.
  await expect(page.locator("#title")).toBeVisible({ timeout: 30_000 });

  // ---- a body of a few words cannot be submitted -----------------------
  // The field carries minLength, so the browser refuses before the request
  // leaves; the server holds the same line behind it (covered by the domain
  // unit tests), which is why the attribute is a courtesy and not the
  // guarantee. Asserting the server's wording here would be asserting
  // something unreachable through the UI.
  await page.fill("#title", title);
  await page.fill("#body", "Too short");
  await page.getByRole("button", { name: "Publish announcement" }).click();
  expect(
    await page
      .locator("#body")
      .evaluate((el: HTMLTextAreaElement) => el.validity.tooShort),
  ).toBe(true);

  // Nothing was published by the refusal.
  const { data: prematureRows } = await admin
    .from("staff_announcements")
    .select("id")
    .eq("retailer_id", proof.retailerId)
    .eq("title", title);
  expect(prematureRows ?? []).toHaveLength(0);

  // ---- publish something that must be acknowledged ---------------------
  await page.goto("/staff/announcements");
  await page.fill("#title", title);
  await page.fill(
    "#body",
    "The steam press is out of service until Thursday. Use the second press in the back room and do not force the handle on the broken one.",
  );
  // An audience is required. Without it the action refuses and nothing is
  // published — which is what happened when this was left out, and the
  // resulting null row made it look as though the acknowledgement flag was
  // being dropped.
  await page.selectOption("#audienceType", { index: 1 });
  const ackToggle = page.getByLabel("Requires acknowledgement");
  await ackToggle.check();
  // Confirm the control really is checked before submitting: a silently
  // untargeted checkbox and a silently dropped field look identical in the
  // database afterwards.
  await expect(ackToggle).toBeChecked();
  await page.getByRole("button", { name: "Publish announcement" }).click();

  // Polled, and the error checked: a null row from a refused publish looks
  // exactly like a dropped column if it is dereferenced with `!`.
  const published = await (async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const { data } = await admin
        .from("staff_announcements")
        .select("id, requires_acknowledgement")
        .eq("retailer_id", proof.retailerId)
        .eq("title", title)
        .maybeSingle();
      if (data) return data;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    return null;
  })();
  expect(published, "the announcement was never published").not.toBeNull();
  expect(published!.requires_acknowledgement).toBe(true);
  const announcementId = published!.id;

  // ---- the publisher sees it unread, and can record having read it -----
  const card = page.locator(`[data-announcement-id="${announcementId}"]`);
  await expect
    .poll(
      async () => {
        await page.goto("/staff/announcements");
        const found = page.locator(
          `[data-announcement-id="${announcementId}"]`,
        );
        if ((await found.count()) === 0) return "absent";
        return found.getAttribute("data-acknowledged");
      },
      { timeout: 60_000 },
    )
    .toBe("false");

  await card.getByRole("button", { name: "I have read this" }).click();

  await expect
    .poll(
      async () => {
        await page.goto("/staff/announcements");
        return page
          .locator(`[data-announcement-id="${announcementId}"]`)
          .getAttribute("data-acknowledged");
      },
      { timeout: 60_000 },
    )
    .toBe("true");

  // Exactly one record, and the reach figure agrees.
  const { data: acks } = await admin
    .from("staff_announcement_acknowledgements")
    .select("id, staff_id")
    .eq("announcement_id", announcementId);
  expect(acks).toHaveLength(1);

  await expect(
    page.locator(`[data-announcement-reach="${announcementId}"]`),
  ).toContainText("1 of", { timeout: 30_000 });

  // ---- the acknowledgement CANNOT be undone ----------------------------
  // Append-only, enforced as a grant rather than a convention: a safety
  // notice nobody can un-read is the entire point of asking.
  const ackId = acks![0]!.id;
  const deletion = await admin
    .from("staff_announcement_acknowledgements")
    .delete()
    .eq("id", ackId)
    .select("id");
  const deletedNothing =
    deletion.error !== null || (deletion.data?.length ?? 0) === 0;
  expect(deletedNothing).toBe(true);

  const update = await admin
    .from("staff_announcement_acknowledgements")
    .update({ staff_id: acks![0]!.staff_id })
    .eq("id", ackId)
    .select("id");
  const changedNothing =
    update.error !== null || (update.data?.length ?? 0) === 0;
  expect(changedNothing).toBe(true);

  // Still exactly one, still there.
  const { data: afterTamper } = await admin
    .from("staff_announcement_acknowledgements")
    .select("id")
    .eq("announcement_id", announcementId);
  expect(afterTamper).toHaveLength(1);

  // ---- a second acknowledgement cannot inflate the reach ---------------
  const duplicate = await admin
    .from("staff_announcement_acknowledgements")
    .insert({
      retailer_id: proof.retailerId,
      announcement_id: announcementId,
      staff_id: acks![0]!.staff_id,
    });
  // Either refused outright by a unique constraint, or ignored — what must
  // never happen is a reach figure that says two people read it when one did.
  const { data: afterDuplicate } = await admin
    .from("staff_announcement_acknowledgements")
    .select("id")
    .eq("announcement_id", announcementId);
  expect(afterDuplicate).toHaveLength(1);
  expect(duplicate.error).not.toBeNull();

  proofPassed = true;
});
