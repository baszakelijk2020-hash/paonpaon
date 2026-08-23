import {
  DEMO_CANONICAL_PERSONAS,
  DEMO_PASSWORD,
  seedDemoData,
} from "@paon/database/demo-seed";
import { expect, test } from "@playwright/test";

import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from "./fixtures";

test("demo atelier launches every seeded operating perspective", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error("Seed data test requires the local Supabase variables.");
  }
  await seedDemoData({ supabaseUrl, anonKey, serviceRoleKey });

  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_ADMIN_EMAIL);
  await page.getByLabel("Password").fill(TEST_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Enter PAON" }).click();
  await expect(page).toHaveURL(/\/retailers$/);
  await expect(
    page.getByRole("heading", { name: "The network, clearly in view." }),
  ).toBeVisible();
  await page.goto("/demo-mode");

  await expect(page.getByRole("heading", { name: "Seed data" })).toBeVisible();
  await expect(page.getByText(DEMO_PASSWORD)).toBeVisible();
  await expect(page.getByText("Production / operations").first()).toBeVisible();
  await expect(page.getByText("Alteration worker").first()).toBeVisible();
  await expect(page.getByText("Customer — Isabelle Laurent")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open environment" }),
  ).toHaveCount(DEMO_CANONICAL_PERSONAS.length);

  for (const persona of DEMO_CANONICAL_PERSONAS) {
    const card = page.locator("article", { hasText: persona.email });
    await expect(
      card.getByRole("link", { name: "Open environment" }),
    ).toHaveAttribute(
      "href",
      persona.app === "admin"
        ? /localhost:3000\/login$/
        : persona.app === "retailer"
          ? /localhost:3001\/login$/
          : /localhost:3002\/login\?demo=1$/,
    );
  }
});
