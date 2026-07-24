import {
  DEMO_PASSWORD,
  DEMO_PERSONA_LOGINS,
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
    throw new Error("Demo atelier test requires the local Supabase variables.");
  }
  await seedDemoData({ supabaseUrl, anonKey, serviceRoleKey });

  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_ADMIN_EMAIL);
  await page.getByLabel("Password").fill(TEST_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Enter PAON" }).click();
  await expect(page).toHaveURL(/\/retailers$/);
  await page.goto("/demo-mode");

  await expect(
    page.getByRole("heading", { name: "Demo atelier" }),
  ).toBeVisible();
  await expect(page.getByText(DEMO_PASSWORD)).toBeVisible();
  await expect(page.getByText("Production / operations").first()).toBeVisible();
  await expect(page.getByText("Alteration worker").first()).toBeVisible();
  await expect(page.getByText("Customer — Isabelle Laurent")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open environment" }),
  ).toHaveCount(DEMO_PERSONA_LOGINS.length);
});
