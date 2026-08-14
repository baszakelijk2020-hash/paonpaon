import {
  AppointmentRepository,
  CustomerRepository,
  StaffRosterRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import { asId, findMostUnderstaffedDay } from "@paon/domain";
import { expect, test } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "14.2";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/staffing-risk-insight.spec.ts";
const WINDOW_DAYS = 90;

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

let proofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: proofPassed ? "passed" : "failed",
  });
});

function timeStringToHours(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) + (minutes ?? 0) / 60;
}

/**
 * Proves the `staffing_risk` cited-intelligence projector (PHASE 14.2) end
 * to end. Unlike `fit_risk`'s free-text area names, the bucket key here
 * (day of week) is a small, shared, unavoidably-diluted space — any
 * historical appointment/shift on this shared fixture retailer already
 * contributes to one of only 7 buckets. Rather than guessing a "safe" day
 * or hoping for no collision, this test queries the retailer's REAL
 * existing appointments/shifts in the same 90-day window
 * `computeStaffingRisk` itself uses, injects a deliberately overwhelming
 * (30 appointments : 1 staff-hour) skew on one day, and independently
 * recomputes the true expected winner via the SAME pure
 * `findMostUnderstaffedDay` function the repository calls — a genuine
 * second computation over real state, not a hardcoded guess.
 */
test("staffing_risk projector finds the most understaffed day and cites it", async ({
  page,
}) => {
  test.setTimeout(180_000);

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

  const { data: staffMember } = await admin
    .from("retailer_staff_members")
    .select("id")
    .eq("retailer_id", retailerId)
    .eq("email", TEST_OWNER_EMAIL)
    .single();
  if (!staffMember) throw new Error("fixture owner staff row missing");
  const staffId = asId<"StaffId">(staffMember.id);

  const customerRepo = new CustomerRepository(admin);
  const unique = Date.now();
  const customer = await customerRepo.create({
    retailerId,
    fullName: `E2E Staffing Risk Customer ${unique}`,
    email: `staffing-risk-${unique}@paon.test`,
    lifecycleStage: "prospect",
  });

  const appointmentRepo = new AppointmentRepository(admin);
  const rosterRepo = new StaffRosterRepository(admin);

  const now = new Date();
  const from = new Date(now.getTime() - WINDOW_DAYS * 86_400_000);

  // 1. Real existing state in the same window the projector reads.
  const existingAppointments = (
    await appointmentRepo.findByRetailer(retailerId)
  ).filter((appointment) => {
    if (appointment.status === "canceled" || appointment.status === "no_show") {
      return false;
    }
    const startsAt = Date.parse(appointment.startsAt);
    return startsAt >= from.getTime() && startsAt <= now.getTime();
  });
  const existingShifts = await rosterRepo.findShiftsByRetailer(retailerId, {
    from: from.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  });

  const appointmentCountByDay = new Map<number, number>();
  for (const appointment of existingAppointments) {
    const day = new Date(appointment.startsAt).getUTCDay();
    appointmentCountByDay.set(day, (appointmentCountByDay.get(day) ?? 0) + 1);
  }
  const staffHoursByDay = new Map<number, number>();
  for (const shift of existingShifts) {
    const day = new Date(`${shift.shiftDate}T00:00:00Z`).getUTCDay();
    const hours =
      timeStringToHours(shift.endTime) - timeStringToHours(shift.startTime);
    staffHoursByDay.set(day, (staffHoursByDay.get(day) ?? 0) + hours);
  }

  // 2. Inject an overwhelming, deliberately finite (not Infinity, to avoid
  // ties against any real existing zero-staff-hours day) skew: 30
  // appointments against 1 scheduled staff-hour on one target day.
  const targetDate = new Date(now.getTime() - 3 * 86_400_000);
  const targetDayOfWeek = targetDate.getUTCDay();
  const targetDateStr = targetDate.toISOString().slice(0, 10);

  const appointmentIds: string[] = [];
  for (let i = 0; i < 30; i += 1) {
    const startsAt = new Date(targetDate);
    startsAt.setUTCHours(9 + (i % 8), (i * 7) % 60, 0, 0);
    const endsAt = new Date(startsAt.getTime() + 30 * 60_000);
    const appointment = await appointmentRepo.create({
      retailerId,
      customerId: customer.id,
      type: "styling_consultation",
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    });
    appointmentIds.push(appointment.id);
  }
  const shift = await rosterRepo.createShift({
    retailerId,
    staffId,
    shiftDate: targetDateStr,
    startTime: "09:00:00",
    endTime: "10:00:00",
  });

  // 3. Independently recompute the true expected winner from real
  // existing state + injected data, using the same pure function.
  const expectedDays = [
    ...new Set([
      ...appointmentCountByDay.keys(),
      ...staffHoursByDay.keys(),
      targetDayOfWeek,
    ]),
  ].map((dayOfWeek) => {
    const injectedAppointments = dayOfWeek === targetDayOfWeek ? 30 : 0;
    const injectedHours = dayOfWeek === targetDayOfWeek ? 1 : 0;
    return {
      dayOfWeek,
      appointmentCount:
        (appointmentCountByDay.get(dayOfWeek) ?? 0) + injectedAppointments,
      staffHours: (staffHoursByDay.get(dayOfWeek) ?? 0) + injectedHours,
    };
  });
  const expected = findMostUnderstaffedDay(expectedDays);
  if (!expected)
    throw new Error("expected a winning day given the injected skew");

  try {
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
    await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
    await page.getByRole("button", { name: "Enter the atelier" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/analytics");

    let recomputed = false;
    for (let attempt = 0; attempt < 3 && !recomputed; attempt += 1) {
      await page
        .locator('[data-cited-insights="staffing_risk"]')
        .getByRole("button", { name: "Recompute" })
        .click();
      try {
        await expect(
          page.getByText("Recomputed from appointments and the staff roster."),
        ).toBeVisible({ timeout: 15_000 });
        recomputed = true;
      } catch {
        // fall through to retry
      }
    }
    expect(recomputed).toBe(true);

    const card = page.locator('[data-cited-insights="staffing_risk"]');
    await expect(
      card.getByText(new RegExp(`${DAY_NAMES[expected.dayOfWeek]}s`, "i")),
    ).toBeVisible();

    const { data: liveRows } = await admin
      .from("cited_recommendations")
      .select("id, kind, statement, sample_size, confidence, withdrawn_at")
      .eq("retailer_id", retailerId)
      .eq("kind", "staffing_risk")
      .is("withdrawn_at", null);
    expect(liveRows).toHaveLength(1);
    const row = liveRows![0]!;
    expect(row.sample_size).toBe(expected.appointmentCount);
    expect(row.statement).toContain(`${DAY_NAMES[expected.dayOfWeek]}s`);

    proofPassed = true;
  } finally {
    await admin
      .from("cited_recommendations")
      .delete()
      .eq("retailer_id", retailerId)
      .eq("kind", "staffing_risk");
    await admin.from("appointments").delete().in("id", appointmentIds);
    await admin.from("staff_shifts").delete().eq("id", shift.id);
    await admin.from("customers").delete().eq("id", customer.id);
  }
});
