import {
  SuitConfiguratorRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import { expect, test } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

test("a shopper explores the suit configurator, follows a predefined model, and saves their pick", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
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

  await page.goto(`/r/${TEST_RETAILER_SLUG}/configurator`);
  await expect(page.locator("#suit-configurator-widget")).toBeVisible();

  // The widget opens on model 1 (Henk: notch/jetted/natural) and the three
  // sub-carousels start already synced to it.
  await expect(page.getByText("Matches Henk", { exact: true })).toBeVisible();

  // Clicking a different predefined model smoothly re-syncs all three
  // option carousels together, not just the model carousel itself.
  await page.locator('.model-panel[data-model="2"]').click();
  await expect(page.getByText("Matches Willem", { exact: true })).toBeVisible({
    timeout: 5000,
  });
  await expect(
    page.locator("#lapel-carousel .carousel-panel", { hasText: "Peak" }),
  ).toHaveCSS("opacity", "1");
  await expect(
    page.locator("#pockets-carousel .carousel-panel", { hasText: "Flap" }),
  ).toHaveCSS("opacity", "1");
  await expect(
    page.locator("#shoulder-carousel .carousel-panel", { hasText: "Roped" }),
  ).toHaveCSS("opacity", "1");

  await page.getByRole("button", { name: "Save this configuration" }).click();
  await expect(
    page.getByText("Saved. Your advisor can see this pick.", {
      exact: true,
    }),
  ).toBeVisible();

  // FT-07 expansion: a real next step instead of a dead-end saved intent —
  // a factual, prefilled deep link into the advisor conversation.
  const messageLink = page.getByRole("link", {
    name: "Message advisor about this",
  });
  await expect(messageLink).toBeVisible();
  await expect(messageLink).toHaveAttribute(
    "href",
    /\/messages\?prefill=.*peak%20lapel.*roped%20shoulder.*Willem/,
  );

  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const { data: customerRow } = await admin
    .from("customers")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("email", TEST_CUSTOMER_EMAIL)
    .maybeSingle();
  if (!customerRow) throw new Error("fixture customer missing");

  const repo = new SuitConfiguratorRepository(admin);
  const intents = await repo.findRecentByCustomer(customerRow.id as never, 1);
  expect(intents[0]).toMatchObject({
    lapel: "peak",
    pockets: "flap",
    shoulder: "roped",
    modelPreset: 2,
  });

  // Cleanup: leave no saved intent behind for the shared fixture customer.
  await admin
    .from("suit_configuration_intents")
    .delete()
    .eq("customer_id", customerRow.id);
});
