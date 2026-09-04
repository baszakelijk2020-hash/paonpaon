import { resolve } from "node:path";

import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

/**
 * PHASE V3 — My Appointments booking wizard (contract §6): the real
 * step-by-step flow is reason -> location -> date -> time -> review ->
 * confirmed, one step replacing the last rather than a long form. Location,
 * date, and time are real branch opening hours from
 * `RetailerBranchRepository` — not invented availability — and confirming
 * calls the same `AppointmentRepository.requestAppointment` RPC every other
 * customer-initiated appointment uses (`booking-actions.ts`).
 *
 * This proves the wizard end to end against a real, published branch this
 * test provisions (the fixture retailer has none by default — customer-role
 * RLS only exposes published branches, so `published: true` is required for
 * the wizard's location step to see it), and that the persisted appointment
 * then really shows up in the customer's own /appointments view. An
 * earlier "anchor" appointment is seeded so the booked slot — deliberately
 * the farthest of the wizard's offered dates — lands in "Appointment
 * history" rather than becoming the single "Next appointment", proving the
 * history path specifically rather than depending on incidental fixture
 * ordering.
 */

const EVIDENCE_DIR = resolve(
  process.cwd(),
  "../../docs/evidence/runs/customer-v3-booking-wizard-proof",
);

test("reason -> location -> date -> time -> review -> confirmed books a real appointment, which then appears in Appointment history", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });

  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) throw new Error("requires local Supabase.");
  const admin = createSupabaseAdminClient(url, key);

  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const { data: customer } = await admin
    .from("customers")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("email", TEST_CUSTOMER_EMAIL)
    .single();
  if (!customer) throw new Error("fixture customer missing");

  const branchName = `Booking wizard E2E branch ${Date.now()}`;
  const openingHours = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ].map((day) => ({ day, closed: false, opens: "09:00", closes: "18:00" }));

  const { data: branch, error: branchError } = await admin
    .from("retailer_branches")
    .insert({
      retailer_id: retailer.id,
      name: branchName,
      timezone: "UTC",
      is_default: true,
      published: true,
      opening_hours: openingHours,
    })
    .select("id")
    .single();
  if (branchError || !branch) {
    throw new Error(
      `failed to seed fixture branch: ${branchError?.message ?? "unknown"}`,
    );
  }

  // Anchor: a real, earlier upcoming appointment so the wizard-booked one
  // (deliberately the farthest offered date) is guaranteed to land in
  // "Appointment history" rather than replacing it as "Next appointment".
  const anchorStartsAt = new Date(Date.now() + 12 * 60 * 60_000).toISOString();
  const { data: anchor, error: anchorError } = await admin
    .from("appointments")
    .insert({
      retailer_id: retailer.id,
      customer_id: customer.id,
      type: "fitting",
      status: "requested",
      starts_at: anchorStartsAt,
      ends_at: new Date(
        new Date(anchorStartsAt).getTime() + 60 * 60_000,
      ).toISOString(),
      notes: "Booking-wizard-proof anchor appointment",
    })
    .select("id")
    .single();
  if (anchorError || !anchor) {
    throw new Error(
      `failed to seed anchor appointment: ${anchorError?.message ?? "unknown"}`,
    );
  }

  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email: TEST_CUSTOMER_EMAIL,
    });
  if (linkError || !linkData.properties) {
    throw new Error(`magic link failed: ${linkError?.message ?? "unknown"}`);
  }

  let bookedId: string | undefined;

  try {
    await page.setViewportSize({ width: 1512, height: 982 });
    await page.goto(
      `/auth/confirm?token_hash=${linkData.properties.hashed_token}&type=magiclink`,
    );
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/appointments");

    // Step 1 — reason.
    await page
      .getByRole("button", { name: "Book appointment", exact: true })
      .click();
    await expect(page.getByText("Book an appointment")).toBeVisible();
    await page
      .getByRole("button", { name: "A quick glance", exact: true })
      .click();

    // Step 2 — location: the real, published branch just seeded above.
    await page.getByRole("button", { name: branchName, exact: true }).click();

    // Step 3 — date: the wizard's own real opening-hours computation is
    // what enables/disables each date; pick the farthest offered date.
    const dateButtons = page.getByRole("button", {
      name: /^[A-Za-z]{3} \d{1,2} [A-Za-z]+$/,
    });
    await expect(dateButtons.first()).toBeVisible();
    const chosenDate = dateButtons.last();
    const dateLabel = (await chosenDate.textContent())?.trim() ?? "";
    await chosenDate.click();

    // Step 4 — time: a real slot generated from that branch's opening hours.
    const timeButtons = page.getByRole("button", { name: /^\d{2}:\d{2}$/ });
    await expect(timeButtons.first()).toBeVisible();
    const timeLabel = (await timeButtons.first().textContent())?.trim() ?? "";
    await timeButtons.first().click();

    // Step 5 — review: exact reason/branch/date/time before confirming.
    await expect(page.getByText("A quick glance")).toBeVisible();
    await expect(page.getByText(branchName)).toBeVisible();
    await expect(page.getByText(`${dateLabel} · ${timeLabel}`)).toBeVisible();
    const confirmButton = page.getByRole("button", {
      name: "Confirm",
      exact: true,
    });
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    // Step 6 — confirmed.
    await expect(page.getByText("Appointment requested")).toBeVisible();
    await expect(
      page.getByText("Your advisor will confirm the exact time."),
    ).toBeVisible();

    // The persisted row is real — same `styling_consultation` type
    // "A quick glance" maps to, `requested` status, tied to this branch.
    const { data: booking } = await admin
      .from("appointments")
      .select("id, type, status, notes, branch_id")
      .eq("customer_id", customer.id)
      .eq("retailer_id", retailer.id)
      .eq("branch_id", branch.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    expect(booking, "a real appointments row was created").not.toBeNull();
    bookedId = booking!.id;
    expect(booking!.type).toBe("styling_consultation");
    expect(booking!.status).toBe("requested");
    expect(booking!.notes).toBe("A quick glance");

    // Close the confirmation and verify the customer can see the booked
    // appointment in their own /appointments history — not just in the
    // database — after the anchor keeps it out of "Next appointment".
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await page.reload();

    await expect(
      page.getByRole("heading", { name: "Fitting", exact: true }),
    ).toBeVisible();

    const historyToggle = page.getByText(/^Appointment history \(\d+\)$/);
    await expect(historyToggle).toBeVisible();
    await historyToggle.click();
    await expect(
      page.locator(".customer-list-row", {
        hasText: "Styling consultation",
      }),
    ).toHaveCount(1);

    await page.screenshot({
      path: `${EVIDENCE_DIR}/desktop-history-after-booking-1512x982.png`,
      fullPage: true,
    });

    expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
  } finally {
    if (bookedId) {
      await admin.from("appointments").delete().eq("id", bookedId);
    }
    await admin.from("appointments").delete().eq("id", anchor.id);
    await admin
      .from("retailer_branches")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", branch.id);
  }
});
