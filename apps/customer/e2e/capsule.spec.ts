import {
  createSupabaseAdminClient,
  MicroCapsuleRepository,
} from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import {
  TEST_CUSTOMER_EMAIL,
  TEST_PRODUCT_SLUG,
  TEST_RETAILER_SLUG,
} from "./fixtures";

test("this week's published capsule drop shows its products, in order, linked to the product page", async ({
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
  const repo = new MicroCapsuleRepository(admin);

  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const { data: product } = await admin
    .from("products")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("slug", TEST_PRODUCT_SLUG)
    .single();
  if (!product) throw new Error("fixture product missing");

  const weekStart = new Date().toISOString().slice(0, 10);
  // Isolate this run from any prior partial run's drop for the same week.
  await admin
    .from("micro_capsule_drops")
    .delete()
    .eq("retailer_id", retailer.id)
    .eq("week_start", weekStart);

  const drop = await repo.createDrop(asId<"RetailerId">(retailer.id), {
    title: "E2E Capsule Drop",
    theme: "E2E theme",
    weekStart,
    productIds: [product.id],
  });
  await repo.setPublished(drop.id, true);

  try {
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

    await page.goto("/capsule");
    await expect(
      page.getByRole("heading", { name: "E2E Capsule Drop" }),
    ).toBeVisible();
    await expect(page.getByText("E2E theme")).toBeVisible();

    const link = page.getByRole("link", { name: /E2E Storefront Overcoat/ });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute(
      "href",
      `/r/${TEST_RETAILER_SLUG}/products/${TEST_PRODUCT_SLUG}`,
    );
  } finally {
    await admin.from("micro_capsule_drops").delete().eq("id", drop.id);
  }
});
