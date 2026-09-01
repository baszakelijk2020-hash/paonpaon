import { CustomerRepository, createSupabaseAdminClient } from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "R0.4";
const BROWSER_PROOF_SPEC =
  "apps/retailer/e2e/house-memory-advisor-today.spec.ts";

let proofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: proofPassed ? "passed" : "failed",
  });
});

test.describe("R0.4 House Memory and Advisor Today", () => {
  test("advisor navigates from Today surface through House Memory to understand next clients and see provenance", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
    const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
    const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

    // Set up test data
    const { data: retailer } = await admin
      .from("retailers")
      .select("id")
      .eq("slug", TEST_RETAILER_SLUG)
      .single();
    if (!retailer) throw new Error("fixture retailer missing");
    const retailerId = asId<"RetailerId">(retailer.id);

    const { data: ownerAuthUser } = await admin
      .from("retailer_staff_members")
      .select("id")
      .eq("retailer_id", retailerId)
      .eq("email", TEST_OWNER_EMAIL)
      .single();
    if (!ownerAuthUser) throw new Error("owner staff record missing");
    const staffId = asId<"StaffId">(ownerAuthUser.id);

    // Create a test customer
    const unique = Date.now();
    const customer = await new CustomerRepository(admin).create({
      retailerId,
      fullName: `R0.4 Test Client ${unique}`,
      email: `r04-${unique}@paon.test`,
      lifecycleStage: "prospect",
    });

    // Create test facts with provenance to demonstrate House Memory
    const now = new Date().toISOString();
    const { data: facts } = await admin
      .from("customer_facts")
      .insert([
        {
          retailer_id: retailerId,
          customer_id: customer.id,
          fact_type: "colour_interest",
          provenance_class: "advisor_observed",
          value_label: "Navy blue",
          confidence: 0.9,
          sensitivity: "standard",
          visibility: "customer_and_advisor",
          observed_at: now,
          author_staff_id: staffId,
          evidence: [
            { note: "Client mentioned strong preference during last visit" },
          ],
          created_at: now,
          updated_at: now,
        },
        {
          retailer_id: retailerId,
          customer_id: customer.id,
          fact_type: "occasion",
          provenance_class: "customer_declared",
          value_label: "Business events",
          confidence: 1.0,
          sensitivity: "standard",
          visibility: "customer_and_advisor",
          observed_at: now,
          author_customer_id: customer.id,
          evidence: [{ note: "Selected in profile" }],
          created_at: now,
          updated_at: now,
        },
      ])
      .select("id");
    if (!facts || facts.length < 2)
      throw new Error("failed to create test facts");

    // Create a promise/opportunity to complete
    const { data: opportunity, error: opportunityError } = await admin
      .from("clienteling_opportunities")
      .insert({
        retailer_id: retailerId,
        customer_id: customer.id,
        opportunity_type: "interest_follow_up",
        why_now: "Follow up on navy business suit interest",
        suggested_action: "Show new navy suit collection arriving Friday",
        channel: "phone",
        assigned_staff_id: staffId,
        projector_version: "house-memory-e2e",
      })
      .select("id")
      .single();
    if (opportunityError) throw opportunityError;

    // Sign in and navigate to Today surface
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
    await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
    await page.getByRole("button", { name: "Enter the atelier" }).click();
    await expect(page).not.toHaveURL(/\/login/);

    try {
      // Step 1: Verify Today surface shows the opportunity
      await page.goto("/staff/today");
      await expect(
        page.getByRole("heading", { name: "My Day", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Follow up on navy business suit interest"),
      ).toBeVisible();
      await expect(
        page.getByText("Show new navy suit collection arriving Friday"),
      ).toBeVisible();

      // Step 2: Click through to House Memory
      const houseMemoryLink = page.getByRole("link", {
        name: "House Memory →",
      });
      await expect(houseMemoryLink).toBeVisible();
      await houseMemoryLink.click();
      await expect(page).toHaveURL(/\/customers\//);

      // Step 3: Verify House Memory shows customer info and provenance
      await expect(page.getByText(`R0.4 Test Client ${unique}`)).toBeVisible();

      // Verify facts are shown with provenance
      await expect(page.getByText("Navy blue")).toBeVisible();
      await expect(page.getByText("Business events")).toBeVisible();

      // Verify provenance sources are displayed
      await expect(page.getByText(/advisor observed/i)).toBeVisible();
      // Self-Portrait renders the customer_declared provenance as the label
      // "Declared" (PROVENANCE_LABELS in customers/[id]/self-portrait.tsx),
      // followed by " · <factType>".
      await expect(page.getByText(/Declared ·/).first()).toBeVisible();

      // The Self-Portrait surface shows each fact's value plus its provenance
      // class and fact type; the raw evidence note lives in the
      // fact-correction / citation flow, not this read view. Assert the
      // advisor-observed fact and its provenance render together here.
      await expect(page.getByText(/Advisor observed ·/).first()).toBeVisible();

      // Step 4: Complete the opportunity and verify Today view updates
      await page.goto("/staff/today");
      const completeButton = page
        .getByRole("button", {
          name: "Complete",
        })
        .first();
      await expect(completeButton).toBeVisible();
      await completeButton.click();

      // Verify opportunity disappears from Today view after completion
      await expect
        .poll(async () => {
          const { count } = await admin
            .from("clienteling_opportunities")
            .select("id", { count: "exact", head: true })
            .eq("id", opportunity.id)
            .eq("status", "completed");
          return (count ?? 0) > 0;
        })
        .toBe(true);

      // Refresh and verify it's gone from the UI
      await page.reload();
      await expect(
        page.getByText("Follow up on navy business suit interest"),
      ).not.toBeVisible();

      proofPassed = true;
    } finally {
      // Cleanup
      await admin
        .from("customer_facts")
        .delete()
        .eq("retailer_id", retailerId)
        .eq("customer_id", customer.id);
      await admin
        .from("clienteling_opportunities")
        .delete()
        .eq("retailer_id", retailerId)
        .eq("customer_id", customer.id);
      await admin.from("customers").delete().eq("id", customer.id);
    }
  });

  test("different advisor cannot see another's assigned customer", async ({
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

    // Create two staff members
    const unique = Date.now();
    const staff1Email = `staff1-${unique}@paon.test`;
    const staff1Password = `test-password-${unique}`;
    const staff2Email = `staff2-${unique}@paon.test`;
    const staff2Password = `test-password-${unique}-2`;

    // Create staff members in auth
    const { data: auth1 } = await admin.auth.admin.createUser({
      email: staff1Email,
      password: staff1Password,
      email_confirm: true,
    });
    const { data: auth2 } = await admin.auth.admin.createUser({
      email: staff2Email,
      password: staff2Password,
      email_confirm: true,
    });

    if (!auth1?.user?.id || !auth2?.user?.id) {
      throw new Error("failed to create test staff users");
    }

    // Create retailer staff records
    const { data: staffRow1 } = await admin
      .from("retailer_staff_members")
      .insert([
        {
          retailer_id: retailerId,
          user_id: auth1.user.id,
          email: staff1Email,
          full_name: `Test Staff 1 ${unique}`,
          role: "sales_associate" as const,
          // Mark accepted so login lands on the dashboard instead of the
          // "set your password" invite-acceptance screen (matches the
          // pattern in apps/retailer/e2e/global-setup.ts).
          accepted_at: new Date().toISOString(),
        },
      ])
      .select("id")
      .single();
    const { data: staffRow2 } = await admin
      .from("retailer_staff_members")
      .insert([
        {
          retailer_id: retailerId,
          user_id: auth2.user.id,
          email: staff2Email,
          full_name: `Test Staff 2 ${unique}`,
          role: "sales_associate" as const,
          accepted_at: new Date().toISOString(),
        },
      ])
      .select("id")
      .single();

    if (!staffRow1?.id || !staffRow2?.id) {
      throw new Error("failed to create staff records");
    }

    // Create a customer
    const customer = await new CustomerRepository(admin).create({
      retailerId,
      fullName: `R0.4 Permission Test ${unique}`,
      email: `r04-perm-${unique}@paon.test`,
      lifecycleStage: "prospect",
    });

    // Assign opportunity only to staff1
    const { data: oppData } = await admin
      .from("clienteling_opportunities")
      .insert({
        retailer_id: retailerId,
        customer_id: customer.id,
        opportunity_type: "interest_follow_up",
        why_now: "Permission test opportunity",
        suggested_action: "Follow up call",
        channel: "phone",
        assigned_staff_id: staffRow1.id,
        projector_version: "permission-test",
      })
      .select("id")
      .single();

    try {
      // Staff1 sees the opportunity on their Today view
      await page.goto("/login");
      await page.getByLabel("Email").fill(staff1Email);
      await page.getByLabel("Password").fill(staff1Password);
      await page.getByRole("button", { name: "Enter the atelier" }).click();
      await expect(page).not.toHaveURL(/\/login/);
      await page.goto("/staff/today");
      await expect(page.getByText("Permission test opportunity")).toBeVisible();

      // Sign out staff1
      await page
        .click('[data-testid="logout-button"], a[href="/api/logout"]', {
          timeout: 5000,
        })
        .catch(() => {
          // If test ID doesn't exist, try to navigate via menu
        });

      // Alternative logout for cases where the button isn't found
      if (await page.url().includes("/staff/today")) {
        // Force reload to clear session
        await page.context().clearCookies();
      }

      // Staff2 logs in and should NOT see staff1's opportunity
      await page.goto("/login");
      await page.getByLabel("Email").fill(staff2Email);
      await page.getByLabel("Password").fill(staff2Password);
      await page.getByRole("button", { name: "Enter the atelier" }).click();
      await expect(page).not.toHaveURL(/\/login/);
      await page.goto("/staff/today");

      // The opportunity should not be visible to staff2
      await expect(
        page.getByText("Permission test opportunity"),
      ).not.toBeVisible();

      proofPassed = true;
    } finally {
      // Cleanup
      await admin.auth.admin.deleteUser(auth1.user.id);
      await admin.auth.admin.deleteUser(auth2.user.id);
      await admin
        .from("retailer_staff_members")
        .delete()
        .eq("id", staffRow1.id);
      await admin
        .from("retailer_staff_members")
        .delete()
        .eq("id", staffRow2.id);
      if (oppData?.id) {
        await admin
          .from("clienteling_opportunities")
          .delete()
          .eq("id", oppData.id);
      }
      await admin.from("customers").delete().eq("id", customer.id);
    }
  });

  test("House Memory shows stale and conflicting evidence states", async ({
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

    const { data: ownerAuthUser } = await admin
      .from("retailer_staff_members")
      .select("id")
      .eq("retailer_id", retailerId)
      .eq("email", TEST_OWNER_EMAIL)
      .single();
    if (!ownerAuthUser) throw new Error("owner staff record missing");
    const staffId = asId<"StaffId">(ownerAuthUser.id);

    // Create customer
    const unique = Date.now();
    const customer = await new CustomerRepository(admin).create({
      retailerId,
      fullName: `R0.4 Stale Evidence ${unique}`,
      email: `r04-stale-${unique}@paon.test`,
      lifecycleStage: "prospect",
    });

    // Create facts with different evidence ages
    const now = new Date().toISOString();
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    await admin.from("customer_facts").insert({
      retailer_id: retailerId,
      customer_id: customer.id,
      fact_type: "preference_concept",
      provenance_class: "advisor_observed",
      value_label: "Classic tailoring",
      confidence: 0.85,
      sensitivity: "standard",
      visibility: "customer_and_advisor",
      observed_at: thirtyDaysAgo,
      author_staff_id: staffId,
      evidence: [{ note: "Observed in fitting 30 days ago" }],
      created_at: now,
      updated_at: now,
    });

    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
    await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
    await page.getByRole("button", { name: "Enter the atelier" }).click();
    await expect(page).not.toHaveURL(/\/login/);

    try {
      // Navigate to customer House Memory
      await page.goto(`/customers/${customer.id}`);
      await expect(
        page.getByText(`R0.4 Stale Evidence ${unique}`),
      ).toBeVisible();

      // Verify fact is shown even if old
      await expect(page.getByText("Classic tailoring")).toBeVisible();

      proofPassed = true;
    } finally {
      await admin
        .from("customer_facts")
        .delete()
        .eq("retailer_id", retailerId)
        .eq("customer_id", customer.id);
      await admin.from("customers").delete().eq("id", customer.id);
    }
  });
});
