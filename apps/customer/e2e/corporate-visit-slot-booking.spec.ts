import { CorporateRepository, createSupabaseAdminClient } from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import { TEST_RETAILER_SLUG } from "./fixtures";

/**
 * Proves self-service slot booking (PHASE 18.4, direct founder
 * instruction 2026-08-19): when a retailer has defined open slots for a
 * programme, an anonymous visitor sees and can claim one directly — no
 * staff step — and the claim really lands as a scheduled, resolved
 * request in the retailer's queue with a real slot booked_count
 * increment, not just a confirmation message.
 */
test("an anonymous visitor books a real open slot with no staff involvement", async ({
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
    legalName: `Customer e2e Slot Booking Co ${unique}`,
    accountReference: `E2E-SLOT-${unique}`,
  });
  const programme = await repo.createProgramme(retailerId, {
    accountId: account.id,
    name: `Customer e2e Slot Booking Programme ${unique}`,
    siteKeys: [],
  });

  const { data: slot, error: slotError } = await admin
    .from("corporate_visit_slots")
    .insert({
      retailer_id: retailerId,
      programme_id: programme.id,
      starts_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      ends_at: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000,
      ).toISOString(),
      capacity: 1,
    })
    .select("id")
    .single();
  if (!slot) {
    throw new Error(
      `failed to seed visit slot: ${slotError?.message ?? "unknown error"}`,
    );
  }

  const requesterName = `Customer e2e Visitor ${unique}`;

  try {
    await page.goto(`/r/${TEST_RETAILER_SLUG}/corporate/${programme.id}`);
    await expect(
      page.getByRole("heading", { name: account.legalName }),
    ).toBeVisible();

    // Self-service picker shown, not the leave-a-request fallback — a real
    // open slot exists, so this proves the branch actually took.
    await expect(page.getByText("Choose a time for your visit.")).toBeVisible();
    await expect(page.getByText("1 spot left")).toBeVisible();

    await page.getByRole("button", { name: /1 spot left/ }).click();
    await page.getByLabel("Your name").fill(requesterName);
    await page.getByRole("button", { name: "Confirm booking" }).click();
    await expect(page.getByRole("status")).toBeVisible();
    await expect(page.getByText("Booked")).toBeVisible();

    const { data: requestRow } = await admin
      .from("corporate_office_visit_requests")
      .select("status, resolved_at")
      .eq("programme_id", programme.id)
      .eq("requester_name", requesterName)
      .single();
    expect(requestRow?.status).toBe("scheduled");
    expect(requestRow?.resolved_at).not.toBeNull();

    const { data: slotAfter } = await admin
      .from("corporate_visit_slots")
      .select("booked_count")
      .eq("id", slot.id)
      .single();
    expect(slotAfter?.booked_count).toBe(1);
  } finally {
    await admin.from("corporate_visit_slots").delete().eq("id", slot.id);
    await admin.from("corporate_accounts").delete().eq("id", account.id);
  }
});

/**
 * The fallback: a programme with no open slots at all still shows the
 * original leave-a-request form, not an empty or broken page.
 */
test("a programme with no open slots falls back to the leave-a-request form", async ({
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
    legalName: `Customer e2e No Slots Co ${unique}`,
    accountReference: `E2E-NOSLOT-${unique}`,
  });
  const programme = await repo.createProgramme(retailerId, {
    accountId: account.id,
    name: `Customer e2e No Slots Programme ${unique}`,
    siteKeys: [],
  });

  try {
    await page.goto(`/r/${TEST_RETAILER_SLUG}/corporate/${programme.id}`);
    await expect(
      page.getByRole("button", { name: "Request a visit" }),
    ).toBeVisible();
    await expect(
      page.getByText("Choose a time for your visit."),
    ).not.toBeVisible();
  } finally {
    await admin.from("corporate_accounts").delete().eq("id", account.id);
  }
});
