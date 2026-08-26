import { resolve } from "node:path";

import { createSupabaseAdminClient } from "@paon/database";
import { expect, test, type Page } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL } from "./fixtures";

/**
 * PHASE 20.20 — Customer Alteration Choices V3.
 *
 * Contract CUSTOMER_ENVIRONMENT_REBUILD_V3 §6.1: the Alteration paid-care
 * service opens on three decision branches — "I know exactly what needs
 * changing", "Ask advisor with self-scan", "Assess in store". "Assess in
 * store" asks for a short service note, tells the customer to bring the
 * item, and shows a folded price list, without forcing an operation
 * selection.
 */

const EVIDENCE_DIR = resolve(
  process.cwd(),
  "../../docs/evidence/runs/20.20-customer-alteration-choices-v3",
);

async function openAlterationFlow(page: Page) {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) throw new Error("requires local Supabase.");
  const admin = createSupabaseAdminClient(url, key);

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: TEST_CUSTOMER_EMAIL,
  });
  if (error || !data.properties) {
    throw new Error(`magic link failed: ${error?.message ?? "unknown"}`);
  }
  await page.goto(
    `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`,
  );
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/appointments");
  await page.getByRole("button", { name: /^alteration$/i }).click();
}

const BRANCHES = [
  "I know exactly what needs changing",
  "Ask advisor with self-scan",
  "Assess in store",
];

test("the alteration service opens on the three §6.1 decision branches", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });

  await page.setViewportSize({ width: 1512, height: 982 });
  await openAlterationFlow(page);

  await expect(
    page.getByText("How would you like to handle this alteration?"),
  ).toBeVisible();
  for (const label of BRANCHES) {
    await expect(
      page.getByRole("button", { name: label, exact: true }),
    ).toBeVisible();
  }

  expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);

  await page.screenshot({
    path: resolve(EVIDENCE_DIR, "desktop-1512x982.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: resolve(EVIDENCE_DIR, "mobile-390x844.png"),
    fullPage: true,
  });
  expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
});

test("'Assess in store' takes a note, says to bring the item, folds a price list, and forces no operation", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });

  await page.setViewportSize({ width: 1512, height: 982 });
  await openAlterationFlow(page);
  await page
    .getByRole("button", { name: "Assess in store", exact: true })
    .click();

  // Short service note.
  const note = page.getByRole("textbox", {
    name: "What should we look at? (a short note)",
  });
  await expect(note).toBeVisible();

  // Bring-the-item instruction.
  await expect(
    page.getByText("Please bring the garment to the store for assessment."),
  ).toBeVisible();

  // A folded price list — collapsed until opened.
  const priceList = page.locator("details", {
    has: page.getByText("Price list", { exact: true }),
  });
  await expect(priceList).toBeVisible();
  await expect(priceList).not.toHaveAttribute("open", /.*/);
  await priceList.getByText("Price list", { exact: true }).click();
  await expect(priceList).toHaveAttribute("open", /.*/);

  // No priced-operation picker is forced in this branch — the flow is
  // note + garment + quantity, then fulfilment.
  await note.fill("Sleeves a little long");
  await page.getByRole("textbox", { name: "Garment" }).fill("Navy blazer");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByRole("button", { name: "Store drop-off" }),
  ).toBeVisible();

  expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
});

test("'I know exactly what needs changing' moves forward, not to a dead end", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });

  await page.setViewportSize({ width: 1512, height: 982 });
  await openAlterationFlow(page);
  await page
    .getByRole("button", {
      name: "I know exactly what needs changing",
      exact: true,
    })
    .click();

  // The branch step is gone and the flow has advanced — either to the
  // priced operation list (retailer with a customer-visible catalogue) or
  // straight to the garment/quantity step — but the flow is still alive
  // (the service panel and its Cancel control remain), not a stuck panel.
  await expect(
    page.getByText("How would you like to handle this alteration?"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("textbox", { name: "Garment" })
      .or(page.getByRole("button", { name: /£/ }).first()),
  ).toBeVisible();

  expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
});
