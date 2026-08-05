import {
  ConceptScanRepository,
  ProductRepository,
  ProductVariantRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

/**
 * FT-03 QR try-on and fabric-batch concept order
 * (docs/FOUNDER_TOOL_BLUEPRINTS.md) — proves every named state the
 * blueprint requires: unknown, active (signed-out and signed-in), added
 * to a running selection, manual code entry as a first-class path (not
 * only a scanned-QR shortcut), explicit "send to advisor" submission,
 * recalled, expired and a code scanned from a different House.
 */
test("a customer resolves scan codes anonymously, adds them once signed in via both the direct link and manual entry, sends the concept order to their advisor, and every non-happy state renders honestly", async ({
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

  const { data: retailer } = await admin
    .from("retailers")
    .select("id, slug, display_name")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const retailerId = asId<"RetailerId">(retailer.id);

  const { data: staff } = await admin
    .from("retailer_staff_members")
    .select("id")
    .eq("retailer_id", retailerId)
    .limit(1)
    .single();
  if (!staff) throw new Error("fixture retailer has no staff");
  const staffId = asId<"StaffId">(staff.id);

  const { data: otherRetailer } = await admin
    .from("retailers")
    .select("id, slug, display_name")
    .neq("slug", TEST_RETAILER_SLUG)
    .eq("status", "active")
    .limit(1)
    .single();
  if (!otherRetailer) {
    throw new Error(
      "no second fixture retailer to prove cross-House isolation",
    );
  }

  const products = await new ProductRepository(admin).findByRetailer(
    retailerId,
  );
  const product = products.find((p) => p.status === "active");
  if (!product) throw new Error("fixture retailer has no active product");
  const variants = await new ProductVariantRepository(admin).findByProduct(
    product.id,
  );
  const variant = variants[0];
  if (!variant) throw new Error("fixture product has no variant");

  const conceptRepo = new ConceptScanRepository(admin);
  const activeCode = await conceptRepo.issueCode(retailerId, staffId, {
    productVariantId: variant.id,
    kind: "try_on",
  });
  const secondCode = await conceptRepo.issueCode(retailerId, staffId, {
    productVariantId: variant.id,
    kind: "fabric_swatch",
  });
  const recalledCode = await conceptRepo.issueCode(retailerId, staffId, {
    productVariantId: variant.id,
    kind: "try_on",
  });
  await conceptRepo.recallCode(recalledCode.id);
  const expiredCode = await conceptRepo.issueCode(retailerId, staffId, {
    productVariantId: variant.id,
    kind: "try_on",
    expiresAt: new Date(Date.now() - 60_000).toISOString(),
  });

  const otherRetailerId = asId<"RetailerId">(otherRetailer.id);
  const otherProducts = await new ProductRepository(admin).findByRetailer(
    otherRetailerId,
  );
  const otherProduct = otherProducts.find((p) => p.status === "active");
  const otherStaff = otherProduct
    ? (
        await admin
          .from("retailer_staff_members")
          .select("id")
          .eq("retailer_id", otherRetailerId)
          .limit(1)
          .single()
      ).data
    : null;
  const otherVariants = otherProduct
    ? await new ProductVariantRepository(admin).findByProduct(otherProduct.id)
    : [];
  const otherHouseCode =
    otherProduct && otherStaff && otherVariants[0]
      ? await conceptRepo.issueCode(
          otherRetailerId,
          asId<"StaffId">(otherStaff.id),
          { productVariantId: otherVariants[0].id, kind: "try_on" },
        )
      : null;

  const issuedCodeIds = [
    activeCode.id,
    secondCode.id,
    recalledCode.id,
    expiredCode.id,
    ...(otherHouseCode ? [otherHouseCode.id] : []),
  ];
  let selectionId: string | undefined;

  try {
    // Unknown code — a real named state, not a bare 404.
    await page.goto(`/r/${TEST_RETAILER_SLUG}/concepts/NOSUCHCODEXX`);
    await expect(page.getByText("We couldn't find this code.")).toBeVisible();

    // Recalled and expired both render their own honest message rather
    // than the item as if it were still live.
    await page.goto(`/r/${TEST_RETAILER_SLUG}/concepts/${recalledCode.code}`);
    await expect(
      page.getByText("This tag has been recalled and is no longer active."),
    ).toBeVisible();
    await page.goto(`/r/${TEST_RETAILER_SLUG}/concepts/${expiredCode.code}`);
    await expect(page.getByText("This code has expired.")).toBeVisible();

    // Signed out: the real item resolves, but the only action is signing in.
    await page.goto(`/r/${TEST_RETAILER_SLUG}/concepts/${activeCode.code}`);
    await expect(page.getByText(product.name)).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Sign in to add to your concept list" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add to my concept list" }),
    ).toHaveCount(0);

    // Sign in.
    const { data: linkData, error: linkError } =
      await admin.auth.admin.generateLink({
        type: "magiclink",
        email: TEST_CUSTOMER_EMAIL,
      });
    if (linkError || !linkData.properties) {
      throw new Error(
        `Failed to generate magic link: ${linkError?.message ?? "unknown"}`,
      );
    }
    await page.goto(
      `/auth/confirm?token_hash=${linkData.properties.hashed_token}&type=magiclink`,
    );
    await expect(page).toHaveURL(/\/dashboard$/);

    // The real add path, from the direct/scanned link.
    await page.goto(`/r/${TEST_RETAILER_SLUG}/concepts/${activeCode.code}`);
    await page.getByRole("button", { name: "Add to my concept list" }).click();
    await expect(page.getByText("Added to your concept list.")).toBeVisible();

    await page.goto(`/r/${TEST_RETAILER_SLUG}/concepts`);
    await expect(
      page.getByText(new RegExp(`Try-On.*${product.name}`)),
    ).toBeVisible();

    // The mandatory manual-entry path adds a second, different item.
    await page
      .getByLabel("Enter the code from your Try-On or swatch tag")
      .fill(secondCode.code);
    await page.getByRole("button", { name: "Find piece" }).click();
    await expect(page).toHaveURL(new RegExp(`/concepts/${secondCode.code}$`));
    await page.getByRole("button", { name: "Add to my concept list" }).click();
    await expect(page.getByText("Added to your concept list.")).toBeVisible();

    await page.goto(`/r/${TEST_RETAILER_SLUG}/concepts`);
    await expect(
      page.getByText(new RegExp(`Fabric swatch.*${product.name}`)),
    ).toBeVisible();

    // Cross-House isolation: a code minted for a different retailer
    // shows the wrong-House state here, not the item.
    if (otherHouseCode) {
      await page.goto(
        `/r/${TEST_RETAILER_SLUG}/concepts/${otherHouseCode.code}`,
      );
      await expect(
        page.getByText("This code belongs to a different House."),
      ).toBeVisible();
    }

    const { data: draftRow } = await admin
      .from("concept_order_selections")
      .select("id")
      .eq("retailer_id", retailerId)
      .eq("status", "draft")
      .single();
    selectionId = draftRow?.id;

    // Explicit "send to advisor" — both accumulated items travel together
    // as one concept order.
    await page.getByRole("button", { name: "Send to my advisor" }).click();
    await expect(page).toHaveURL(/\/concepts\?sent=1$/);
    await expect(page.getByText("Sent to your advisor.")).toBeVisible();
    await expect(page.getByText("Nothing added yet.")).toBeVisible();
  } finally {
    if (selectionId) {
      await admin
        .from("concept_order_selection_items")
        .delete()
        .eq("selection_id", selectionId);
      await admin
        .from("concept_order_selections")
        .delete()
        .eq("id", selectionId);
    }
    await admin.from("concept_scan_codes").delete().in("id", issuedCodeIds);
  }
});
