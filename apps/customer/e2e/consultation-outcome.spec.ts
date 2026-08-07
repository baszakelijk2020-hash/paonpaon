import { createSupabaseAdminClient } from "@paon/database";
import { expect, test, type Page } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

async function signInCustomer(
  page: Page,
  admin: ReturnType<typeof createSupabaseAdminClient>,
  email: string,
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (error || !data.properties) {
      throw error ?? new Error("magic link missing");
    }
    await page.goto(
      `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`,
    );
    const hasAuthCookie = (await page.context().cookies()).some(
      (cookie) =>
        cookie.name.startsWith("sb-") &&
        cookie.name.includes("auth-token") &&
        !cookie.name.includes("code-verifier"),
    );
    if (/\/dashboard$/.test(page.url()) && hasAuthCookie) {
      return;
    }
  }
  throw new Error(`customer sign-in did not complete: ${page.url()}`);
}

test("FT-09: customer books appointment from conversation thread via UI", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Consultation outcome test requires local Supabase.");
  }
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  // Setup: create retailer, customer, and message thread
  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");

  const { data: customer } = await admin
    .from("customers")
    .select("id, user_id")
    .eq("retailer_id", retailer.id)
    .eq("email", TEST_CUSTOMER_EMAIL)
    .single();
  if (!customer) throw new Error("fixture customer missing");

  // Create a real conversation and message
  const { data: conversation } = await admin
    .from("conversations")
    .insert({
      retailer_id: retailer.id,
      customer_id: customer.id,
      intent: "style_help",
    })
    .select("id")
    .single();
  if (!conversation) throw new Error("failed to create conversation");

  await admin.from("messages").insert({
    conversation_id: conversation.id,
    sender_type: "customer",
    sender_user_id: customer.user_id,
    body: "I need help finding the right style for work",
  });

  // STEP 1: Customer signs in and navigates to messages thread
  await signInCustomer(page, admin, TEST_CUSTOMER_EMAIL);
  await page.goto(`/messages/${conversation.id}`);

  // Verify message is visible
  await expect(
    page.getByText("I need help finding the right style for work"),
  ).toBeVisible();

  // STEP 2: Customer clicks "Book an appointment" and fills form
  await page.getByRole("button", { name: /Book an appointment/i }).click();

  // Set appointment details
  await page.getByLabel("Appointment type").selectOption("consultation");

  // Set start time to now + 1 hour
  const now = new Date();
  const startTime = new Date(now.getTime() + 3600000);
  const endTime = new Date(startTime.getTime() + 3600000);

  // Format as datetime-local (YYYY-MM-DDTHH:mm)
  const formatDateTime = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  await page.getByLabel("Start time").fill(formatDateTime(startTime));
  await page.getByLabel("End time").fill(formatDateTime(endTime));
  await page
    .getByLabel(/Notes \(optional\)/)
    .fill("Consultation from message thread about work style");

  // STEP 3: Submit the form
  await page.getByRole("button", { name: "Book Appointment" }).click();

  // Verify success message shows appointment ID
  const successMessage = page.getByText(/Appointment created!/);
  await expect(successMessage).toBeVisible();

  // Extract appointment ID from success message
  const messageText = await successMessage.textContent();
  const appointmentIdMatch = messageText?.match(/ID: ([a-f0-9-]{36})/);
  const appointmentId = appointmentIdMatch?.[1];
  expect(appointmentId).toBeTruthy();

  // STEP 4: Verify appointment was created in database with correct origin
  const { data: appointment } = await admin
    .from("appointments")
    .select("id, origin_message_thread_id, status, type, customer_id")
    .eq("id", appointmentId!)
    .single();

  expect(appointment).toBeDefined();
  expect(appointment?.origin_message_thread_id).toBe(conversation.id);
  expect(appointment?.type).toBe("consultation");
  expect(appointment?.status).toBe("requested");
  expect(appointment?.customer_id).toBe(customer.id);
});

test("FT-09: unauthorized customer cannot book appointment for other customer's thread", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Consultation outcome test requires local Supabase.");
  }
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  // Setup: create two customers and a conversation for customer1
  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");

  const { data: customer1 } = await admin
    .from("customers")
    .select("id, user_id")
    .eq("retailer_id", retailer.id)
    .eq("email", TEST_CUSTOMER_EMAIL)
    .single();
  if (!customer1) throw new Error("fixture customer1 missing");

  // Create a second customer for this test
  const { data: customer2 } = await admin.auth.admin.createUser({
    email: `test-customer-2-${Date.now()}@example.com`,
    password: "TestPassword123!",
    email_confirm: true,
  });
  if (!customer2?.user) throw new Error("failed to create customer2");
  const customer2User = customer2.user;

  const { data: customer2Record } = await admin
    .from("customers")
    .insert({
      retailer_id: retailer.id,
      user_id: customer2User.id,
      email: customer2User.email ?? null,
      full_name: "Test Customer 2",
    })
    .select("id")
    .single();
  if (!customer2Record) throw new Error("failed to create customer2 record");

  // Create a conversation for customer1
  const { data: conversation } = await admin
    .from("conversations")
    .insert({
      retailer_id: retailer.id,
      customer_id: customer1.id,
      intent: "style_help",
    })
    .select("id")
    .single();
  if (!conversation) throw new Error("failed to create conversation");

  // Sign in as customer2 (different customer)
  await signInCustomer(page, admin, customer2User.email!);

  // Try to navigate to customer1's conversation
  // The page should reject access or the RPC should fail
  await page.goto(`/messages/${conversation.id}`);

  // The page should not find the conversation (404 or redirect)
  const isNotFound =
    page.url().includes("404") ||
    (await page
      .getByText(/not found|no access/i)
      .isVisible()
      .catch(() => false));

  if (!isNotFound) {
    // If page loaded, try to book an appointment
    // The Server Action should reject it
    const bookButton = await page
      .getByRole("button", { name: /Book an appointment/i })
      .isVisible()
      .catch(() => false);

    if (bookButton) {
      await page.getByRole("button", { name: /Book an appointment/i }).click();
      await page.getByLabel("Appointment type").selectOption("consultation");

      const now = new Date();
      const startTime = new Date(now.getTime() + 3600000);
      const endTime = new Date(startTime.getTime() + 3600000);

      const formatDateTime = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const hours = String(d.getHours()).padStart(2, "0");
        const minutes = String(d.getMinutes()).padStart(2, "0");
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      };

      await page.getByLabel("Start time").fill(formatDateTime(startTime));
      await page.getByLabel("End time").fill(formatDateTime(endTime));
      await page.getByRole("button", { name: "Book Appointment" }).click();

      // Should show error
      const errorText = await page.getByText(/error|not authorized/i);
      await expect(errorText).toBeVisible();
    }
  }

  // Cleanup
  await admin.auth.admin.deleteUser(customer2.user.id);
});
