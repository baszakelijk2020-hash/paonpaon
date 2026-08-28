import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import {
  SartorialRuleRepository,
  WardrobeRoadmapRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import { NEUTRAL_SARTORIAL_RULE_FIXTURES, asId } from "@paon/domain";
import { expect, test, type Page } from "@playwright/test";

import {
  TEST_CUSTOMER_EMAIL,
  TEST_PRODUCT_SLUG,
  TEST_RETAILER_SLUG,
} from "./fixtures";

/**
 * Phase 20.17 — a customer removes one advisor selection from their own
 * active wardrobe plan.
 *
 * Proves, through the real authenticated customer UI at desktop 1512x982
 * and mobile 390x844:
 *  - the advisor-selection card renders for an approved roadmap's open gap;
 *  - "Remove from wardrobe plan" requires an explicit confirmation step;
 *  - Cancel leaves the selection unchanged (card stays, no DB row);
 *  - Confirm records a real customer-scoped disposition row, scoped to this
 *    customer + retailer, and the card disappears;
 *  - the removal persists after a full page reload;
 *  - the advisor-authored roadmap, gap, and stage rows are NOT deleted.
 *
 * The service-role client only seeds/cleans fixtures and reads DB
 * postconditions — never performs the removal. No console error is
 * filtered.
 */

const EVIDENCE_SUBPATH =
  "../../../docs/evidence/runs/customer-v3-wardrobe-removal";

function admin() {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
}

function attachUnfilteredConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${String(e)}`));
  return errors;
}

async function signIn(page: Page): Promise<void> {
  const { data, error } = await admin().auth.admin.generateLink({
    type: "magiclink",
    email: TEST_CUSTOMER_EMAIL,
  });
  if (error || !data.properties) {
    throw new Error(
      `Failed to generate magic link: ${error?.message ?? "unknown error"}`,
    );
  }
  await page.goto(
    `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`,
  );
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator("[data-customer-shell]")).toBeVisible();
}

async function resolveIdentity(): Promise<{
  retailerId: string;
  customerId: string;
  staffId: string;
  productId: string;
}> {
  const client = admin();
  const { data: retailer } = await client
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const { data: customerRow } = await client
    .from("customers")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("email", TEST_CUSTOMER_EMAIL)
    .single();
  if (!customerRow) throw new Error("fixture customer missing");
  const { data: staffRow } = await client
    .from("retailer_staff_members")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("email", "e2e-alteration-actor@paon.test")
    .single();
  if (!staffRow) throw new Error("fixture staff account missing");
  const { data: product } = await client
    .from("products")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("slug", TEST_PRODUCT_SLUG)
    .single();
  if (!product) throw new Error("fixture product missing");
  return {
    retailerId: retailer.id,
    customerId: customerRow.id,
    staffId: staffRow.id,
    productId: product.id,
  };
}

/**
 * Seed an APPROVED roadmap with exactly one open (unfilled) gap, so the
 * wardrobe page renders one advisor-selection card. The advisor authors +
 * submits it; the customer approves it (real transition, admin client used
 * only to drive the seed). Returns the gap id + its unique title.
 */
async function seedApprovedRoadmap(params: {
  retailerId: string;
  customerId: string;
  staffId: string;
  productId: string;
  title: string;
  gapTitle: string;
}): Promise<{ id: string; gapId: string; gapTitle: string }> {
  const client = admin();
  const { data: productRow } = await client
    .from("products")
    .select("name")
    .eq("id", params.productId)
    .single();
  const productName = productRow?.name ?? "Fixture product";

  const approvedRules = await new SartorialRuleRepository(
    client,
  ).listApprovedForRetailer(asId<"RetailerId">(params.retailerId));
  const rule = approvedRules[0] ?? NEUTRAL_SARTORIAL_RULE_FIXTURES[0]!;

  const roadmapRepo = new WardrobeRoadmapRepository(client);
  const roadmap = await roadmapRepo.createDraft(
    {
      retailerId: params.retailerId,
      customerId: params.customerId,
      title: params.title,
      horizonLabel: "12 months",
      goals: [{ title: "Build a stronger wardrobe core", displayOrder: 0 }],
      gaps: [
        {
          title: params.gapTitle,
          rank: 1,
          slotKind: "jacket",
          // The wardrobe rails bucket open gaps by categoryCode; without it
          // the advisor-selection card matches no rail and never renders.
          categoryCode: "jacket",
          howPurchaseFillsGap: "Anchors client-facing looks.",
        },
      ],
      stages: [
        {
          title: "Stage 1 — jacket",
          stageOrder: 1,
          gapIndex: 0,
          suggestedProductId: params.productId,
          explanation: `Prioritise ${productName} to fill the jacket gap.`,
          ruleCitations: [
            {
              ruleId: rule.id,
              ruleTitle: rule.title,
              relation: rule.relation,
              explanation: rule.explanation,
            },
          ],
          factCitations: [
            {
              sourceKind: "catalogue_product",
              sourceId: params.productId,
              label: productName,
              detail: "Catalogue jacket suggested to fill the gap",
            },
          ],
        },
      ],
    },
    asId<"StaffId">(params.staffId),
  );

  await roadmapRepo.transition(
    { roadmapId: roadmap.id, action: "submit_for_approval" },
    {
      kind: "advisor",
      retailerId: asId<"RetailerId">(params.retailerId),
      role: "owner",
    },
  );
  await roadmapRepo.transition(
    { roadmapId: roadmap.id, action: "approve" },
    {
      kind: "customer",
      customerId: asId<"CustomerId">(params.customerId),
      retailerId: asId<"RetailerId">(params.retailerId),
    },
  );

  const gapId = roadmap.gaps[0]?.id;
  if (!gapId) throw new Error("seed produced no gap");
  return { id: roadmap.id, gapId, gapTitle: params.gapTitle };
}

async function cleanup(roadmapId: string): Promise<void> {
  const client = admin();
  await client
    .from("wardrobe_roadmap_gap_dispositions")
    .delete()
    .eq("roadmap_id", roadmapId);
  await client
    .from("wardrobe_roadmap_stages")
    .delete()
    .eq("roadmap_id", roadmapId);
  await client
    .from("wardrobe_roadmap_gaps")
    .delete()
    .eq("roadmap_id", roadmapId);
  await client
    .from("wardrobe_roadmap_goals")
    .delete()
    .eq("roadmap_id", roadmapId);
  await client.from("wardrobe_roadmaps").delete().eq("id", roadmapId);
}

async function dispositionRows(gapId: string) {
  const { data } = await admin()
    .from("wardrobe_roadmap_gap_dispositions")
    .select("disposition, customer_id, retailer_id, roadmap_gap_id, roadmap_id")
    .eq("roadmap_gap_id", gapId);
  return data ?? [];
}

for (const [viewport, kind] of [
  [{ width: 1512, height: 982 }, "desktop"],
  [{ width: 390, height: 844 }, "mobile"],
] as const) {
  test(`customer removes an advisor selection from their wardrobe plan — ${kind}`, async ({
    page,
  }, testInfo) => {
    const evidenceDir = resolve(testInfo.config.rootDir, EVIDENCE_SUBPATH);
    await mkdir(evidenceDir, { recursive: true });

    const consoleErrors = attachUnfilteredConsole(page);
    const { retailerId, customerId, staffId, productId } =
      await resolveIdentity();

    const stamp = `${kind}-${Date.now()}`;
    const seeded = await seedApprovedRoadmap({
      retailerId,
      customerId,
      staffId,
      productId,
      title: `E2E Wardrobe Removal ${stamp}`,
      gapTitle: `Advisor selection ${stamp}`,
    });

    const card = page
      .locator("article", {
        has: page.getByText("Advisor selection", { exact: true }),
      })
      .filter({ has: page.getByText(seeded.gapTitle) });

    try {
      await page.setViewportSize(viewport);
      await signIn(page);

      const response = await page.goto("/wardrobe", {
        waitUntil: "networkidle",
      });
      expect(response?.status()).toBe(200);

      await expect(card).toBeVisible();
      await page.screenshot({
        path: resolve(evidenceDir, `${kind}-advisor-card.png`),
        fullPage: true,
      });

      // --- Cancel path: confirmation is required and Cancel is a no-op ---
      await card.getByRole("button", { name: "Actions +" }).click();
      await card
        .getByRole("button", { name: "Remove from wardrobe plan" })
        .click();
      await expect(
        card.getByRole("button", { name: "Confirm removal" }),
      ).toBeVisible();
      await page.screenshot({
        path: resolve(evidenceDir, `${kind}-remove-confirm.png`),
        fullPage: true,
      });

      await card.getByRole("button", { name: "Cancel" }).click();
      await card.getByRole("button", { name: "Close" }).click();
      await expect(card).toBeVisible();
      expect(await dispositionRows(seeded.gapId)).toEqual([]);
      await page.screenshot({
        path: resolve(evidenceDir, `${kind}-cancel-kept.png`),
        fullPage: true,
      });

      // --- Confirm path: real removal, real customer session ---
      await card.getByRole("button", { name: "Actions +" }).click();
      await card
        .getByRole("button", { name: "Remove from wardrobe plan" })
        .click();
      await card.getByRole("button", { name: "Confirm removal" }).click();

      await expect
        .poll(async () => dispositionRows(seeded.gapId))
        .toEqual([
          {
            disposition: "removed_from_plan",
            customer_id: customerId,
            retailer_id: retailerId,
            roadmap_gap_id: seeded.gapId,
            roadmap_id: seeded.id,
          },
        ]);

      await expect(card).toHaveCount(0);

      // The advisor-authored plan is NOT hard-deleted.
      const client = admin();
      const { data: roadmapRow } = await client
        .from("wardrobe_roadmaps")
        .select("id, status")
        .eq("id", seeded.id)
        .single();
      expect(roadmapRow).toEqual({ id: seeded.id, status: "approved" });
      const { count: gapCount } = await client
        .from("wardrobe_roadmap_gaps")
        .select("id", { count: "exact", head: true })
        .eq("id", seeded.gapId);
      expect(gapCount).toBe(1);
      const { count: stageCount } = await client
        .from("wardrobe_roadmap_stages")
        .select("id", { count: "exact", head: true })
        .eq("roadmap_id", seeded.id);
      expect(stageCount).toBe(1);

      await page.screenshot({
        path: resolve(evidenceDir, `${kind}-removed.png`),
        fullPage: true,
      });

      // --- Persistence: still gone after a full reload ---
      const reload = await page.goto("/wardrobe", { waitUntil: "networkidle" });
      expect(reload?.status()).toBe(200);
      await expect(card).toHaveCount(0);
      await page.screenshot({
        path: resolve(evidenceDir, `${kind}-removed-after-reload.png`),
        fullPage: true,
      });

      expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
    } finally {
      await cleanup(seeded.id);
    }
  });
}
