import { randomBytes } from "node:crypto";

import {
  createSupabaseAdminClient,
  createSupabaseDirectClient,
} from "@paon/database";
import { expect, test } from "@playwright/test";

test("a private synthetic demo is code-gated, useful, revocable, and not table-readable", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error("Private demo e2e requires local Supabase variables.");
  }
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const anon = createSupabaseDirectClient(supabaseUrl, anonKey);
  const companyName = `Maison Private ${Date.now()}`;
  const publicToken = randomBytes(32).toString("base64url");
  const accessCode = "E2E-private-2026";
  let prospectId: string | undefined;

  const syntheticData = {
    personas: [
      {
        key: "owner",
        label: "Retailer owner",
        attention: "Two high-value fittings need a decision before noon.",
        primaryAction: "Review fitting decisions",
      },
      {
        key: "worker",
        label: "Alteration worker",
        attention: "The midnight dinner jacket is ready for its final press.",
        primaryAction: "Open garment card",
      },
    ],
    customers: [
      {
        name: "Sofia Laurent",
        tier: "Private client",
        nextMoment: "Dinner jacket fitting tomorrow",
        lifetimeValue: "€28,400",
      },
    ],
    products: [
      {
        name: "Midnight dinner jacket",
        category: "Tailoring",
        price: "€4,800",
      },
    ],
    appointments: [
      {
        time: "10:30",
        customer: "Sofia Laurent",
        purpose: "Final fitting",
        status: "Prepared",
      },
    ],
    alterations: [
      {
        garment: "Midnight dinner jacket",
        customer: "Sofia Laurent",
        status: "Final press",
        progress: 82,
        due: "Tomorrow",
      },
    ],
    orders: [
      {
        reference: "PAON-2407",
        customer: "Sofia Laurent",
        status: "In workshop",
        value: "€4,800",
      },
    ],
    metrics: {
      relationshipValue: "€184k",
      appointmentsToday: 6,
      garmentsInMotion: 14,
      returnRate: "72%",
    },
  };

  try {
    const { data: prospect, error: prospectError } = await admin
      .from("commercial_prospects")
      .insert({
        company_name: companyName,
        primary_contact_name: "Amelia Retailer",
        primary_contact_email: "amelia-private@paon.test",
      })
      .select("id")
      .single();
    if (prospectError) throw prospectError;
    prospectId = prospect.id;

    const { data: feature, error: featureError } = await admin
      .from("commercial_features")
      .select("key")
      .limit(1)
      .single();
    if (featureError) throw featureError;

    const { data: plan, error: planError } = await admin
      .from("subscription_plans")
      .select("id")
      .limit(1)
      .single();
    if (planError) throw planError;

    const { error: configurationError } = await admin.rpc(
      "save_prospect_demo_configuration",
      {
        p_prospect_id: prospect.id,
        p_plan_id: plan.id,
        p_theme: {
          accentColor: "#5f4b3b",
          surfaceColor: "#f4f0e9",
          inkColor: "#1a1a1a",
          displayFont: "paon_editorial",
          bodyFont: "quiet_sans",
          cornerStyle: "soft",
        },
        p_marketing_headline: "The private client journey, composed.",
        p_personalized_introduction:
          "A tailored view of relationships, fittings and garments in motion.",
        p_locations: [{ name: "Mayfair", city: "London" }],
        p_product_mix: ["tailoring"],
        p_feature_keys: [feature.key],
        p_change_note: "Private demo e2e fixture",
      },
    );
    if (configurationError) throw configurationError;

    const { error: generationError } = await admin.rpc(
      "generate_prospect_demo_environment",
      {
        p_prospect_id: prospect.id,
        p_public_token: publicToken,
        p_access_code: accessCode,
        p_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        p_synthetic_data: syntheticData,
      },
    );
    if (generationError) throw generationError;
    const { error: publicationError } = await admin.rpc(
      "set_prospect_demo_publication",
      { p_prospect_id: prospect.id, p_publish: true },
    );
    if (publicationError) throw publicationError;

    const { data: leakedRows, error: readError } = await anon
      .from("prospect_demo_environments")
      .select("public_token");
    expect(readError).toBeNull();
    expect(leakedRows).toEqual([]);

    await page.goto(`/demo/${publicToken}`);
    await expect(
      page.getByRole("heading", { name: "Enter the room." }),
    ).toBeVisible();
    await page.getByLabel("Access code").fill("wrong-code");
    await page.getByRole("button", { name: "Open private demo" }).click();
    await expect(page.getByRole("alert")).toContainText("unavailable");

    await page.getByLabel("Access code").fill(accessCode);
    await page.getByRole("button", { name: "Open private demo" }).click();
    await expect(page.getByText(companyName)).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "The private client journey, composed.",
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Alteration worker" }).click();
    await expect(
      page.getByText(
        "The midnight dinner jacket is ready for its final press.",
      ),
    ).toBeVisible();

    await admin.rpc("set_prospect_demo_publication", {
      p_prospect_id: prospect.id,
      p_publish: false,
    });
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Enter the room." }),
    ).toBeVisible();
  } finally {
    if (prospectId) {
      await admin.from("commercial_prospects").delete().eq("id", prospectId);
    }
  }
});
