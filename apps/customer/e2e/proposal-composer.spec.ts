import { createSupabaseAdminClient } from "@paon/database";
import { expect, test, type Page } from "@playwright/test";

import {
  AUTH_DELIVERABLE_DOMAIN,
  TEST_CUSTOMER_EMAIL,
  TEST_RETAILER_SLUG,
} from "./fixtures";

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

/**
 * conversation_proposals.created_by_staff_id is a real FK to
 * retailer_staff_members — a dummy UUID violates the constraint. Tests that
 * seed a proposal directly (skipping the compose UI) need one genuine,
 * reusable staff row rather than minting a fresh user per run.
 */
async function findOrCreateFixtureStaffId(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  retailerId: string,
): Promise<string> {
  const email = `proposal-fixture-staff@${AUTH_DELIVERABLE_DOMAIN}`;
  const { data: existing } = await admin
    .from("retailer_staff_members")
    .select("id")
    .eq("retailer_id", retailerId)
    .eq("email", email)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: user } = await admin.auth.admin.createUser({
    email,
    password: "TestPassword123!",
    email_confirm: true,
  });
  if (!user?.user) throw new Error("failed to create fixture staff user");

  const { data: staff, error } = await admin
    .from("retailer_staff_members")
    .insert({
      retailer_id: retailerId,
      user_id: user.user.id,
      email,
      role: "owner",
      full_name: "Proposal Fixture Staff",
      accepted_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !staff)
    throw error ?? new Error("failed to create fixture staff");
  return staff.id;
}

test("FT-09: retailer creates proposal and customer accepts it", async ({
  page,
  browser,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Proposal composer test requires local Supabase.");
  }
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  // Setup: find or create retailer and customer
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

  // Reuse or create conversation
  const { data: existingConversation } = await admin
    .from("conversations")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("customer_id", customer.id)
    .maybeSingle();

  const conversation =
    existingConversation ??
    (
      await admin
        .from("conversations")
        .insert({
          retailer_id: retailer.id,
          customer_id: customer.id,
          intent: "style_help",
        })
        .select("id")
        .single()
    ).data;
  if (!conversation) throw new Error("failed to create conversation");

  // Insert initial message
  await admin.from("messages").insert({
    conversation_id: conversation.id,
    sender_type: "customer",
    sender_user_id: customer.user_id,
    body: "I need help finding the perfect dress for a wedding",
  });

  // STEP 1: Retailer owner logs in and creates a proposal
  // Create a temporary retailer owner user for this test
  const ownerEmail = `owner-${Date.now()}@${AUTH_DELIVERABLE_DOMAIN}`;
  const { data: ownerAuth } = await admin.auth.admin.createUser({
    email: ownerEmail,
    password: "TestPassword123!",
    email_confirm: true,
  });
  if (!ownerAuth?.user) throw new Error("failed to create owner user");

  // Add the owner to the retailer
  const { error: staffError } = await admin
    .from("retailer_staff_members")
    .insert({
      retailer_id: retailer.id,
      user_id: ownerAuth.user.id,
      email: ownerEmail,
      role: "owner",
      full_name: "Test Owner",
      accepted_at: new Date().toISOString(),
    });
  if (staffError) throw staffError;

  // Sign in as retailer owner via magic link (admin page)
  const retailerBaseUrl = "http://localhost:3001"; // apps/retailer's own port
  await page.goto(`${retailerBaseUrl}/login`);
  await page.getByLabel("Email").fill(ownerEmail);
  await page.getByLabel("Password").fill("TestPassword123!");
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // Navigate to messages
  await page.goto(`${retailerBaseUrl}/messages?c=${conversation.id}`);

  // The composer form renders unconditionally whenever the conversation has
  // no active proposal yet — there is no reveal/toggle button to click.
  await expect(page.getByLabel("Title", { exact: true })).toBeVisible();

  // Fill in proposal details
  await page.getByLabel("Title", { exact: true }).fill("Wedding Collection");
  await page
    .getByLabel("Advisor note")
    .fill(
      "I selected these pieces based on your style preferences and the formality level you mentioned.",
    );

  // Add an item
  const itemLabels = page.locator(
    'input[placeholder="Label (e.g. White dress shirt)"]',
  );
  await itemLabels.first().fill("Formal evening gown in navy");
  const itemDescriptions = page.locator(
    'input[placeholder="Description (optional)"]',
  );
  await itemDescriptions.first().fill("Floor-length with elegant draping");

  // Set price
  await page.getByLabel("Price amount (optional)").fill("450.00");
  await page.getByLabel("Currency (optional)").fill("USD");

  // Check appointment offered
  await page.getByLabel("Appointment offered").check();

  // Set expiry: DateTimePicker is a composite day/time radiogroup control,
  // not a plain input — same interaction pattern
  // apps/customer/e2e/appointments-alterations.spec.ts already uses.
  const expiryPicker = page.locator('[data-datetime-field="expiresAt"]');
  await expiryPicker
    .getByRole("radiogroup", { name: "Expires at — day" })
    .getByRole("radio")
    .nth(2)
    .click();
  await expiryPicker
    .getByRole("radiogroup", { name: "Expires at — time" })
    .getByRole("radio", { name: "14:00", exact: true })
    .click();
  await expect(expiryPicker).not.toHaveAttribute("data-datetime-value", "");

  // Submit proposal
  await page.getByRole("button", { name: "Create proposal" }).click();

  // Verify proposal appears in retailer view
  await expect(page.getByText("Wedding Collection")).toBeVisible();
  await expect(page.getByText("active")).toBeVisible();

  // STEP 2: Customer opens a second browser context and logs in
  const context = await browser.newContext();
  const customerPage = await context.newPage();

  // Sign in as customer
  await signInCustomer(customerPage, admin, TEST_CUSTOMER_EMAIL);

  // Navigate to conversation
  const customerBaseUrl = "http://localhost:3002"; // apps/customer's own port
  await customerPage.goto(`${customerBaseUrl}/messages/${conversation.id}`);

  // Verify proposal is visible
  await expect(customerPage.getByText("Wedding Collection")).toBeVisible();
  await expect(
    customerPage.getByText("Formal evening gown in navy"),
  ).toBeVisible();
  await expect(customerPage.getByText(/\$450\.00/)).toBeVisible();

  // STEP 3: Customer accepts the proposal
  const acceptButton = customerPage.getByRole("button", { name: "Accept" });
  await expect(acceptButton).toBeVisible();
  await acceptButton.click();

  // Wait for revalidation and verify status changed
  await expect(customerPage.getByText("accepted")).toBeVisible({
    timeout: 5000,
  });

  // STEP 4: Verify in database that proposal was accepted
  const { data: proposal } = await admin
    .from("conversation_proposals")
    .select("id, status, response")
    .eq("conversation_id", conversation.id)
    .eq("title", "Wedding Collection")
    .single();

  expect(proposal).toBeDefined();
  expect(proposal?.status).toBe("active"); // Status stays active; response field tracks customer's choice
  expect(proposal?.response).toBe("accepted");

  // Cleanup
  await context.close();
  await admin.auth.admin.deleteUser(ownerAuth.user.id);
});

