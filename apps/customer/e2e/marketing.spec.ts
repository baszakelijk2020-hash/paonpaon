import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

test("public product story is useful and interactive without sign-in", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /The relationship is the product/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Workshop" }).click();
  await expect(page.getByText("Midnight dinner jacket")).toBeVisible();

  await page.goto("/pricing");
  await expect(page.getByText("PAON Fused", { exact: true })).toBeVisible();
  await expect(
    page.getByText("PAON Half Canvas", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("PAON Full Canvas", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("€349.00", { exact: true })).toBeVisible();
  await expect(page.getByText("€1,500.00", { exact: true })).toBeVisible();
});

test("a personalized demo request persists with explicit success feedback", async ({
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
  const email = `e2e-commercial-${Date.now()}@paon.test`;

  await page.goto("/demo-request?plan=fused_monthly");
  await page.getByLabel("Retail house").fill("E2E House");
  await page.getByLabel("Your name").fill("Amelia Retailer");
  await page.getByLabel("Work email").fill(email);
  await page
    .getByLabel("What would make this valuable?")
    .fill("Connect private-client appointments to alteration delivery.");
  await page.getByRole("button", { name: "Send request" }).click();

  await expect(page.getByRole("status")).toContainText("Request received");
  const { data, error } = await admin
    .from("commercial_inquiries")
    .select("id, inquiry_type, requested_plan_key")
    .eq("email", email)
    .single();
  expect(error).toBeNull();
  expect(data).toMatchObject({
    inquiry_type: "personalized_demo",
    requested_plan_key: "fused_monthly",
  });

  if (data) {
    await admin.from("commercial_inquiries").delete().eq("id", data.id);
  }
});
