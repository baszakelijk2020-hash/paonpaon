import { createSupabaseAdminClient } from "@paon/database";
import { expect, test, type Page } from "@playwright/test";

import {
  AUTH_DELIVERABLE_DOMAIN,
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "12.2";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/production.spec.ts";

let proofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: proofPassed ? "passed" : "failed",
  });
});

async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("a suit's jacket and trousers scan independently through production, a post-cut change is explicit, an outworker sees only initials, and a delay raises a service-recovery action", async ({
  page,
}) => {
  test.setTimeout(300_000);

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

  const { data: owner } = await admin
    .from("retailer_staff_members")
    .select("id")
    .eq("retailer_id", retailerId)
    .eq("email", TEST_OWNER_EMAIL)
    .single();
  if (!owner) throw new Error("fixture owner staff record missing");

  const unique = Date.now();

  // A second staff member for the QC inspector role — never signed in, only
  // ever picked from a dropdown, same pattern as staff-recognition.spec.ts's
  // colleague fixture.
  const { data: inspector, error: inspectorError } = await admin
    .from("retailer_staff_members")
    .insert({
      retailer_id: retailerId,
      user_id: null,
      full_name: `E2E QC Inspector ${unique}`,
      email: `e2e-production-inspector-${unique}@${AUTH_DELIVERABLE_DOMAIN}`,
      role: "production_staff",
      accepted_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (!inspector) {
    throw new Error(
      `could not create inspector fixture: ${JSON.stringify(inspectorError)}`,
    );
  }

  const customerFullName = `E2E Production Client ${unique}`;
  const { data: customer } = await admin
    .from("customers")
    .insert({
      retailer_id: retailerId,
      full_name: customerFullName,
      email: `e2e-production-${unique}@paon.test`,
      lifecycle_stage: "prospect",
    })
    .select("id")
    .single();
  if (!customer) throw new Error("could not create customer fixture");

  const { data: measurementVersion, error: measurementError } = await admin
    .from("customer_measurement_versions")
    .insert({
      retailer_id: retailerId,
      customer_id: customer.id,
      version: 1,
      values: [
        { key: "chest", millimetres: 1020, capturedBy: "tailor_tape" },
        { key: "waist", millimetres: 880, capturedBy: "tailor_tape" },
        { key: "sleeve", millimetres: 650, capturedBy: "tailor_tape" },
      ],
      approved_by_staff_id: owner.id,
    })
    .select("id")
    .single();
  if (!measurementVersion) {
    throw new Error(
      `could not create measurement version fixture: ${JSON.stringify(measurementError)}`,
    );
  }

  const orderNumber = `E2E-PROD-${unique}`;
  const { data: order } = await admin
    .from("orders")
    .insert({
      retailer_id: retailerId,
      customer_id: customer.id,
      order_number: orderNumber,
      currency: "USD",
      subtotal_amount_minor_units: 250_000,
      total_amount_minor_units: 250_000,
    })
    .select("id")
    .single();
  if (!order) throw new Error("could not create order fixture");
  const orderId = order.id;

  // A freshly admin-inserted row can take a moment to become visible to a
  // separate connection (observed directly: an immediate session-scoped
  // read of this exact row returned empty while an admin re-read moments
  // later succeeded) — waited out here rather than in product code, since
  // only this test's insert-then-immediately-act-through-the-UI pattern
  // creates the race; a real order is never queried within milliseconds of
  // its own creation.
  await expect
    .poll(
      async () => {
        const { data } = await admin
          .from("orders")
          .select("id")
          .eq("id", orderId)
          .maybeSingle();
        return data?.id ?? null;
      },
      { timeout: 15_000 },
    )
    .toBe(orderId);

  try {
    await signIn(page);
    await page.goto("/production");

    // A form submitted via a plain (non-useActionState) server action does
    // not guarantee the mutation has landed by the time Playwright's click()
    // resolves, so every DB assertion immediately after one polls rather
    // than reading once — the same reasoning as this suite's own
    // `expect.poll` waits elsewhere.
    let latestSpecId: string | null = null;
    async function pollSpecId(): Promise<string> {
      await expect
        .poll(
          async () => {
            const { data } = await admin
              .from("production_specs")
              .select("id")
              .eq("retailer_id", retailerId)
              .eq("order_id", orderId);
            latestSpecId = data?.[0]?.id ?? null;
            return latestSpecId;
          },
          { timeout: 20_000 },
        )
        .not.toBeNull();
      return latestSpecId!;
    }

    // ---- create the spec, pinned to the approved measurement version ----
    await page.selectOption("#orderId", { label: orderNumber });
    await page.getByRole("button", { name: "Create spec" }).click();
    const specId = await pollSpecId();

    await page.goto("/production");
    const { data: specCheck } = await admin
      .from("production_specs")
      .select("measurement_version_id")
      .eq("id", specId)
      .single();
    expect(specCheck!.measurement_version_id).toBe(measurementVersion.id);

    // ---- add jacket, promised 5 days ago — a delay from the start -------
    const fiveDaysAgo = new Date(Date.now() - 5 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    await page.selectOption("#specId", { label: `${orderNumber} (v1)` });
    await page.selectOption("#pieceKind", "jacket");
    await page.fill("#pieceSequence", "1");
    await page.fill("#promisedOn", fiveDaysAgo);
    await page.getByRole("button", { name: "Add piece" }).click();

    // ---- add trousers, promised today — not delayed ---------------------
    const today = new Date().toISOString().slice(0, 10);
    await page.goto("/production");
    await page.selectOption("#specId", { label: `${orderNumber} (v1)` });
    await page.selectOption("#pieceKind", "trousers");
    await page.fill("#pieceSequence", "2");
    await page.fill("#promisedOn", today);
    await page.getByRole("button", { name: "Add piece" }).click();

    let latestPieceRows: { id: string; piece_kind: string; barcode: string }[] =
      [];
    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("production_pieces")
            .select("id, piece_kind, barcode")
            .eq("spec_id", specId)
            .order("piece_sequence", { ascending: true });
          latestPieceRows = data ?? [];
          return latestPieceRows.length;
        },
        { timeout: 20_000 },
      )
      .toBe(2);
    const pieceRows = latestPieceRows;
    const jacket = pieceRows.find((p) => p.piece_kind === "jacket")!;
    const trousers = pieceRows.find((p) => p.piece_kind === "trousers")!;

    // ---- the delay shows up before the jacket is even touched, and
    // raising it writes a real service-recovery budget request ------------
    await page.goto("/production");
    const delayedRow = page.locator(`li[data-delayed-piece-id="${jacket.id}"]`);
    await expect(delayedRow).toBeVisible({ timeout: 15_000 });
    await expect(delayedRow).toContainText("Needs service recovery");
    await delayedRow
      .getByRole("button", { name: "Raise service recovery" })
      .click();

    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("service_recovery_budget_requests")
            .select("id, reason")
            .eq("retailer_id", retailerId)
            .eq("order_id", orderId);
          return data?.length ?? 0;
        },
        { timeout: 30_000 },
      )
      .toBe(1);

    // ---- barcode lookup: each piece is findable on its own ---------------
    await page.goto(`/production?barcode=${jacket.barcode}`);
    await expect(
      page.locator(`[data-barcode-result="${jacket.barcode}"]`),
    ).toContainText("jacket");

    function pieceRow(pieceId: string) {
      return page.locator(`li[data-piece-id="${pieceId}"]`);
    }

    async function move(
      pieceId: string,
      buttonName: string,
      opts?: { inspector?: string; defectNote?: string },
    ): Promise<void> {
      await page.goto("/production");
      const row = pieceRow(pieceId);
      if (opts?.inspector) {
        await row
          .getByLabel("Inspector")
          .selectOption({ label: opts.inspector });
      }
      if (opts?.defectNote !== undefined) {
        await row.getByLabel(/Defect note/).fill(opts.defectNote);
      }
      await row.getByRole("button", { name: buttonName }).click();
    }

    async function waitForStage(pieceId: string, stage: string): Promise<void> {
      await expect
        .poll(
          async () => {
            await page.goto("/production");
            return pieceRow(pieceId).getAttribute("data-piece-stage");
          },
          { timeout: 30_000 },
        )
        .toBe(stage);
    }

    // ---- jacket progresses: spec_locked -> cutting ------------------------
    await move(jacket.id, "Start cutting");
    await waitForStage(jacket.id, "cutting");

    // ---- post-cut change is now explicit: an empty reason is refused -----
    await page.goto("/production");
    let jacketRow = pieceRow(jacket.id);
    await expect(jacketRow).toContainText("requires amendment");
    await jacketRow.getByRole("button", { name: "Record amendment" }).click();
    await expect(jacketRow.getByText("Say why this is changing.")).toBeVisible({
      timeout: 15_000,
    });

    // ---- a real amendment, naming a reason and who pays ------------------
    await page.goto("/production");
    jacketRow = pieceRow(jacket.id);
    await jacketRow
      .getByLabel("Reason for change")
      .fill("Client requested a shorter sleeve after cutting began.");
    await jacketRow
      .getByLabel("Who absorbs the cost")
      .selectOption("retailer_absorbs");
    await jacketRow.getByRole("button", { name: "Record amendment" }).click();
    await expect(jacketRow.getByText("Amendment recorded.")).toBeVisible({
      timeout: 15_000,
    });

    const { data: amendments } = await admin
      .from("production_spec_amendments")
      .select("reason, cost_decision")
      .eq("spec_id", specId);
    expect(amendments).toHaveLength(1);
    expect(amendments![0]!.cost_decision).toBe("retailer_absorbs");

    // ---- jacket: assembly -> finishing -> quality control -----------------
    await move(jacket.id, "Move to assembly");
    await waitForStage(jacket.id, "assembly");
    await move(jacket.id, "Move to finishing");
    await waitForStage(jacket.id, "finishing");
    await move(jacket.id, "Send to quality control");
    await waitForStage(jacket.id, "quality_control");

    // ---- QC exit refuses with no inspector named --------------------------
    await page.goto("/production");
    jacketRow = pieceRow(jacket.id);
    await jacketRow.getByRole("button", { name: "Pass — ready" }).click();
    await expect(jacketRow.getByText("Name who inspected it.")).toBeVisible({
      timeout: 15_000,
    });

    // ---- failing with no defect note is refused ---------------------------
    await page.goto("/production");
    jacketRow = pieceRow(jacket.id);
    await jacketRow.getByLabel("Inspector").selectOption({
      label: `E2E QC Inspector ${unique}`,
    });
    await jacketRow
      .getByRole("button", { name: "Fail — needs rework" })
      .click();
    await expect(
      jacketRow.getByText(/a rework with no stated defect/i),
    ).toBeVisible({ timeout: 15_000 });

    // ---- the inspector cannot be the maker (the owner made every move
    // so far) ---------------------------------------------------------------
    await page.goto("/production");
    jacketRow = pieceRow(jacket.id);
    await jacketRow
      .getByLabel("Inspector")
      .selectOption({ label: "E2E Owner" });
    await jacketRow
      .getByLabel(/Defect note/)
      .fill("Shoulder seam is puckering.");
    await jacketRow
      .getByRole("button", { name: "Fail — needs rework" })
      .click();
    await expect(
      jacketRow.getByText(/can't be the same person who made it/i),
    ).toBeVisible({ timeout: 15_000 });

    // ---- a real rework, with a different inspector and a stated defect ---
    await move(jacket.id, "Fail — needs rework", {
      inspector: `E2E QC Inspector ${unique}`,
      defectNote: "Shoulder seam is puckering.",
    });
    await waitForStage(jacket.id, "rework");

    // ---- rework re-enters at assembly, not back at quality control -------
    await move(jacket.id, "Back to assembly");
    await waitForStage(jacket.id, "assembly");
    await move(jacket.id, "Move to finishing");
    await waitForStage(jacket.id, "finishing");
    await move(jacket.id, "Send to quality control");
    await waitForStage(jacket.id, "quality_control");
    await move(jacket.id, "Pass — ready", {
      inspector: `E2E QC Inspector ${unique}`,
    });
    await waitForStage(jacket.id, "ready");

    // ---- dispatch is refused while the trousers are not ready -------------
    await page.goto("/production");
    jacketRow = pieceRow(jacket.id);
    await expect(pieceRow(trousers.id)).toHaveAttribute(
      "data-piece-stage",
      "spec_locked",
    );
    await jacketRow.getByRole("button", { name: "Dispatch" }).click();
    await expect(
      jacketRow.getByText(/Every piece on this order must be ready/i),
    ).toBeVisible({ timeout: 15_000 });

    // ---- trousers scans independently: a clean run to ready --------------
    await move(trousers.id, "Start cutting");
    await waitForStage(trousers.id, "cutting");
    await move(trousers.id, "Move to assembly");
    await waitForStage(trousers.id, "assembly");
    await move(trousers.id, "Move to finishing");
    await waitForStage(trousers.id, "finishing");
    await move(trousers.id, "Send to quality control");
    await waitForStage(trousers.id, "quality_control");
    await move(trousers.id, "Pass — ready", {
      inspector: `E2E QC Inspector ${unique}`,
    });
    await waitForStage(trousers.id, "ready");

    // ---- now both are ready, the jacket can dispatch ----------------------
    await move(jacket.id, "Dispatch");
    await waitForStage(jacket.id, "dispatched");
    await move(trousers.id, "Dispatch");
    await waitForStage(trousers.id, "dispatched");

    // ---- an outworker ticket exposes initials, never the client's name ---
    await page.goto("/production");
    await page.selectOption("#ticketPieceId", { label: jacket.barcode });
    await page.fill(
      "#instructions",
      "Press and finish the collar; return within the week.",
    );
    await page.fill("#dueOn", today);
    await page.getByRole("button", { name: "Issue ticket" }).click();

    const ticketRow = page.locator(`li:has-text("${jacket.barcode}")`).last();
    await expect(ticketRow).toBeVisible({ timeout: 15_000 });
    const initials = customerFullName
      .split(/\s+/)
      .map((part) => part[0])
      .join("");
    await expect(ticketRow).toContainText(initials);
    await expect(ticketRow).not.toContainText(customerFullName);

    proofPassed = true;
  } finally {
    // production_specs, production_pieces, production_spec_amendments,
    // production_stage_events and production_work_tickets grant no DELETE
    // to any role in the migration (specs/pieces/material_lines/tickets are
    // select+insert+update only; amendments/stage_events are append-only,
    // select+insert only) — these five deletes are therefore best-effort
    // no-ops, kept for symmetry rather than silently omitted. Test debris
    // on these tables in the local fixture retailer is permanent, the same
    // already-accepted reality as 12.3's custody events and 12.4's
    // supplier_facts.
    const { data: specRows } = await admin
      .from("production_specs")
      .select("id")
      .eq("order_id", orderId);
    const { data: pieces } = await admin
      .from("production_pieces")
      .select("id")
      .eq("order_id", orderId);
    for (const piece of pieces ?? []) {
      await admin
        .from("production_work_tickets")
        .delete()
        .eq("piece_id", piece.id);
      await admin
        .from("production_stage_events")
        .delete()
        .eq("piece_id", piece.id);
    }
    for (const spec of specRows ?? []) {
      await admin
        .from("production_spec_amendments")
        .delete()
        .eq("spec_id", spec.id);
    }
    await admin
      .from("service_recovery_budget_requests")
      .delete()
      .eq("order_id", orderId);
    await admin.from("production_pieces").delete().eq("order_id", orderId);
    await admin.from("production_specs").delete().eq("order_id", orderId);
    await admin.from("orders").delete().eq("id", orderId);
    await admin
      .from("customer_measurement_versions")
      .delete()
      .eq("id", measurementVersion.id);
    await admin.from("customers").delete().eq("id", customer.id);
    await admin.from("retailer_staff_members").delete().eq("id", inspector.id);
  }
});
