import {
  DEMO_PASSWORD,
  getDemoPersona,
  seedDemoData,
} from "@paon/database/demo-seed";
import { expect, test, type Page } from "@playwright/test";

// The canonical showcase roster is intentionally shared. Seed it once in a
// single worker so parallel browser contexts cannot race to create the same
// auth identity.
test.describe.configure({ mode: "serial" });

const retailerPersonas = [
  {
    name: "owner",
    email: getDemoPersona("retailer-owner").email,
    visible: [
      /^Today$/,
      /^Fitting room$/,
      /^Relationships$/,
      /^Merchandise$/,
      /^Atelier$/,
    ],
    hidden: [],
    brief: "The atelier, at a glance.",
  },
  {
    name: "manager",
    email: getDemoPersona("retailer-manager").email,
    visible: [/^Today$/, /^Fitting room$/, /^Relationships$/, /^Merchandise$/],
    hidden: [/^Atelier$/],
    brief: "Today on the floor.",
  },
  {
    name: "sales advisor",
    email: getDemoPersona("sales-advisor").email,
    visible: [/^Today$/, /^Fitting room$/, /^Relationships$/],
    hidden: [/^Merchandise$/, /^Atelier$/],
    brief: "Make every client moment count.",
  },
  {
    name: "production specialist",
    email: getDemoPersona("production-staff").email,
    visible: [/^Today$/, /^Fitting room$/],
    hidden: [/^Relationships$/, /^Merchandise$/, /^Atelier$/],
    brief: "Promises in motion.",
  },
  {
    name: "workshop manager",
    email: getDemoPersona("workshop-manager").email,
    visible: [/^Today$/, /^Workshop floor$/],
    hidden: [/^Relationships$/, /^Merchandise$/, /^Atelier$/],
    brief: "The workroom, in motion.",
  },
  {
    name: "alteration worker",
    email: getDemoPersona("alteration-worker").email,
    visible: [/^Today$/, /^Workshop floor$/],
    hidden: [/^Relationships$/, /^Merchandise$/, /^Atelier$/],
    brief: "Your bench, clearly.",
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

test("sales advisors are redirected away from management-only routes", async ({
  page,
}) => {
  await signIn(page, getDemoPersona("sales-advisor").email);

  for (const [path, destination] of [
    ["/staff", "/dashboard"],
    ["/staff/new", "/dashboard"],
    ["/settings/billing", "/dashboard"],
    ["/products/new", "/products"],
    ["/collections", "/products"],
  ] as const) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${destination}(?:\\?|$)`));
  }
});

test("alteration workers are redirected away from configuration routes", async ({
  page,
}) => {
  await signIn(page, getDemoPersona("alteration-worker").email);

  for (const path of [
    "/alterations/new",
    "/alterations/catalogue",
    "/alterations/workshops",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/alterations(?:\?|$)/);
  }
});

test("mobile shell exposes the same worker-safe navigation in a drawer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, getDemoPersona("alteration-worker").email);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("link", { name: /^Work queue/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Orders/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Close navigation" }).last().click();
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toBeVisible();
});
