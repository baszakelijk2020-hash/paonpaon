import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { createSupabaseAdminClient } from "@paon/database";
import { expect, test, type Page } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

/**
 * Phase 20.6 (CENV-APPOINTMENTS-001) — My Appointments' real progressive
 * booking wizard, end to end.
 *
 * CUSTOMER_ENVIRONMENT_REBUILD_V3 §6: "New booking flow replaces one step
 * with the next: reason -> location -> date -> time -> review -> confirmed
 * ... Location/date/time use real retailer branches, opening hours, and
 * availability." §10 requires every changed control exercised through its
 * real success result and desktop + mobile browser proof.
 *
 * This spec drives BOTH entry points into `BookingFlow`
 * (apps/customer/app/(dashboard)/appointments/booking-flow.tsx):
 *  - a "Suggestions to book" inspiration card, which preselects a reason
 *    and opens straight on the location step (matching the Wardrobe
 *    prefill behaviour already proven in
 *    wardrobe-appointments-prefill-v3.spec.ts);
 *  - the plain "Book appointment" launcher, which shows every step
 *    including the reason picker.
 * Every step's real branch/date/time data and the final persisted
 * `appointments` row are inspected via the service-role client — used only
 * to seed the fixture branch and read the DB postcondition, never to
 * perform the booking. The booking itself always executes through the
 * real authenticated customer session and the real `bookAppointment`
 * Server Action -> `request_appointment` RPC.
 */

const EVIDENCE_SUBPATH =
  "../../../docs/evidence/runs/customer-v3-appointments-booking-wizard";

function admin() {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
}

function attachUnfilteredConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${String(e)}`));
  return errors;
}

async function resolveIdentity(): Promise<{
  retailerId: string;
  customerId: string;
}> {
  const client = admin();
  const { data: retailer } = await client
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const { data: customerRow } = await client
    .from("customers")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("email", TEST_CUSTOMER_EMAIL)
    .maybeSingle();
  if (!customerRow) throw new Error("fixture customer missing");
  return { retailerId: retailer.id, customerId: customerRow.id };
}

async function seedPublishedBranch(
  retailerId: string,
  label: string,
): Promise<{ id: string; name: string }> {
  const client = admin();
  const openingHours = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ].map((day) => ({ day, closed: false, opens: "09:00", closes: "18:00" }));
  const name = `${label} ${Date.now()}`;
  const { data: branch, error } = await client
    .from("retailer_branches")
    .insert({
      retailer_id: retailerId,
      name,
      timezone: "UTC",
      is_default: false,
      published: true,
      opening_hours: openingHours,
    })
    .select("id")
    .single();
  if (error || !branch) {
    throw new Error(`failed to seed fixture branch: ${error?.message}`);
  }
  return { id: branch.id as string, name };
}

async function cleanupBranch(branchId: string): Promise<void> {
  await admin()
    .from("retailer_branches")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", branchId);
}

async function cleanupAppointment(appointmentId: string): Promise<void> {
  await admin().from("appointments").delete().eq("id", appointmentId);
}

async function signIn(page: Page): Promise<void> {
  const { data, error } = await admin().auth.admin.generateLink({
    type: "magiclink",
    email: TEST_CUSTOMER_EMAIL,
  });
  if (error || !data.properties) {
    throw new Error(`magic link failed: ${error?.message ?? "unknown"}`);
  }
  await page.goto(
    `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`,
  );
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator("[data-customer-shell]")).toBeVisible();
}

/** Clicks the first enabled date button, then the first real availability
 * slot it exposes — both are read straight off the branch's real opening
 * hours (booking-flow.tsx `timesForDay`), never invented. */
async function pickDateAndTime(page: Page): Promise<void> {
  const dateButtons = page.getByRole("button", {
    name: /^[A-Za-z]{3} \d{1,2} [A-Za-z]+$/,
  });
  await expect(dateButtons.first()).toBeVisible();
  await dateButtons.first().click();
  const timeButtons = page.getByRole("button", { name: /^\d{2}:\d{2}$/ });
  await expect(timeButtons.first()).toBeVisible();
  await timeButtons.first().click();
}

for (const viewport of [
  { name: "desktop", width: 1512, height: 982 },
  { name: "mobile", width: 390, height: 844 },
] as const) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("a Suggestions-to-book inspiration card opens the real wizard on location and books a real appointment", async ({
      page,
    }, testInfo) => {
      const evidenceDir = resolve(testInfo.config.rootDir, EVIDENCE_SUBPATH);
      await mkdir(evidenceDir, { recursive: true });
      const consoleErrors = attachUnfilteredConsole(page);

      const { retailerId, customerId } = await resolveIdentity();
      const { id: branchId, name: branchName } = await seedPublishedBranch(
        retailerId,
        "Wizard Card Branch",
      );

      let appointmentId: string | null = null;
      try {
        await signIn(page);
        const response = await page.goto("/appointments", {
          waitUntil: "networkidle",
        });
        expect(response?.status()).toBe(200);
        await expect(
          page.getByRole("heading", { name: "My Appointments" }),
        ).toBeVisible();

        const requestedBefore = await page
          .getByText("Requested", { exact: true })
          .count();

        // A real inspiration card (§6: four chronological seasonal
        // suggestions) — not an already-booked record.
        const card = page.getByRole("button", {
          name: /Fall\/Winter Wardrobe Appointment/,
        });
        await expect(card).toBeVisible();
        await card.click();

        // Reason was preselected by the card — the wizard opens straight on
        // location, exactly like the Wardrobe prefill entry points.
        await expect(page.getByText("Book an appointment")).toBeVisible();
        await expect(
          page.getByText("Fall/Winter Wardrobe Appointment", { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole("button", { name: "A quick glance", exact: true }),
        ).not.toBeVisible();

        await page
          .getByRole("button", { name: branchName, exact: true })
          .click();
        await pickDateAndTime(page);

        // Review step: real branch + real reason, nothing fabricated.
        await expect(page.getByText(branchName)).toBeVisible();
        await expect(
          page.getByText("In the mood for something fresh"),
        ).toBeVisible();

        await page.screenshot({
          path: `${evidenceDir}/${viewport.name}-inspiration-review.png`,
          fullPage: true,
        });

        await page.getByRole("button", { name: "Confirm" }).click();

        await expect(page.getByText("Appointment requested")).toBeVisible();
        await expect(
          page.getByText("Your advisor will confirm the exact time."),
        ).toBeVisible();

        await expect
          .poll(async () => {
            const { data } = await admin()
              .from("appointments")
              .select(
                "id, type, status, notes, branch_id, customer_id, retailer_id",
              )
              .eq("customer_id", customerId)
              .eq("branch_id", branchId)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            return data;
          })
          .toEqual(
            expect.objectContaining({
              type: "personal_shopping",
              status: "requested",
              notes: "In the mood for something fresh",
              branch_id: branchId,
              customer_id: customerId,
              retailer_id: retailerId,
            }),
          );

        const { data: persisted } = await admin()
          .from("appointments")
          .select("id")
          .eq("customer_id", customerId)
          .eq("branch_id", branchId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        appointmentId = persisted!.id as string;

        await page.getByRole("button", { name: "Done" }).click();
        // The wizard closes back to the real, real-suggestion state — no
        // fabricated "booked" overlay left behind.
        await expect(
          page.getByRole("button", {
            name: /Fall\/Winter Wardrobe Appointment/,
          }),
        ).toBeVisible();

        // The freshly booked appointment is now visibly reflected — a real
        // "Requested" status badge appeared where there was none before.
        const reload = await page.goto("/appointments", {
          waitUntil: "networkidle",
        });
        expect(reload?.status()).toBe(200);
        const historyToggle = page.getByText(/^Appointment history/);
        if (await historyToggle.isVisible().catch(() => false)) {
          await historyToggle.click();
        }
        await expect
          .poll(() => page.getByText("Requested", { exact: true }).count())
          .toBeGreaterThan(requestedBefore);

        await page.screenshot({
          path: `${evidenceDir}/${viewport.name}-inspiration-booked.png`,
          fullPage: true,
        });

        expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
      } finally {
        if (appointmentId) await cleanupAppointment(appointmentId);
        await cleanupBranch(branchId);
      }
    });

    test("the plain Book appointment launcher runs the full reason -> location -> date -> time -> review -> confirmed wizard", async ({
      page,
    }, testInfo) => {
      const evidenceDir = resolve(testInfo.config.rootDir, EVIDENCE_SUBPATH);
      await mkdir(evidenceDir, { recursive: true });
      const consoleErrors = attachUnfilteredConsole(page);

      const { retailerId, customerId } = await resolveIdentity();
      const { id: branchId, name: branchName } = await seedPublishedBranch(
        retailerId,
        "Wizard Reason-First Branch",
      );

      let appointmentId: string | null = null;
      try {
        await signIn(page);
        const response = await page.goto("/appointments", {
          waitUntil: "networkidle",
        });
        expect(response?.status()).toBe(200);

        const launcher = page.getByRole("button", {
          name: "Book appointment",
          exact: true,
        });
        await expect(launcher).toBeVisible();
        await launcher.click();

        // Step 1 — reason. All four real §6 reason choices are present.
        await expect(page.getByText("Book an appointment")).toBeVisible();
        for (const label of [
          "In the mood for something fresh",
          "A quick glance",
          "Service — repair",
          "Service — size check",
        ]) {
          await expect(
            page.getByRole("button", { name: label, exact: true }),
          ).toBeVisible();
        }
        await page
          .getByRole("button", { name: "Service — repair", exact: true })
          .click();

        // Step 2 — location: real branches only.
        await expect(
          page.getByRole("button", { name: branchName, exact: true }),
        ).toBeVisible();
        await page
          .getByRole("button", { name: branchName, exact: true })
          .click();

        // Steps 3-4 — date, then real availability derived from the
        // branch's own opening hours.
        await pickDateAndTime(page);

        // Step 5 — review.
        await expect(page.getByText(branchName)).toBeVisible();
        await expect(page.getByText("Service — repair")).toBeVisible();

        await page.screenshot({
          path: `${evidenceDir}/${viewport.name}-reason-first-review.png`,
          fullPage: true,
        });

        await page.getByRole("button", { name: "Confirm" }).click();

        // Step 6 — confirmed, a real persisted appointment.
        await expect(page.getByText("Appointment requested")).toBeVisible();

        await expect
          .poll(async () => {
            const { data } = await admin()
              .from("appointments")
              .select(
                "id, type, status, notes, branch_id, customer_id, retailer_id",
              )
              .eq("customer_id", customerId)
              .eq("branch_id", branchId)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            return data;
          })
          .toEqual(
            expect.objectContaining({
              type: "alteration_fitting",
              status: "requested",
              notes: "Service — repair",
              branch_id: branchId,
              customer_id: customerId,
              retailer_id: retailerId,
            }),
          );

        const { data: persisted } = await admin()
          .from("appointments")
          .select("id")
          .eq("customer_id", customerId)
          .eq("branch_id", branchId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        appointmentId = persisted!.id as string;

        await page.getByRole("button", { name: "Done" }).click();
        await expect(
          page.getByRole("button", { name: "Book appointment", exact: true }),
        ).toBeVisible();

        await page.screenshot({
          path: `${evidenceDir}/${viewport.name}-reason-first-booked.png`,
          fullPage: true,
        });

        expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
      } finally {
        if (appointmentId) await cleanupAppointment(appointmentId);
        await cleanupBranch(branchId);
      }
    });
  });
}
