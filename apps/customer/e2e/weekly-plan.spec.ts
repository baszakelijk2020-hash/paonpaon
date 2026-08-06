import { createSupabaseAdminClient } from "@paon/database";
import { expect, test, type Page } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

async function signIn(
  page: Page,
  admin: ReturnType<typeof createSupabaseAdminClient>,
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: TEST_CUSTOMER_EMAIL,
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
    const isCustomerDashboard = await page
      .getByRole("button", { name: "Sign out" })
      .isVisible();
    if (
      /\/dashboard$/.test(page.url()) &&
      hasAuthCookie &&
      isCustomerDashboard
    ) {
      return;
    }
  }
  throw new Error(`local magic-link sign-in did not complete: ${page.url()}`);
}

/**
 * FT-14 Preferred Tailoring's first connected slice — the customer half:
 * a weekly wardrobe plan the advisor already proposed (retailer-side
 * authoring is proven separately in apps/retailer/e2e/services.spec.ts)
 * shows up read-only with day-by-day notes, and accepting it calls
 * decide_service_weekly_plan and is reflected in the database. Fixture
 * plan/membership/weekly-plan rows are seeded directly via admin, matching
 * silhouette-analysis.spec.ts's precedent of proving only this side's
 * authorization boundary here.
 */
test("a customer sees an advisor-proposed weekly plan and accepts it", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("requires local Supabase.");
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
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("email", TEST_CUSTOMER_EMAIL)
    .single();
  if (!customer) throw new Error("fixture customer missing");

  const planTitle = `E2E Weekly Plan Preferred Tailoring ${Date.now()}`;
  const outfitNotes = "Charcoal suit, white shirt, navy tie";

  const { data: servicePlan, error: servicePlanError } = await admin
    .from("service_plans")
    .insert({
      retailer_id: retailer.id,
      kind: "preferred_tailoring",
      status: "active",
      title: planTitle,
      summary: "E2E summary.",
      explanation: "E2E explanation.",
    })
    .select("id")
    .single();
  if (servicePlanError || !servicePlan) {
    throw servicePlanError ?? new Error("could not seed service plan");
  }

  try {
    const { data: membership, error: membershipError } = await admin
      .from("service_memberships")
      .insert({
        plan_id: servicePlan.id,
        retailer_id: retailer.id,
        customer_id: customer.id,
        status: "active",
      })
      .select("id")
      .single();
    if (membershipError || !membership) {
      throw membershipError ?? new Error("could not seed membership");
    }

    const nextMonday = new Date();
    const day = nextMonday.getUTCDay();
    const daysUntilMonday = day === 1 ? 7 : ((1 - day + 7) % 7) + 7;
    nextMonday.setUTCDate(nextMonday.getUTCDate() + daysUntilMonday);
    const weekStartDate = nextMonday.toISOString().slice(0, 10);

    const { data: weeklyPlan, error: weeklyPlanError } = await admin
      .from("service_weekly_plans")
      .insert({
        membership_id: membership.id,
        retailer_id: retailer.id,
        customer_id: customer.id,
        week_start_date: weekStartDate,
        status: "proposed",
        proposed_at: new Date().toISOString(),
        advisor_notes: "Board week ahead.",
      })
      .select("id")
      .single();
    if (weeklyPlanError || !weeklyPlan) {
      throw weeklyPlanError ?? new Error("could not seed weekly plan");
    }

    const { error: dayError } = await admin
      .from("service_weekly_plan_days")
      .insert({
        weekly_plan_id: weeklyPlan.id,
        retailer_id: retailer.id,
        customer_id: customer.id,
        day_of_week: 0,
        occasion_tag: "distinguished",
        outfit_notes: outfitNotes,
      });
    if (dayError) throw dayError;

    await signIn(page, admin);
    await page.goto("/services");
    await expect(
      page.getByRole("heading", {
        name: "Preferred Tailoring & HighMaintenance",
      }),
    ).toBeVisible();

    await expect(
      page.getByText(`Week of ${weekStartDate}`).first(),
    ).toBeVisible();
    await expect(page.getByText("Awaiting your decision")).toBeVisible();
    await expect(page.getByText(outfitNotes)).toBeVisible();
    await expect(page.getByText("Board week ahead.")).toBeVisible();

    await page.getByRole("button", { name: "Accept this week" }).click();
    await expect(page.getByText("Accepted").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Accept this week" }),
    ).not.toBeVisible();

    const { data: decided } = await admin
      .from("service_weekly_plans")
      .select("status, decided_at")
      .eq("id", weeklyPlan.id)
      .single();
    expect(decided?.status).toBe("customer_accepted");
    expect(decided?.decided_at).not.toBeNull();
  } finally {
    await admin.from("service_plans").delete().eq("id", servicePlan.id);
  }
});
