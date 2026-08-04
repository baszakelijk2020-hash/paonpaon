import { CorporateRepository, createSupabaseAdminClient } from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import { TEST_RETAILER_SLUG } from "./fixtures";

/**
 * Proves the public office-visit landing page (PHASE 18.4 / BD-104) end
 * to end: an anonymous visitor sees the company-branded page and their
 * submitted request really lands in the retailer's intake queue.
 */
test("an anonymous visitor sees the company-branded page and submits a real visit request", async ({
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
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const retailerId = asId<"RetailerId">(retailer.id);

  const unique = Date.now();
  const repo = new CorporateRepository(admin);
  const account = await repo.createAccount(retailerId, {
    legalName: `Customer e2e Office Visit Co ${unique}`,
    accountReference: `E2E-OV-${unique}`,
  });
  const programme = await repo.createProgramme(retailerId, {
    accountId: account.id,
    name: `Customer e2e Office Visit Programme ${unique}`,
    siteKeys: [],
  });

  const requesterName = `Customer e2e Requester ${unique}`;

  try {
    await page.goto(`/r/${TEST_RETAILER_SLUG}/corporate/${programme.id}`);
    await expect(
      page.getByRole("heading", { name: account.legalName }),
    ).toBeVisible();
    await expect(page.getByText(programme.name)).toBeVisible();

    await page.getByLabel("Your name").fill(requesterName);
    await page.getByLabel("Note (optional)").fill("Visiting Tuesday.");
    await page.getByRole("button", { name: "Request a visit" }).click();
    await expect(page.getByRole("status")).toBeVisible();

    const { data: requestRow } = await admin
      .from("corporate_office_visit_requests")
      .select("status, note")
      .eq("programme_id", programme.id)
      .eq("requester_name", requesterName)
      .single();
    expect(requestRow?.status).toBe("open");
    expect(requestRow?.note).toBe("Visiting Tuesday.");
  } finally {
    await admin.from("corporate_accounts").delete().eq("id", account.id);
  }
});
