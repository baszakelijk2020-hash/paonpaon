import { CorporateRepository, createSupabaseAdminClient } from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import { TEST_RETAILER_SLUG } from "./fixtures";

/**
 * PHASE 18.4: corporate office-visit self-service booking.
 * Tests the live, availability-aware booking path for anonymous visitors.
 */
test.describe("Corporate office visit self-service booking", () => {
  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  let retailerId: ReturnType<typeof asId<"RetailerId">>;
  let accountId: string;
  let programmeId: string;
  let availabilityWindowId: string | undefined;
  // Every booking in this file lands on WINDOW_DOW at an hour inside
  // [WINDOW_START_HOUR, WINDOW_END_HOUR) so it falls inside the single
  // availability window created in beforeAll below (the RPC now validates
  // requested times against real availability windows, not just against
  // other appointments — see submit_corporate_office_visit_booking).
  const WINDOW_DOW = 2; // Tuesday
  const WINDOW_START_HOUR = 9;
  const WINDOW_END_HOUR = 20;
  // Re-running this spec against a persistent (non-reset) local DB would
  // otherwise collide with a previous run's still-present appointment rows
  // for the same retailer — spread runs across a wide, run-specific day
  // bucket so repeated runs never contend for the same time window.
  let runOffsetMs: number;

  /** The next WINDOW_DOW at hourUtc:00 UTC, at or after "now" + runOffsetMs. */
  function bookingSlot(hourUtc: number): Date {
    let d = new Date(Date.now() + runOffsetMs);
    d.setUTCHours(hourUtc, 0, 0, 0);
    while (d.getUTCDay() !== WINDOW_DOW || d.getTime() < Date.now()) {
      d = new Date(d.getTime() + 24 * 60 * 60 * 1000);
      d.setUTCHours(hourUtc, 0, 0, 0);
    }
    return d;
  }

  test.beforeAll(async () => {
    const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
    const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        "requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      );
    }
    supabase = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
    runOffsetMs = (1000 + (Date.now() % 5000)) * 24 * 60 * 60 * 1000;

    // Get the test retailer, then self-provision an active account + programme
    // (mirrors corporate-office-visit.spec.ts — no pre-seeded programme exists).
    const { data: retailer } = await supabase
      .from("retailers")
      .select("id")
      .eq("slug", TEST_RETAILER_SLUG)
      .single();
    if (!retailer) throw new Error("fixture retailer missing");
    retailerId = asId<"RetailerId">(retailer.id);

    const unique = Date.now();
    const repo = new CorporateRepository(supabase);
    const account = await repo.createAccount(retailerId, {
      legalName: `Customer e2e Self-Service Booking Co ${unique}`,
      accountReference: `E2E-SSB-${unique}`,
    });
    const programme = await repo.createProgramme(retailerId, {
      accountId: account.id,
      name: `Customer e2e Self-Service Booking Programme ${unique}`,
      siteKeys: [],
    });
    accountId = account.id;
    programmeId = programme.id;

    // The availability RPC now enforces real business hours — give the
    // fixture retailer one real window to book into.
    const { data: staff } = await supabase
      .from("retailer_staff_members")
      .select("id")
      .eq("retailer_id", retailerId)
      .limit(1)
      .single();
    if (!staff) throw new Error("fixture retailer has no staff member");
    const { data: window } = await supabase
      .from("availability_windows")
      .insert({
        retailer_id: retailerId,
        staff_id: staff.id,
        day_of_week: WINDOW_DOW,
        start_time: `${String(WINDOW_START_HOUR).padStart(2, "0")}:00`,
        end_time: `${String(WINDOW_END_HOUR).padStart(2, "0")}:00`,
      })
      .select("id")
      .single();
    availabilityWindowId = window?.id;
  });

  test.afterAll(async () => {
    if (accountId) {
      await supabase.from("corporate_accounts").delete().eq("id", accountId);
    }
    if (availabilityWindowId) {
      await supabase
        .from("availability_windows")
        .delete()
        .eq("id", availabilityWindowId);
    }
  });

  test("anonymous visitor can fetch available appointment slots", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)(
      "get_corporate_office_visit_availability_context",
      {
        p_programme_id: programmeId,
      },
    );

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data).toHaveProperty("windows");
    expect(data).toHaveProperty("appointments");
    expect(Array.isArray(data?.windows)).toBe(true);
    expect(Array.isArray(data?.appointments)).toBe(true);
  });

  test("anonymous visitor can book an appointment via self-service", async () => {
    const testEmail = `visitor-${Date.now()}@paon.test`;
    const testName = "Test Visitor";
    const slot = bookingSlot(10);
    const startsAt = slot.toISOString();
    const endsAt = new Date(slot.getTime() + 60 * 60 * 1000).toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: appointmentId, error } = await (supabase.rpc as any)(
      "submit_corporate_office_visit_booking",
      {
        p_programme_id: programmeId,
        p_requester_name: testName,
        p_employee_reference: "",
        p_contact_email: testEmail,
        p_starts_at: startsAt,
        p_ends_at: endsAt,
      },
    );

    expect(error).toBeNull();
    expect(appointmentId).toBeDefined();

    // Verify that the appointment was created.
    const { data: appointment, error: appointError } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", appointmentId)
      .single();

    expect(appointError).toBeNull();
    expect(appointment).toBeDefined();
    expect(appointment?.type).toBe("styling_consultation");
    expect(appointment?.status).toBe("requested");
    expect(appointment?.retailer_id).toBe(retailerId);

    // Verify that a customer row was created.
    const { data: customer, error: custError } = await supabase
      .from("customers")
      .select("*")
      .eq("email", testEmail)
      .eq("retailer_id", retailerId)
      .single();

    expect(custError).toBeNull();
    expect(customer).toBeDefined();
    expect(customer?.full_name).toBe(testName);
    expect(customer?.lifecycle_stage).toBe("prospect");
    expect(customer?.acquisition_source).toBe("corporate_office_visit");

    // Verify that the corporate_office_visit_requests row was created.
    const { data: request, error: reqError } = await supabase
      .from("corporate_office_visit_requests")
      .select("*")
      .eq("programme_id", programmeId)
      .eq("contact_email", testEmail)
      .single();

    expect(reqError).toBeNull();
    expect(request).toBeDefined();
    expect(request?.status).toBe("scheduled");
    expect(request?.customer_id).toBe(customer?.id);
    expect(request?.appointment_id).toBe(appointmentId);
    expect(request?.resolved_at).toBeDefined();
  });

  test("double-booking the same slot is rejected", async () => {
    const slot = bookingSlot(11);
    const startsAt = slot.toISOString();
    const endsAt = new Date(slot.getTime() + 60 * 60 * 1000).toISOString();

    // First booking succeeds.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: firstId, error: firstError } = await (supabase.rpc as any)(
      "submit_corporate_office_visit_booking",
      {
        p_programme_id: programmeId,
        p_requester_name: "First Visitor",
        p_employee_reference: "",
        p_contact_email: `first-${Date.now()}@paon.test`,
        p_starts_at: startsAt,
        p_ends_at: endsAt,
      },
    );

    expect(firstError).toBeNull();
    expect(firstId).toBeDefined();

    // Second booking at the exact same time should fail (race condition check).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: secondId, error: secondError } = await (supabase.rpc as any)(
      "submit_corporate_office_visit_booking",
      {
        p_programme_id: programmeId,
        p_requester_name: "Second Visitor",
        p_employee_reference: "",
        p_contact_email: `second-${Date.now()}@paon.test`,
        p_starts_at: startsAt,
        p_ends_at: endsAt,
      },
    );

    expect(secondError).toBeDefined();
    expect(secondError?.message).toContain("no longer available");
    expect(secondId).toBeNull();
  });

  test("appointments are retailer-scoped (no cross-retailer contamination)", async () => {
    // Get or create a second retailer/programme for testing (simplified for now —
    // just reuse the same programme but verify scoping works).
    const testEmail = `scope-test-${Date.now()}@paon.test`;
    const slot = bookingSlot(12);
    const startsAt = slot.toISOString();
    const endsAt = new Date(slot.getTime() + 60 * 60 * 1000).toISOString();

    // Book on the test programme.
    const { data: appointmentId, error: bookError } =
      await // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.rpc as any)("submit_corporate_office_visit_booking", {
        p_programme_id: programmeId,
        p_requester_name: "Visitor A",
        p_employee_reference: "",
        p_contact_email: testEmail,
        p_starts_at: startsAt,
        p_ends_at: endsAt,
      });

    expect(bookError).toBeNull();
    expect(appointmentId).toBeDefined();

    // Verify the appointment is scoped to the test retailer.
    const { data: appointment, error: aptError } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", appointmentId!)
      .single();

    expect(aptError).toBeNull();
    expect(appointment?.retailer_id).toBe(retailerId);

    // Verify the request is scoped to the test programme.
    const { data: request, error: reqError } = await supabase
      .from("corporate_office_visit_requests")
      .select("*")
      .eq("contact_email", testEmail)
      .eq("programme_id", programmeId)
      .single();

    expect(reqError).toBeNull();
    expect(request?.programme_id).toBe(programmeId);
    expect(request?.retailer_id).toBe(retailerId);
  });

  test("rate limiting prevents more than 5 bookings in 10 minutes per email", async () => {
    const testEmail = `ratelimit-${Date.now()}@paon.test`;
    // 6 back-to-back 1-hour slots starting at 13:00 UTC end at 19:00 UTC,
    // still inside the 09:00-20:00 window.
    const baseTime = bookingSlot(13).getTime();

    // Attempt 6 bookings in quick succession (same email).
    for (let i = 0; i < 6; i++) {
      const startsAt = new Date(baseTime + i * 60 * 60 * 1000).toISOString();
      const endsAt = new Date(
        baseTime + i * 60 * 60 * 1000 + 60 * 60 * 1000,
      ).toISOString();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)(
        "submit_corporate_office_visit_booking",
        {
          p_programme_id: programmeId,
          p_requester_name: `Visitor ${i}`,
          p_employee_reference: "",
          p_contact_email: testEmail,
          p_starts_at: startsAt,
          p_ends_at: endsAt,
        },
      );

      if (i < 5) {
        // First 5 should succeed.
        expect(error).toBeNull();
        expect(data).toBeDefined();
      } else {
        // 6th should be rate-limited.
        expect(error).toBeDefined();
        expect(error?.message).toContain("wait a moment");
      }
    }
  });

  test("booking outside the retailer's availability window is rejected", async () => {
    // 03:00 UTC on the same WINDOW_DOW the fixture window covers, but well
    // outside its 09:00-20:00 span — the RPC must reject this even though
    // it doesn't overlap any existing appointment.
    const slot = bookingSlot(3);
    const startsAt = slot.toISOString();
    const endsAt = new Date(slot.getTime() + 60 * 60 * 1000).toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)(
      "submit_corporate_office_visit_booking",
      {
        p_programme_id: programmeId,
        p_requester_name: "Out Of Hours Visitor",
        p_employee_reference: "",
        p_contact_email: `out-of-hours-${Date.now()}@paon.test`,
        p_starts_at: startsAt,
        p_ends_at: endsAt,
      },
    );

    expect(error).toBeDefined();
    expect(error?.message).toContain("available hours");
    expect(data).toBeNull();
  });
});
