import {
  CustomerRepository,
  ServicePartnerRepository,
  WardrobeRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("owner adds a partner, sends a garment out, moves custody, and logs an unreconciled invoice honestly", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const retailerId = asId<"RetailerId">(retailer.id);

  const unique = Date.now();
  const customer = await new CustomerRepository(admin).create({
    retailerId,
    fullName: `E2E Partner Client ${unique}`,
    email: `service-partner-${unique}@paon.test`,
    lifecycleStage: "prospect",
  });
  const wardrobeItem = await new WardrobeRepository(admin).createExternalItem({
    retailerId,
    customerId: customer.id,
    categoryCode: "jacket",
    displayName: `E2E Jacket ${unique}`,
    condition: "good",
    careState: "current",
    fitPerception: "true_to_size",
  });

  const partnerName = `E2E Cleaner ${unique}`;
  const jobReference = `E2E-JOB-${unique}`;

  try {
    await page.goto("/service-partners");

    await page.getByText("Add a partner").click();
    await page.getByLabel("Name").fill(partnerName);
    await page.getByRole("checkbox", { name: "dry cleaning" }).check();
    await page.getByLabel("Turnaround (days)").fill("4");
    await page.getByRole("button", { name: "Add partner" }).click();
    await expect(page.getByText(partnerName).first()).toBeVisible();

    await page.getByText("Send a garment to a partner").click();
    await page.locator("#partnerId").selectOption({ label: partnerName });
    await page.locator("#capability").selectOption("dry_cleaning");
    await page.locator("#wardrobeItemId").selectOption({
      label: `E2E Partner Client ${unique} — E2E Jacket ${unique}`,
    });
    await page.locator("#jobReference").fill(jobReference);
    const dueOn = new Date(Date.now() + 3 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    await page.locator("#dueOn").fill(dueOn);
    await page
      .locator("#instructions")
      .fill("Standard dry clean, press sharp.");
    await page.getByRole("button", { name: "Send to partner" }).click();

    const engagementRow = page.locator("li", { hasText: jobReference });
    await expect(engagementRow).toBeVisible();
    await expect(
      engagementRow.locator("span", { hasText: "with retailer" }),
    ).toBeVisible();

    await engagementRow
      .getByLabel("Move to")
      .selectOption("in_transit_to_partner");
    await engagementRow.getByRole("button", { name: "Record" }).click();
    await expect(
      engagementRow.locator("span", { hasText: "in transit to partner" }),
    ).toBeVisible();

    await engagementRow.getByLabel("Move to").selectOption("with_partner");
    await engagementRow.getByRole("button", { name: "Record" }).click();
    await expect(
      engagementRow.locator("span", { hasText: "with partner" }),
    ).toBeVisible();

    await engagementRow
      .getByLabel("Move to")
      .selectOption("in_transit_to_retailer");
    await engagementRow.getByRole("button", { name: "Record" }).click();
    await expect(
      engagementRow.locator("span", { hasText: "in transit to retailer" }),
    ).toBeVisible();

    const returnNote = `Internal condition note ${unique}`;
    await engagementRow
      .getByLabel("Move to")
      .selectOption("returned_to_retailer");
    await engagementRow
      .getByLabel("Condition note (required on return)")
      .fill(returnNote);
    await engagementRow.getByRole("button", { name: "Record" }).click();
    await expect(
      engagementRow.locator("span", { hasText: "returned to retailer" }),
    ).toBeVisible();

    // Invoice: log it, add a line with no matching recorded cost, and
    // reconcile — proving the reconciliation is a real computation, not
    // a rubber stamp: it must honestly report the unmatched line.
    const invoiceReference = `INV-${unique}`;
    await page.getByText("Log a partner invoice").click();
    await page
      .locator("#invoicePartnerId")
      .selectOption({ label: partnerName });
    await page.locator("#partnerInvoiceReference").fill(invoiceReference);
    const periodStart = new Date(Date.now() - 30 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const periodEnd = new Date().toISOString().slice(0, 10);
    await page.locator("#periodStart").fill(periodStart);
    await page.locator("#periodEnd").fill(periodEnd);
    await page.locator("#currency").fill("USD");
    await page.getByRole("button", { name: "Log invoice" }).click();

    const invoiceRow = page.locator("li", { hasText: invoiceReference });
    await expect(invoiceRow).toBeVisible();

    await invoiceRow.getByLabel("Job reference").fill(jobReference);
    await invoiceRow.getByLabel("Amount (minor units)").fill("15000");
    await invoiceRow.getByRole("button", { name: "Add line" }).click();
    await expect(invoiceRow.getByText(jobReference)).toBeVisible();

    await invoiceRow.getByRole("button", { name: "Reconcile" }).click();
    await expect(invoiceRow.getByText(/Not reconciled/)).toBeVisible();
    await expect(
      invoiceRow.getByRole("button", { name: "Approve" }),
    ).toHaveCount(0);
  } finally {
    const repo = new ServicePartnerRepository(admin);
    const partner = (await repo.findPartnersByRetailer(retailerId)).find(
      (p) => p.displayName === partnerName,
    );
    if (partner) {
      const engagements = (
        await repo.findEngagementsByRetailer(retailerId)
      ).filter((e) => e.partnerId === partner.id);
      for (const engagement of engagements) {
        await admin
          .from("service_partner_custody_events")
          .delete()
          .eq("engagement_id", engagement.id);
        await admin
          .from("service_partner_engagements")
          .delete()
          .eq("id", engagement.id);
      }
      const invoices = (await repo.findInvoicesByRetailer(retailerId)).filter(
        (invoice) => invoice.partnerId === partner.id,
      );
      for (const invoice of invoices) {
        await admin
          .from("service_partner_invoice_lines")
          .delete()
          .eq("invoice_id", invoice.id);
        await admin
          .from("service_partner_invoices")
          .delete()
          .eq("id", invoice.id);
      }
      await admin.from("service_partners").delete().eq("id", partner.id);
    }
    await admin.from("wardrobe_items").delete().eq("id", wardrobeItem.id);
    await admin.from("customers").delete().eq("id", customer.id);
  }
});

test("retailer submits quality review after engagement return and review persists", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const retailerId = asId<"RetailerId">(retailer.id);

  const unique = Date.now();
  const customer = await new CustomerRepository(admin).create({
    retailerId,
    fullName: `E2E Quality Review Client ${unique}`,
    email: `quality-review-${unique}@paon.test`,
    lifecycleStage: "prospect",
  });
  const wardrobeItem = await new WardrobeRepository(admin).createExternalItem({
    retailerId,
    customerId: customer.id,
    categoryCode: "shirt",
    displayName: `E2E Review Shirt ${unique}`,
    condition: "good",
    careState: "current",
    fitPerception: "true_to_size",
  });

  const partnerName = `E2E Quality Partner ${unique}`;
  const jobReference = `QR-${unique}`;
  let engagementId: string | undefined;

  try {
    await page.goto("/service-partners");

    // Create partner
    await page.getByText("Add a partner").click();
    await page.getByLabel("Name").fill(partnerName);
    await page.getByRole("checkbox", { name: "dry cleaning" }).check();
    await page.getByLabel("Turnaround (days)").fill("2");
    await page.getByRole("button", { name: "Add partner" }).click();
    await expect(page.getByText(partnerName).first()).toBeVisible();

    // Send garment
    await page.getByText("Send a garment to a partner").click();
    await page.locator("#partnerId").selectOption({ label: partnerName });
    await page.locator("#capability").selectOption("dry_cleaning");
    await page.locator("#wardrobeItemId").selectOption({
      label: `E2E Quality Review Client ${unique} — E2E Review Shirt ${unique}`,
    });
    await page.locator("#jobReference").fill(jobReference);
    const dueOn = new Date(Date.now() + 2 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    await page.locator("#dueOn").fill(dueOn);
    await page.locator("#instructions").fill("Dry clean only.");
    await page.getByRole("button", { name: "Send to partner" }).click();

    const engagementRow = page.locator("li", { hasText: jobReference });
    await expect(engagementRow).toBeVisible();

    // Move through states to returned
    await engagementRow
      .getByLabel("Move to")
      .selectOption("in_transit_to_partner");
    await engagementRow.getByRole("button", { name: "Record" }).click();

    await engagementRow.getByLabel("Move to").selectOption("with_partner");
    await engagementRow.getByRole("button", { name: "Record" }).click();

    await engagementRow
      .getByLabel("Move to")
      .selectOption("in_transit_to_retailer");
    await engagementRow.getByRole("button", { name: "Record" }).click();

    const returnNote = `Quality check passed ${unique}`;
    await engagementRow
      .getByLabel("Move to")
      .selectOption("returned_to_retailer");
    await engagementRow
      .getByLabel("Condition note (required on return)")
      .fill(returnNote);
    await engagementRow.getByRole("button", { name: "Record" }).click();
    await expect(
      engagementRow.locator("span", { hasText: "returned to retailer" }),
    ).toBeVisible();

    // Get engagement ID from database for verification
    const repo = new ServicePartnerRepository(admin);
    const partner = (await repo.findPartnersByRetailer(retailerId)).find(
      (p) => p.displayName === partnerName,
    );
    if (!partner) throw new Error("Partner not found");

    const engagements = (
      await repo.findEngagementsByRetailer(retailerId)
    ).filter(
      (e) => e.partnerId === partner.id && e.jobReference === jobReference,
    );
    if (engagements.length === 0) throw new Error("Engagement not found");
    engagementId = engagements[0]!.id;

    // Submit quality review directly via repository
    // (UI form wiring is a follow-up; we verify the repository method works)
    await repo.submitQualityReview({
      retailerId,
      engagementId,
      retailerRating: 4,
      retailerNote: `Well-executed dry clean. ${unique}`,
    });

    // Verify quality review was persisted in database
    const review = await repo.findQualityReviewByEngagement(engagementId);
    expect(review).not.toBeNull();
    if (review) {
      expect(review.retailerRating).toBe(4);
      expect(review.retailerNote).toContain("Well-executed dry clean");
    }
  } finally {
    if (engagementId) {
      const admin2 = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
      await admin2
        .from("service_partner_quality_reviews")
        .delete()
        .eq("engagement_id", engagementId);
      await admin2
        .from("service_partner_custody_events")
        .delete()
        .eq("engagement_id", engagementId);
      await admin2
        .from("service_partner_engagements")
        .delete()
        .eq("id", engagementId);
    }

    const repo = new ServicePartnerRepository(admin);
    const partner = (await repo.findPartnersByRetailer(retailerId)).find(
      (p) => p.displayName === partnerName,
    );
    if (partner) {
      await admin.from("service_partners").delete().eq("id", partner.id);
    }
    await admin.from("wardrobe_items").delete().eq("id", wardrobeItem.id);
    await admin.from("customers").delete().eq("id", customer.id);
  }
});
