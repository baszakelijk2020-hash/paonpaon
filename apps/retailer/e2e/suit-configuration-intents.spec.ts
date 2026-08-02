import {
  createSupabaseAdminClient,
  createSupabaseDirectClient,
} from "@paon/database";
import { expect, test } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";

test("owner sees a client's saved suit configurator pick on their profile", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    throw new Error("requires local Supabase.");
  }

  const unique = Date.now();
  const shopperEmail = `configurator-shopper-${unique}@paon.test`;
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");

  // Save through the real write path (save_suit_configuration_intent) as
  // an authenticated shopper, exactly what the customer-facing configurator
  // does — the RPC self-creates the customer row from auth.uid(), so there
  // is deliberately no direct table insert here (the migration grants no
  // INSERT on suit_configuration_intents to any role but this RPC).
  //
  // generateLink({type: "magiclink"}) for an email with no existing auth
  // user silently mints a "signup"-type token instead (visible only in
  // action_link's own query string) — verifying it as "magiclink" then
  // fails with "Email link is invalid or has expired". Creating the user
  // first avoids that trap.
  const { error: createUserError } = await admin.auth.admin.createUser({
    email: shopperEmail,
    email_confirm: true,
  });
  if (createUserError) throw createUserError;
  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email: shopperEmail,
    });
  if (linkError || !linkData.properties) {
    throw new Error(
      `Failed to generate magic link: ${linkError?.message ?? "unknown error"}`,
    );
  }
  const shopperClient = createSupabaseDirectClient(supabaseUrl, anonKey);
  const { error: verifyError } = await shopperClient.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "magiclink",
  });
  if (verifyError) throw verifyError;

  const { error: rpcError } = await shopperClient.rpc(
    "save_suit_configuration_intent",
    {
      p_retailer_id: retailer.id,
      p_lapel: "peak",
      p_pockets: "flap",
      p_shoulder: "roped",
      p_model_preset: 2,
    },
  );
  if (rpcError) throw rpcError;

  const { data: customerRow } = await admin
    .from("customers")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("email", shopperEmail)
    .single();
  if (!customerRow) throw new Error("self-created customer not found");

  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto(`/customers/${customerRow.id}`);
  await expect(page.getByText("Suit configurator picks")).toBeVisible();
  await expect(page.getByText("Willem")).toBeVisible();
  await expect(
    page.getByText("peak lapel · flap pockets · roped shoulder"),
  ).toBeVisible();
});
