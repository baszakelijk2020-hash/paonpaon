import {
  AppointmentRepository,
  CustomerRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("today's appointment slots into its hour, and a priority task can be accepted", async ({
  page,
}) => {
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

  const unique = Date.now();
  const customer = await new CustomerRepository(admin).create({
    retailerId,
    fullName: `E2E Mission Control Client ${unique}`,
    email: `mission-control-${unique}@paon.test`,
    lifecycleStage: "prospect",
  });

  const startsAt = new Date();
  startsAt.setMinutes(0, 0, 0);
  startsAt.setHours(startsAt.getHours() + 1);
  const endsAt = new Date(startsAt.getTime() + 30 * 60_000);

  const appointment = await new AppointmentRepository(admin).create({
    retailerId,
    customerId: customer.id,
    type: "fitting",
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
  });

  const { data: opportunity, error: opportunityError } = await admin
    .from("clienteling_opportunities")
    .insert({
      retailer_id: retailerId,
      customer_id: customer.id,
      opportunity_type: "interest_follow_up",
      why_now: `E2E why-now ${unique}`,
      suggested_action: `E2E suggested action ${unique}`,
      channel: "in_person",
      status: "draft",
      projector_version: "clienteling-opportunity-v1",
    })
    .select("id")
    .single();
  if (opportunityError || !opportunity) throw opportunityError;

  try {
    await page.goto("/mission-control");
    await expect(
      page.getByRole("heading", { name: "Mission Control" }),
    ).toBeVisible();

    await expect(
      page.getByText(`E2E Mission Control Client ${unique}`),
    ).toBeVisible();

    const opportunityCard = page.locator("li", {
      hasText: `E2E why-now ${unique}`,
    });
    await expect(opportunityCard).toBeVisible();
    await opportunityCard.getByRole("button", { name: "Accept" }).click();
    await expect(opportunityCard).toHaveCount(0);

    const { data: updated } = await admin
      .from("clienteling_opportunities")
      .select("status")
      .eq("id", opportunity.id)
      .single();
    expect(updated?.status).toBe("accepted");
  } finally {
    await admin
      .from("clienteling_opportunities")
      .delete()
      .eq("id", opportunity.id);
    await admin.from("appointments").delete().eq("id", appointment.id);
    await admin.from("customers").delete().eq("id", customer.id);
  }
});
