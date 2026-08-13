import {
  CustomerRepository,
  WeddingPartyRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";

function dateOffset(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// FT-13's anniversary continuation: `nextAnniversary` existed with unit
// coverage but no caller anywhere in either app, so a customer's wedding
// anniversary never actually surfaced as anything. This proves the real
// wire: a completed wedding party whose anniversary falls within the
// syncing 30-day window produces a real, visible "Anniversary moment"
// draft opportunity on the customer's own detail page.
test("a completed wedding party's upcoming anniversary surfaces as a draft opportunity", async ({
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
    fullName: `E2E Anniversary Client ${unique}`,
    email: `anniversary-${unique}@paon.test`,
    lifecycleStage: "prospect",
  });

  // A wedding whose month/day is five days ahead of today but one year in
  // the past, so its next annual recurrence lands five days from now --
  // comfortably inside the 30-day surfacing window.
  const eventDate = new Date();
  eventDate.setUTCDate(eventDate.getUTCDate() + 5);
  eventDate.setUTCFullYear(eventDate.getUTCFullYear() - 1);
  const eventDateStr = eventDate.toISOString().slice(0, 10);

  const weddingPartyRepo = new WeddingPartyRepository(admin);
  const party = await weddingPartyRepo.create({
    retailerId,
    organizerCustomerId: customer.id,
    eventDate: eventDateStr,
  });
  await weddingPartyRepo.updateStatus(party.id, "completed");

  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  try {
    await page.goto(`/customers/${customer.id}`);
    await expect(
      page.getByRole("heading", { name: `E2E Anniversary Client ${unique}` }),
    ).toBeVisible();

    await expect(page.getByText("Anniversary moment")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByText(`1 year married on ${dateOffset(5)}.`),
    ).toBeVisible();

    const { data: opportunities } = await admin
      .from("clienteling_opportunities")
      .select("opportunity_type, status, why_now")
      .eq("retailer_id", retailerId)
      .eq("customer_id", customer.id)
      .eq("opportunity_type", "anniversary_moment");
    expect(opportunities).toHaveLength(1);
    expect(opportunities?.[0]?.status).toBe("draft");

    // Reloading must not duplicate the draft -- the sync is idempotent
    // against an already-existing draft with the same why-now text.
    await page.reload();
    await expect(page.getByText("Anniversary moment")).toBeVisible();
    const { data: afterReload } = await admin
      .from("clienteling_opportunities")
      .select("id")
      .eq("retailer_id", retailerId)
      .eq("customer_id", customer.id)
      .eq("opportunity_type", "anniversary_moment");
    expect(afterReload).toHaveLength(1);
  } finally {
    await admin
      .from("clienteling_opportunities")
      .delete()
      .eq("retailer_id", retailerId)
      .eq("customer_id", customer.id);
    await admin.from("wedding_parties").delete().eq("id", party.id);
    await admin.from("customers").delete().eq("id", customer.id);
  }
});
