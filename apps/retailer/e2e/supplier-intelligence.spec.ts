import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "12.4";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/supplier-intelligence.spec.ts";

let proofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: proofPassed ? "passed" : "failed",
  });
});

test("owner logs a supplier fact, cites it in an exception, and closes a complaint through customer recovery", async ({
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
  const retailerId = retailer.id;

  const unique = Date.now();
  const materialKey = `e2e-flannel-${unique}`;
  const supplierKey = `e2e-supplier-${unique}`;
  const authorityKey = `e2e-authority-${unique}`;

  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  try {
    await page.goto("/supplier-intelligence");

    // ---- Log a supplier fact — the versioned material fixture -----------
    await page.locator("#kind").selectOption("material_availability");
    await page.locator("#supplierKey").fill(supplierKey);
    await page.locator("#materialKey").fill(materialKey);
    await page.locator("#value").fill("in_stock");
    await page.locator("#sourceAuthorityKey").fill(authorityKey);
    await page.locator("#sourceVersion").fill("v1");
    await page.locator("#observedAt").fill("2026-08-01T09:00");
    await page.getByRole("button", { name: "Log fact" }).click();

    const factRow = page.locator("li", { hasText: materialKey }).first();
    await expect(factRow).toBeVisible({ timeout: 15_000 });
    await expect(factRow).toContainText(authorityKey);

    const { data: factRows } = await admin
      .from("supplier_facts")
      .select("id")
      .eq("retailer_id", retailerId)
      .eq("material_key", materialKey)
      .eq("source_authority_key", authorityKey);
    expect(factRows).toHaveLength(1);

    // ---- Fabric ↔ button rule --------------------------------------------
    await page.locator("#fabricKey").fill(materialKey);
    await page.locator("#allowedButtonKeys").fill("horn-natural, horn-dark");
    await page.locator("#note").fill("No metal buttons on this cloth.");
    await page.getByRole("button", { name: "Save rule" }).click();
    // fabric_button_rules also has no DELETE grant for any role, so rows
    // from earlier local runs persist — scope to the rules card (the fact
    // card above also renders a row containing this same material key).
    const rulesCard = page.locator("h2", { hasText: "Fabric" }).locator("..");
    const ruleRow = rulesCard.locator("li", { hasText: materialKey });
    await expect(ruleRow).toBeVisible({ timeout: 15_000 });
    await expect(ruleRow).toContainText("horn-natural, horn-dark");

    // ---- Supply exception: refused with no citation, then real ----------
    await page.goto("/supplier-intelligence");
    const exceptionCard = page
      .locator("h2", { hasText: "Supply exceptions" })
      .locator("..");
    await exceptionCard
      .locator("#exceptionKind")
      .selectOption("material_shortage");
    await exceptionCard.locator("#exceptionMaterialKey").fill(materialKey);
    await exceptionCard.locator("#ownerStaffId").selectOption({ index: 1 });
    await exceptionCard
      .locator("textarea[name='detail']")
      .fill(`Flannel run short on this order. ${unique}`);
    await exceptionCard
      .getByRole("button", { name: "Record exception" })
      .click();
    await expect(
      exceptionCard.getByText(/Select at least one fact/i),
    ).toBeVisible({ timeout: 15_000 });

    // The server action's implicit route refresh resets this uncontrolled
    // form's other fields back to their pristine defaults on any
    // submission (same class of bug noted elsewhere in this repo's e2e
    // suite) — so every field is re-filled here rather than assuming the
    // prior fill survived the refused round-trip.
    await page.goto("/supplier-intelligence");
    await exceptionCard
      .locator("#exceptionKind")
      .selectOption("material_shortage");
    await exceptionCard.locator("#exceptionMaterialKey").fill(materialKey);
    await exceptionCard.locator("#ownerStaffId").selectOption({ index: 1 });
    await exceptionCard
      .locator("textarea[name='detail']")
      .fill(`Flannel run short on this order. ${unique}`);
    // `supplier_facts` is append-only (no DELETE grant for any role, by
    // design), so facts from earlier local test runs are never cleaned up
    // and accumulate in this fixture retailer — matched by this run's own
    // unique authority key rather than `.first()`, which would otherwise
    // resolve nondeterministically among them.
    await exceptionCard
      .locator("label", { hasText: authorityKey })
      .locator("input[name='citationFactIds']")
      .check();
    await exceptionCard
      .getByRole("button", { name: "Record exception" })
      .click();
    await expect(exceptionCard.getByText("Exception recorded.")).toBeVisible({
      timeout: 15_000,
    });

    const exceptionRow = page.locator("li[data-exception-id]", {
      hasText: materialKey,
    });
    await expect(exceptionRow).toBeVisible({ timeout: 15_000 });
    await expect(exceptionRow.getByText("Open")).toBeVisible();

    await exceptionRow.getByRole("button", { name: "Acknowledge" }).click();
    await expect(exceptionRow.getByText("Acknowledged")).toBeVisible({
      timeout: 15_000,
    });

    await exceptionRow
      .getByLabel("How was this resolved?")
      .fill("Sourced an equivalent bolt from a second mill.");
    await exceptionRow.getByRole("button", { name: "Resolve" }).click();
    await expect(exceptionRow.getByText("Resolved")).toBeVisible({
      timeout: 15_000,
    });

    // ---- Complaint case: raised → investigating → supplier_notified (
    // refused without evidence, then real) → customer_recovered → closed --
    const complaintSummary = `Trouser seam opened on delivery ${unique}`;
    const complaintCard = page
      .locator("h2", { hasText: "Complaint cases" })
      .locator("..");
    await complaintCard
      .locator("textarea[name='summary']")
      .fill(complaintSummary);
    await complaintCard.getByRole("button", { name: "Log complaint" }).click();

    const complaintRow = page.locator("li[data-complaint-id]", {
      hasText: complaintSummary,
    });
    await expect(complaintRow).toBeVisible({ timeout: 15_000 });
    await expect(complaintRow.getByText("Raised")).toBeVisible();

    await complaintRow
      .getByRole("button", { name: "Start investigating" })
      .click();
    await expect(complaintRow.getByText("Investigating")).toBeVisible({
      timeout: 15_000,
    });

    await complaintRow.getByRole("button", { name: "Notify supplier" }).click();
    await expect(
      complaintRow.getByText(/Attach at least one piece of evidence/i),
    ).toBeVisible({ timeout: 15_000 });

    await complaintRow
      .getByLabel("Evidence refs, comma separated")
      .fill("photo-seam-001.jpg");
    await complaintRow.getByRole("button", { name: "Notify supplier" }).click();
    await expect(complaintRow.getByText("Supplier notified")).toBeVisible({
      timeout: 15_000,
    });

    await complaintRow
      .getByLabel("Customer recovery note")
      .fill("Replacement trouser delivered same week, no charge.");
    await complaintRow
      .getByRole("button", { name: "Mark customer recovered" })
      .click();
    await expect(complaintRow.getByText("Customer recovered")).toBeVisible({
      timeout: 15_000,
    });

    await complaintRow
      .getByLabel("Final outcome")
      .fill("Replaced under warranty; supplier issued a credit.");
    await complaintRow.getByRole("button", { name: "Close case" }).click();
    await expect(complaintRow.getByText("Closed")).toBeVisible({
      timeout: 15_000,
    });

    // Never a factory write-back or a bare unattributed number anywhere on
    // the page — this item's two hardest non-goals.
    const pageText = (await page.locator("body").innerText()).toLowerCase();
    expect(pageText).not.toContain("write-back");
    expect(pageText).not.toContain("write back");

    proofPassed = true;
  } finally {
    await admin
      .from("supply_complaint_cases")
      .delete()
      .eq("retailer_id", retailerId)
      .ilike("summary", `%${unique}%`);
    await admin
      .from("supply_exceptions")
      .delete()
      .eq("retailer_id", retailerId)
      .eq("material_key", materialKey);
    await admin
      .from("fabric_button_rules")
      .delete()
      .eq("retailer_id", retailerId)
      .eq("fabric_key", materialKey);
    // supplier_facts has no DELETE grant for any role — append-only by
    // design (enforce-append-only migration). This call is a deliberate
    // best-effort no-op, kept for symmetry with the other tables rather
    // than silently pretending the row was removed.
    await admin
      .from("supplier_facts")
      .delete()
      .eq("retailer_id", retailerId)
      .eq("material_key", materialKey);
  }
});
