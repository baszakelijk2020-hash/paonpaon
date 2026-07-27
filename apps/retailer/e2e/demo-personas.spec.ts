import { DEMO_PASSWORD, seedDemoData } from "@paon/database/demo-seed";
import { expect, test, type Page } from "@playwright/test";

const retailerPersonas = [
  {
    name: "owner",
    email: "contact+maison-dubois-owner@nebelspiegel.com",
    visible: [/^Daily brief/, /^Client book/, /^Catalogue/, /^Team/],
    hidden: [],
    brief: "The atelier, at a glance.",
  },
  {
    name: "manager",
    email: "contact+maison-dubois-manager@nebelspiegel.com",
    visible: [/^Daily brief/, /^Client book/, /^Catalogue/, /^Performance/],
    hidden: [/^Team/],
    brief: "Today on the floor.",
  },
  {
    name: "sales advisor",
    email: "contact+maison-dubois-sales@nebelspiegel.com",
    visible: [/^Daily brief/, /^Appointments/, /^Client book/, /^Alterations/],
    hidden: [/^Catalogue/, /^Team/],
    brief: "Make every client moment count.",
  },
  {
    name: "production specialist",
    email: "contact+maison-dubois-operations@nebelspiegel.com",
    visible: [/^Daily brief/, /^Orders/, /^Alterations/],
    hidden: [/^Client book/, /^Catalogue/, /^Team/],
    brief: "Promises in motion.",
  },
  {
    name: "workshop manager",
    email: "contact+maison-dubois-workshop@nebelspiegel.com",
    visible: [/^Work queue/, /^Workshop pricing/],
    hidden: [/^Orders/, /^Client book/, /^Catalogue/],
    brief: "The workroom, clearly.",
  },
  {
    name: "alteration worker",
    email: "contact+maison-dubois-alteration-worker@nebelspiegel.com",
    visible: [/^Work queue/],
    hidden: [/^Workshop pricing/, /^Orders/, /^Client book/, /^Catalogue/],
    brief: "Your workbench.",
  },
] as const;

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test.beforeAll(async () => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error("Demo persona tests require the local Supabase variables.");
  }
  await seedDemoData({ supabaseUrl, anonKey, serviceRoleKey });
});

for (const persona of retailerPersonas) {
  test(`${persona.name} receives purpose-built navigation`, async ({
    page,
  }) => {
    await signIn(page, persona.email);
    await expect(
      page.getByRole("heading", { name: persona.brief }),
    ).toBeVisible();
    // Scoped to the sidebar's own nav region — the Mission Control header's
    // "Daily briefing · N" pill (`href="#attention"`) also starts with
    // "Daily brief", which would otherwise collide with the "Daily brief"
    // nav link's own accessible name in a page-wide query.
    const primaryNav = page.getByRole("navigation", { name: "Primary" });
    for (const label of persona.visible) {
      await expect(primaryNav.getByRole("link", { name: label })).toBeVisible();
    }
    for (const label of persona.hidden) {
      await expect(primaryNav.getByRole("link", { name: label })).toHaveCount(
        0,
      );
    }
  });
}

test("mobile shell exposes the same worker-safe navigation in a drawer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(
    page,
    "contact+maison-dubois-alteration-worker@nebelspiegel.com",
  );
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("link", { name: /^Work queue/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Orders/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Close navigation" }).last().click();
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toBeVisible();
});
