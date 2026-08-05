import {
  CorporateOfficeVisitRepository,
  CorporateRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "18.4";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/corporate-office-visit.spec.ts";

let proofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: proofPassed ? "passed" : "failed",
  });
});

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

/**
 * Proves the office-visit request queue (PHASE 18.4 / BD-104) end to
 * end: a request lands in the programme's intake queue; a requester
 * with no contact email can only be marked "Scheduled" as a status
 * label (asserted against the database, including that `resolved_at`
 * is actually set); a requester who left a real email gets a real
 * appointment booked — this item's own previously-named gap, now
 * closed — asserted against both the new `appointments` row and the
 * `corporate_office_visit_requests` row's `customer_id`/`appointment_id`
 * linkage, not just the page's own rendering choice.
 */
test("an office-visit request appears in the programme's queue, a no-email request can only be marked scheduled, and an emailed request gets a real appointment booked", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const repo = new CorporateRepository(admin);

  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const retailerId = asId<"RetailerId">(retailer.id);

  const unique = Date.now();
  const account = await repo.createAccount(retailerId, {
    legalName: `E2E Office Visit Co ${unique}`,
    accountReference: `E2E-OV-${unique}`,
  });
  const programme = await repo.createProgramme(retailerId, {
    accountId: account.id,
    name: `E2E Office Visit Programme ${unique}`,
    siteKeys: [],
  });
  const requesterName = `E2E Requester ${unique}`;
  await new CorporateOfficeVisitRepository(admin).submit({
    programmeId: programme.id,
    requesterName,
    note: "Would like to book a fitting during the office visit.",
  });

  const emailedRequesterName = `E2E Emailed Requester ${unique}`;
  const contactEmail = `e2e-office-visit-${unique}@paon.test`;
  await new CorporateOfficeVisitRepository(admin).submit({
    programmeId: programme.id,
    requesterName: emailedRequesterName,
    contactEmail,
    note: "Please book me directly.",
  });

  try {
    await page.goto(`/corporate/${programme.id}`);
    const row = page.locator("li", { hasText: requesterName });
    await expect(row).toBeVisible();
    await expect(row.getByText("Open")).toBeVisible();

    await row.getByRole("button", { name: "Scheduled" }).click();
    await expect(row.getByRole("button", { name: "Scheduled" })).toHaveCount(0);
    await expect(row.getByText("Scheduled", { exact: true })).toBeVisible();

    const { data: requestRow } = await admin
      .from("corporate_office_visit_requests")
      .select("status, resolved_at, customer_id, appointment_id")
      .eq("programme_id", programme.id)
      .eq("requester_name", requesterName)
      .single();
    expect(requestRow?.status).toBe("scheduled");
    expect(requestRow?.resolved_at).toBeTruthy();
    expect(requestRow?.customer_id).toBeNull();
    expect(requestRow?.appointment_id).toBeNull();

    // The emailed requester gets a real appointment, not a status label.
    const emailedRow = page.locator("li", { hasText: emailedRequesterName });
    await expect(emailedRow).toBeVisible();
    await emailedRow.getByText("Schedule appointment").click();

    const startsField = emailedRow.locator('[data-datetime-field="startsAt"]');
    const endsField = emailedRow.locator('[data-datetime-field="endsAt"]');
    await startsField.locator("[data-day]").first().click();
    await startsField.locator('[data-time="10:00"]').click();
    await endsField.locator("[data-day]").first().click();
    await endsField.locator('[data-time="10:30"]').click();
    await emailedRow
      .getByRole("button", { name: "Book real appointment" })
      .click();

    await expect(emailedRow.getByText("Appointment booked")).toBeVisible();

    const { data: emailedRequestRow } = await admin
      .from("corporate_office_visit_requests")
      .select("status, resolved_at, customer_id, appointment_id")
      .eq("programme_id", programme.id)
      .eq("requester_name", emailedRequesterName)
      .single();
    expect(emailedRequestRow?.status).toBe("scheduled");
    expect(emailedRequestRow?.customer_id).toBeTruthy();
    expect(emailedRequestRow?.appointment_id).toBeTruthy();

    const { data: createdCustomer } = await admin
      .from("customers")
      .select("id, email, full_name, lifecycle_stage")
      .eq("id", emailedRequestRow!.customer_id!)
      .single();
    expect(createdCustomer?.email).toBe(contactEmail);
    expect(createdCustomer?.full_name).toBe(emailedRequesterName);
    expect(createdCustomer?.lifecycle_stage).toBe("prospect");

    const { data: createdAppointment } = await admin
      .from("appointments")
      .select("id, customer_id, retailer_id, type, starts_at, ends_at")
      .eq("id", emailedRequestRow!.appointment_id!)
      .single();
    expect(createdAppointment?.customer_id).toBe(
      emailedRequestRow!.customer_id,
    );
    expect(createdAppointment?.retailer_id).toBe(retailerId);
    expect(createdAppointment?.type).toBe("styling_consultation");
    expect(Date.parse(createdAppointment!.starts_at)).toBeLessThan(
      Date.parse(createdAppointment!.ends_at),
    );

    proofPassed = true;
  } finally {
    // customer_id/appointment_id must be read BEFORE the account delete
    // below — that cascades away the programme and this request row,
    // and neither `customers` nor `appointments` cascades from a
    // corporate account (no FK between them at all).
    const { data: cleanupRow } = await admin
      .from("corporate_office_visit_requests")
      .select("customer_id, appointment_id")
      .eq("programme_id", programme.id)
      .eq("requester_name", emailedRequesterName)
      .maybeSingle();
    await admin.from("corporate_accounts").delete().eq("id", account.id);
    if (cleanupRow?.appointment_id) {
      await admin
        .from("appointments")
        .delete()
        .eq("id", cleanupRow.appointment_id);
    }
    if (cleanupRow?.customer_id) {
      await admin.from("customers").delete().eq("id", cleanupRow.customer_id);
    }
  }
});
