import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

/**
 * The real MorningRoutine engine now auto-generates and renders at the top
 * of the dashboard instead of sitting on its own page behind a manual
 * "Select today" button — pag1.html's own composed-look widget (anchor
 * id="morning", live weather fetch, "Hi {name} ... today calls for
 * something special") is a daily hero, not a page a customer has to
 * remember to visit.
 */
test("the dashboard shows today's MorningRoutine hero automatically, with a priced breakdown", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("requires local Supabase.");
  }
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: TEST_CUSTOMER_EMAIL,
  });
  if (error || !data.properties) {
    throw new Error(
      `Failed to generate magic link: ${error?.message ?? "unknown error"}`,
    );
  }
  await page.goto(
    `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`,
  );
  await expect(page).toHaveURL(/\/dashboard$/);

  // No manual "Select today" click anywhere — the hero must appear on its
  // own from a cold dashboard load.
  await expect(
    page.getByText(/today calls for something special/),
  ).toBeVisible();
  await expect(page.getByText("Complete the look")).toBeVisible();

  // At least one priced piece with a working Buy link into the real store.
  const buyLink = page.getByRole("link", { name: "Buy" }).first();
  await expect(buyLink).toBeVisible();
  const href = await buyLink.getAttribute("href");
  expect(href).toMatch(new RegExp(`/r/${TEST_RETAILER_SLUG}`));

  // Reloading does not silently reshuffle "today's look" underneath the
  // customer — same featured piece both times.
  const featuredHeading = page.getByRole("heading", { level: 1 });
  const firstLook = await featuredHeading.textContent();
  await page.reload();
  await expect(featuredHeading).toHaveText(firstLook ?? "");
});