test("FT-09: customer declines a proposal", async ({ page }) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Proposal composer test requires local Supabase.");
  }
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  // Setup fixture data
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

  const { data: existingConversation } = await admin
    .from("conversations")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("customer_id", customer.id)
    .maybeSingle();

  const conversation =
    existingConversation ??
    (
      await admin
        .from("conversations")
        .insert({
          retailer_id: retailer.id,
          customer_id: customer.id,
          intent: "style_help",
        })
        .select("id")
        .single()
    ).data;
  if (!conversation) throw new Error("failed to create conversation");

  const staffId = await findOrCreateFixtureStaffId(admin, retailer.id);

  // Create a proposal directly via DB (skip the compose UI for this test)
  const { data: proposal } = await admin
    .from("conversation_proposals")
    .insert({
      conversation_id: conversation.id,
      retailer_id: retailer.id,
      created_by_staff_id: staffId,
      version: 1,
      status: "active",
      title: "Alternative Look",
      advisor_note: "This is another option to consider",
      items: [{ label: "Casual dress" }],
      alternatives: [],
      appointment_offered: false,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();
  if (!proposal) throw new Error("failed to create proposal");

  // Customer signs in and views proposal
  await signInCustomer(page, admin, TEST_CUSTOMER_EMAIL);
  const customerBaseUrl = "http://localhost:3002"; // apps/customer's own port
  await page.goto(`${customerBaseUrl}/messages/${conversation.id}`);

  // Verify proposal is visible
  await expect(page.getByText("Alternative Look")).toBeVisible();

  // Click decline
  const declineButton = page.getByRole("button", { name: "Decline" });
  await expect(declineButton).toBeVisible();
  await declineButton.click();

  // Verify status changed to declined
  await expect(page.getByText("declined")).toBeVisible({ timeout: 5000 });

  // Verify in DB
  const { data: updatedProposal } = await admin
    .from("conversation_proposals")
    .select("status, response")
    .eq("id", proposal.id)
    .single();

  expect(updatedProposal?.response).toBe("declined");
});

test("FT-09: expired proposal cannot be responded to", async ({ page }) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Proposal composer test requires local Supabase.");
  }
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

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

  const { data: existingConversation } = await admin
    .from("conversations")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("customer_id", customer.id)
    .maybeSingle();

  const conversation =
    existingConversation ??
    (
      await admin
        .from("conversations")
        .insert({
          retailer_id: retailer.id,
          customer_id: customer.id,
          intent: "style_help",
        })
        .select("id")
        .single()
    ).data;
  if (!conversation) throw new Error("failed to create conversation");

  const staffId = await findOrCreateFixtureStaffId(admin, retailer.id);

  // Create an expired proposal
  const { data: expiredProposal } = await admin
    .from("conversation_proposals")
    .insert({
      conversation_id: conversation.id,
      retailer_id: retailer.id,
      created_by_staff_id: staffId,
      version: 1,
      status: "active",
      title: "Expired Offer",
      advisor_note: "This proposal has already expired",
      items: [{ label: "Item 1" }],
      alternatives: [],
      appointment_offered: false,
      expires_at: new Date(Date.now() - 1000).toISOString(), // Expired 1 second ago
    })
    .select("id")
    .single();
  if (!expiredProposal) throw new Error("failed to create expired proposal");

  // Customer signs in and views the expired proposal
  await signInCustomer(page, admin, TEST_CUSTOMER_EMAIL);
  const customerBaseUrl = "http://localhost:3002"; // apps/customer's own port
  await page.goto(`${customerBaseUrl}/messages/${conversation.id}`);

  // Verify proposal is visible with expired message instead of buttons
  await expect(page.getByText("Expired Offer")).toBeVisible();
  await expect(page.getByText("This offer has expired")).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept" })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Decline" })).not.toBeVisible();
});
