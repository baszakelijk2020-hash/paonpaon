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
 * Dedicated proof for the roadmap-approval RLS repair
 * (branch agent/c2-roadmap-approval-rls,
 * supabase/migrations/20260828155029_fix_wardrobe_roadmap_tenancy_update_author_recheck.sql).
 *
 * Before this fix: `enforce_wardrobe_roadmap_tenancy()` re-ran a
 * `retailer_staff_members` lookup on every UPDATE, which a customer
 * session cannot read under RLS — every customer approve/reject failed
 * with "Could not update roadmap." (proven broken by
 * release-integration-lane-h @ ee33970's wardrobe-real-actions-v3.spec.ts).
 *
 * After this fix: the lookup runs only on INSERT. This spec proves, through
 * the real authenticated customer UI at desktop 1512x982 and mobile
 * 390x844, that approval and request-changes both now succeed, with a
 * real DB postcondition inspected via the service-role client — which is
 * used ONLY to seed/clean fixtures and read postconditions, never to
 * perform the mutation itself. No console error is filtered — not React
 * #418, not weather/camera noise, nothing.
 */

const EVIDENCE_SUBPATH =
  "../../../docs/evidence/runs/customer-v3-roadmap-approval-rls";

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

async function seedPendingRoadmap(params: {
  retailerId: string;
  customerId: string;
  staffId: string;
  productId: string;
  title: string;
}): Promise<{ id: string }> {
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
          title: "Missing jacket",
          rank: 1,
          slotKind: "jacket",
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
  return { id: roadmap.id };
}

async function cleanupRoadmap(roadmapId: string): Promise<void> {
  const client = admin();
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

for (const [viewport, kind] of [
  [{ width: 1512, height: 982 }, "desktop"],
  [{ width: 390, height: 844 }, "mobile"],
] as const) {
  test(`customer approves a pending roadmap through the real UI — ${kind}`, async ({
    page,
  }, testInfo) => {
    const evidenceDir = resolve(testInfo.config.rootDir, EVIDENCE_SUBPATH);
    await mkdir(evidenceDir, { recursive: true });

    const consoleErrors = attachUnfilteredConsole(page);
    const { retailerId, customerId, staffId, productId } =
      await resolveIdentity();

    const roadmap = await seedPendingRoadmap({
      retailerId,
      customerId,
      staffId,
      productId,
      title: `E2E Roadmap Approval RLS ${kind} ${Date.now()}`,
    });

    try {
      await page.setViewportSize(viewport);
      await signIn(page);

      const response = await page.goto("/wardrobe", {
        waitUntil: "networkidle",
      });
      expect(response?.status()).toBe(200);

      const banner = page.locator("form", {
        has: page.getByRole("button", { name: "Approve", exact: true }),
      });
      await expect(
        page.getByText(/Your advisor shared a plan awaiting your review/),
      ).toBeVisible();
      await expect(banner.locator('input[name="roadmapId"]')).toHaveValue(
        roadmap.id,
      );

      await page.screenshot({
        path: resolve(evidenceDir, `${kind}-pending-banner.png`),
        fullPage: true,
      });

      // Real click, real authenticated customer session.
      await page.getByRole("button", { name: "Approve", exact: true }).click();

      // DB postcondition, read via service role — inspection only.
      await expect
        .poll(async () => {
          const client = admin();
          const { data } = await client
            .from("wardrobe_roadmaps")
            .select(
              "status, decided_by_actor, decided_at, customer_id, retailer_id",
            )
            .eq("id", roadmap.id)
            .single();
          return data;
        })
        .toEqual(
          expect.objectContaining({
            status: "approved",
            decided_by_actor: "customer",
            customer_id: customerId,
            retailer_id: retailerId,
          }),
        );
      const { data: approvedRow } = await admin()
        .from("wardrobe_roadmaps")
        .select("decided_at")
        .eq("id", roadmap.id)
        .single();
      expect(approvedRow?.decided_at).not.toBeNull();

      // The banner is gone — no stale "awaiting your review" for a roadmap
      // that is no longer pending.
      await page.waitForTimeout(500);
      let bannerGone = (await banner.count()) === 0;
      if (!bannerGone) {
        const reload = await page.goto("/wardrobe", {
          waitUntil: "networkidle",
        });
        expect(reload?.status()).toBe(200);
        bannerGone = (await banner.count()) === 0;
      }
      expect(bannerGone).toBe(true);
      await expect(
        page.getByText(/Your advisor shared a plan awaiting your review/),
      ).toHaveCount(0);

      await page.screenshot({
        path: resolve(evidenceDir, `${kind}-approved-banner-gone.png`),
        fullPage: true,
      });

      // Zero console/page errors — nothing filtered.
      expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
    } finally {
      await cleanupRoadmap(roadmap.id);
    }
  });

  test(`customer requests changes on a pending roadmap through the real UI — ${kind}`, async ({
    page,
  }, testInfo) => {
    const evidenceDir = resolve(testInfo.config.rootDir, EVIDENCE_SUBPATH);
    await mkdir(evidenceDir, { recursive: true });

    const consoleErrors = attachUnfilteredConsole(page);
    const { retailerId, customerId, staffId, productId } =
      await resolveIdentity();

    const roadmap = await seedPendingRoadmap({
      retailerId,
      customerId,
      staffId,
      productId,
      title: `E2E Roadmap Reject RLS ${kind} ${Date.now()}`,
    });

    try {
      await page.setViewportSize(viewport);
      await signIn(page);

      const response = await page.goto("/wardrobe", {
        waitUntil: "networkidle",
      });
      expect(response?.status()).toBe(200);

      const banner = page.locator("form", {
        has: page.getByRole("button", { name: "Approve", exact: true }),
      });
      await expect(banner.locator('input[name="roadmapId"]')).toHaveValue(
        roadmap.id,
      );
      const requestChanges = page.getByRole("button", {
        name: "Request changes",
        exact: true,
      });
      await expect(requestChanges).toBeVisible();

      // The rendered "Request changes" control is a bare submit button —
      // there is no note/reason input anywhere in its form
      // (apps/customer/app/(dashboard)/wardrobe/wardrobe-panel.tsx). This
      // is the complete real action a customer can take today; no note is
      // fabricated. Recorded in
      // docs/evidence/runs/customer-v3-roadmap-approval-rls/REPORT.md.
      await requestChanges.click();

      await expect
        .poll(async () => {
          const client = admin();
          const { data } = await client
            .from("wardrobe_roadmaps")
            .select(
              "status, decided_by_actor, customer_decision_note, customer_id, retailer_id",
            )
            .eq("id", roadmap.id)
            .single();
          return data;
        })
        .toEqual(
          expect.objectContaining({
            status: "rejected",
            decided_by_actor: "customer",
            customer_decision_note: null,
            customer_id: customerId,
            retailer_id: retailerId,
          }),
        );

      await page.screenshot({
        path: resolve(evidenceDir, `${kind}-rejected.png`),
        fullPage: true,
      });

      expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
    } finally {
      await cleanupRoadmap(roadmap.id);
    }
  });
}
