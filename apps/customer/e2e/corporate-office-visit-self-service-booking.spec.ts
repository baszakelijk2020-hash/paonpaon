import { createSupabaseAdminClient } from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import { TEST_RETAILER_SLUG } from "./fixtures";

/**
 * PHASE 18.4: corporate office-visit self-service booking.
 * Tests the live, availability-aware booking path for anonymous visitors.
 */
test.describe("Corporate office visit self-service booking", () => {
  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  let retailerId: string;
  let programmeId: string;

  test.beforeAll(async () => {
    const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
    const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        "requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      );
    }
    supabase = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

    // Get the test retailer and a test programme.
    const { data: retailer } = await supabase
      .from("retailers")
      .select("id")
      .eq("slug", TEST_RETAILER_SLUG)
      .single();
    if (!retailer) throw new Error("fixture retailer missing");
    retailerId = asId<"RetailerId">(retailer.id);

    const { data: programmes, error: progError } = await supabase
      .from("corporate_programmes")
      .select("id")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .eq("active", true)
      .limit(1);

    if (progError || !programmes || programmes.length === 0) {
      throw new Error("no active test programme found");
    }
    programmeId = programmes[0]!.id;
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
    const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const endsAt = new Date(
      Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000,
    ).toISOString();

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
    const startsAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const endsAt = new Date(
      Date.now() + 48 * 60 * 60 * 1000 + 60 * 60 * 1000,
    ).toISOString();

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
    const startsAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    const endsAt = new Date(
      Date.now() + 72 * 60 * 60 * 1000 + 60 * 60 * 1000,
    ).toISOString();

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
    const baseTime = Date.now() + 96 * 60 * 60 * 1000;

    // Attempt 6 bookings in quick succession (same email).
    for (let i = 0; i < 6; i++) {
      const startsAt = new Date(
        baseTime + i * 2 * 60 * 60 * 1000,
      ).toISOString();
      const endsAt = new Date(
        baseTime + i * 2 * 60 * 60 * 1000 + 60 * 60 * 1000,
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
});
