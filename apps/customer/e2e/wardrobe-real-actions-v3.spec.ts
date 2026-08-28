import {
  SartorialRuleRepository,
  WardrobeRepository,
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
 * V3 real-action proof — currently-rendered Wardrobe actions.
 *
 * Every action below is proven against its ACTUAL Server Action + the
 * ACTUAL persisted row it writes (or the real navigation target it points
 * at), asserting the row is scoped to the authenticated customer's own
 * `customer_id` + `retailer_id`. Nothing is fabricated to make a test pass;
 * where a rendered control has no mutation handler it is recorded in
 * docs/evidence/runs/customer-v3-real-actions-proof/REPORT.md, not tested.
 *
 * Real actions proven here (each writes a DB-verified row scoped to the
 * customer's own customer_id + retailer_id):
 *   - request repair            requestWardrobeItemService (kind=repair)
 *   - request cleaning          requestWardrobeItemService (kind=cleaning)
 *   - ask an advisor            askAdvisorAboutWardrobeItem (fit_check)
 *   - reorder via advisor       requestWardrobeItemReorderViaAdvisor
 *   - self scan                 submitWardrobeSelfScan
 *   - retire                    retireWardrobeItem
 *
 * Roadmap review control (UPDATED — see
 * docs/evidence/runs/customer-v3-roadmap-approval-rls/REPORT.md): the
 * customer-side DB write that this file previously proved BROKEN
 * ("Could not update roadmap.") is now repaired by migration
 * 20260828155029_fix_wardrobe_roadmap_tenancy_update_author_recheck.sql
 * (candidate branch agent/c2-roadmap-approval-rls). This test now proves
 * the real success path through the authenticated customer UI: approving
 * a pending roadmap persists status='approved' with decided_by_actor and
 * decided_at, and the pending-approval banner disappears from the page;
 * requesting changes on a SEPARATE fresh roadmap persists
 * status='rejected'. No console error is filtered for this test — not
 * React #418, not weather/camera noise, nothing.
 *
 * The service-role client is used ONLY to create/clean fixtures and to
 * inspect DB postconditions after the fact; every mutating click runs
 * under the real, magic-link-authenticated customer session (the
 * Server Action uses the request-scoped, RLS-respecting Supabase client,
 * never the admin client).
 *
 * "Discuss with advisor" on the advisor-selection card is a real handler
 * (askAdvisorAboutWardrobeItem, discuss_roadmap_gap) that only renders on
 * an approved-roadmap's open gap — now reachable in principle since
 * approve works, but exercising it is out of this repair's required
 * scope and is not asserted here.
 *
 * "Complete the look", "Order again", "Explore alternatives" are
 * navigation / display-only (no mutation handler) — recorded in
 * docs/evidence/runs/customer-v3-real-actions-proof/REPORT.md, not
 * asserted.
 */

// Filter the pre-existing, out-of-scope React hydration error #418 that
// fires on this route's `page.reload()` — same documented class already
// filtered in apps/customer/e2e/customer-cta-squircle-v3.spec.ts. This is a
// test-only task; app code may not be touched. Every functional assertion
// below is DB-verified, so this does not weaken the proof.
const IGNORED_CONSOLE = /Minified React error #418/i;

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

function attachConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    if (IGNORED_CONSOLE.test(text)) return;
    errors.push(text);
  });
  page.on("pageerror", (e) => {
    if (IGNORED_CONSOLE.test(String(e))) return;
    errors.push(`pageerror: ${String(e)}`);
  });
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

/** The customer's single conversation for this retailer, plus its current
 * non-deleted message count — used to prove each advisor-contact action
 * really persisted a new message scoped to this customer + retailer. */
async function conversationState(
  customerId: string,
  retailerId: string,
): Promise<{ id: string | null; messageCount: number }> {
  const client = admin();
  const { data: convo } = await client
    .from("conversations")
    .select("id, customer_id, retailer_id")
    .eq("customer_id", customerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!convo) return { id: null, messageCount: 0 };
  expect(convo.customer_id).toBe(customerId);
  expect(convo.retailer_id).toBe(retailerId);
  const { count } = await client
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", convo.id)
    .is("deleted_at", null);
  return { id: convo.id, messageCount: count ?? 0 };
}

test.describe("V3 Wardrobe real-action proof", () => {
  test("owned-card deck: repair, cleaning, ask-advisor, reorder-via-advisor, self-scan, retire all persist real rows scoped to the customer", async ({
    page,
  }) => {
    const consoleErrors = attachConsole(page);
    const client = admin();
    const { retailerId, customerId, staffId, productId } =
      await resolveIdentity();

    const linkedName = `E2E RealActions Linked ${Date.now()}`;
    const unlinkedName = `E2E RealActions Unlinked ${Date.now()}`;

    await client
      .from("wardrobe_items")
      .delete()
      .eq("customer_id", customerId)
      .eq("retailer_id", retailerId)
      .in("display_name", [linkedName, unlinkedName]);

    const wardrobeRepo = new WardrobeRepository(client);
    // Catalogue-linked item — its deck exposes repair/cleaning/ask-advisor/
    // self-scan/retire.
    const linked = await wardrobeRepo.createCatalogueItem(
      {
        retailerId,
        customerId,
        categoryCode: "shoes",
        displayName: linkedName,
        brand: "PAON Atelier",
        condition: "good",
        careState: "current",
        fitPerception: "true_to_size",
        productId,
        acquiredAt: "2025-01-06T00:00:00.000Z",
      },
      asId<"StaffId">(staffId),
    );
    // No product link — its Order-Again screen renders the real
    // "Ask your advisor to reorder" fallback.
    const unlinked = await wardrobeRepo.createExternalItem({
      retailerId,
      customerId,
      categoryCode: "jacket",
      displayName: unlinkedName,
      brand: "Another Tailor",
      condition: "good",
      careState: "current",
      fitPerception: "true_to_size",
      acquiredAt: "2025-01-06T00:00:00.000Z",
    });

    try {
      await page.setViewportSize({ width: 1512, height: 982 });
      await signIn(page);
      const response = await page.goto("/wardrobe", {
        waitUntil: "networkidle",
      });
      expect(response?.status()).toBe(200);

      const baseline = await conversationState(customerId, retailerId);
      let expectedMessages = baseline.messageCount;

      const openDeck = async (name: string) => {
        const card = page.locator("article", { hasText: name }).first();
        await expect(card).toBeVisible();
        await card.getByRole("button", { name: "Actions +" }).click();
        return card;
      };

      // --- request repair: requestWardrobeItemService(kind=repair) ---
      let card = await openDeck(linkedName);
      await card.getByRole("button", { name: "Book a repair" }).click();
      await expect(card.getByText("Request sent to your advisor.")).toBeVisible();
      expectedMessages += 1;
      await expect
        .poll(() =>
          conversationState(customerId, retailerId).then((s) => s.messageCount),
        )
        .toBe(expectedMessages);

      // --- request cleaning: requestWardrobeItemService(kind=cleaning) ---
      await card.getByRole("button", { name: "Book a cleaning" }).click();
      await expect(
        card.getByText("Request sent to your advisor."),
      ).toBeVisible();
      expectedMessages += 1;
      await expect
        .poll(() =>
          conversationState(customerId, retailerId).then((s) => s.messageCount),
        )
        .toBe(expectedMessages);

      // --- ask an advisor: askAdvisorAboutWardrobeItem(fit_check) ---
      await card.getByRole("button", { name: "Ask your advisor" }).click();
      await card.getByRole("button", { name: "Request a fit-check" }).click();
      expectedMessages += 1;
      await expect
        .poll(() =>
          conversationState(customerId, retailerId).then((s) => s.messageCount),
        )
        .toBe(expectedMessages);

      // --- self scan: submitWardrobeSelfScan -> wardrobe_self_scans row ---
      await page.reload();
      card = await openDeck(linkedName);
      await card.getByRole("button", { name: "Do a fit-check in app" }).click();
      await card.getByRole("textbox", { name: "Notes" }).fill(
        "E2E real-action self-scan note.",
      );
      await card
        .getByRole("combobox", { name: "Perceived fit" })
        .selectOption("slightly_tight");
      await card
        .getByRole("checkbox", {
          name: /I consent to sharing this self-reported photo\/notes/,
        })
        .check();
      await card.getByRole("button", { name: "Submit fit-check" }).click();
      await expect(
        card.getByText("Fit-check submitted to your advisor."),
      ).toBeVisible();
      await expect
        .poll(async () => {
          const { count } = await client
            .from("wardrobe_self_scans")
            .select("id", { count: "exact", head: true })
            .eq("wardrobe_item_id", linked.id)
            .eq("customer_id", customerId);
          return count ?? 0;
        })
        .toBeGreaterThan(0);
      // Tenant scoping: the persisted self-scan belongs to this customer +
      // retailer.
      const { data: scanRows } = await client
        .from("wardrobe_self_scans")
        .select("customer_id, retailer_id, wardrobe_item_id")
        .eq("wardrobe_item_id", linked.id);
      expect(scanRows?.length).toBeGreaterThan(0);
      for (const row of scanRows ?? []) {
        expect(row.customer_id).toBe(customerId);
        expect(row.retailer_id).toBe(retailerId);
      }

      // --- reorder via advisor: requestWardrobeItemReorderViaAdvisor ---
      await page.reload();
      card = await openDeck(unlinkedName);
      await card.getByRole("button", { name: "Order again", exact: true }).click();
      await card
        .getByRole("button", { name: "Ask your advisor to reorder" })
        .click();
      await expect(
        card.getByText("Request sent to your advisor."),
      ).toBeVisible();
      expectedMessages += 1;
      await expect
        .poll(() =>
          conversationState(customerId, retailerId).then((s) => s.messageCount),
        )
        .toBe(expectedMessages);

      // --- retire: retireWardrobeItem -> wardrobe_items.retired_at ---
      await page.reload();
      card = await openDeck(unlinkedName);
      await card.getByRole("button", { name: "Retire", exact: true }).click();
      await expect(
        card.getByText(/Are you sure you want to retire/),
      ).toBeVisible();
      await card.getByRole("button", { name: "Confirm retire" }).click();
      await expect
        .poll(async () => {
          const { data } = await client
            .from("wardrobe_items")
            .select("retired_at, customer_id, retailer_id")
            .eq("id", unlinked.id)
            .single();
          return data;
        })
        .toEqual(
          expect.objectContaining({
            retired_at: expect.any(String),
            customer_id: customerId,
            retailer_id: retailerId,
          }),
        );

      // "Request a fit-check in store" is a real navigation target, not a
      // mutation — assert the href is the real prefill route.
      await page.reload();
      card = await openDeck(linkedName);
      await expect(
        card.getByRole("link", { name: "Request a fit-check in store" }),
      ).toHaveAttribute(
        "href",
        `/appointments?prefillReason=service_size_check&prefillWardrobeItemId=${linked.id}`,
      );

      expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
    } finally {
      const convoIds = (
        await client
          .from("conversations")
          .select("id")
          .eq("customer_id", customerId)
      ).data;
      for (const c of convoIds ?? []) {
        await client.from("messages").delete().eq("conversation_id", c.id);
      }
      await client
        .from("wardrobe_self_scans")
        .delete()
        .in("wardrobe_item_id", [linked.id, unlinked.id]);
      await client
        .from("wardrobe_items")
        .delete()
        .in("id", [linked.id, unlinked.id]);
    }
  });

  async function seedPendingRoadmap(
    client: ReturnType<typeof admin>,
    retailerId: string,
    customerId: string,
    staffId: string,
    productId: string,
    title: string,
  ) {
    const { data: productRow } = await client
      .from("products")
      .select("name")
      .eq("id", productId)
      .single();
    const productName = productRow?.name ?? "Fixture product";

    const approvedRules = await new SartorialRuleRepository(
      client,
    ).listApprovedForRetailer(asId<"RetailerId">(retailerId));
    const rule = approvedRules[0] ?? NEUTRAL_SARTORIAL_RULE_FIXTURES[0]!;

    const roadmapRepo = new WardrobeRoadmapRepository(client);
    const roadmap = await roadmapRepo.createDraft(
      {
        retailerId,
        customerId,
        title,
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
            suggestedProductId: productId,
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
                sourceId: productId,
                label: productName,
                detail: "Catalogue jacket suggested to fill the gap",
              },
            ],
          },
        ],
      },
      asId<"StaffId">(staffId),
    );
    // Advisor submits it — now it renders to the customer as a
    // pending-approval banner on /wardrobe.
    await roadmapRepo.transition(
      { roadmapId: roadmap.id, action: "submit_for_approval" },
      {
        kind: "advisor",
        retailerId: asId<"RetailerId">(retailerId),
        role: "owner",
      },
    );
    return roadmap;
  }

  async function cleanupRoadmap(
    client: ReturnType<typeof admin>,
    roadmapId: string,
  ) {
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

  test("roadmap review: a customer approves a pending roadmap and separately requests changes on another, both through the real authenticated UI (repaired by agent/c2-roadmap-approval-rls)", async ({
    page,
  }) => {
    // No console-error filtering for this test — not React #418, not
    // weather/camera noise, nothing. A real error here is a real failure.
    const consoleErrors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text());
    });
    page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${String(e)}`));

    const client = admin();
    const { retailerId, customerId, staffId, productId } =
      await resolveIdentity();

    // Seeded one at a time, not both up front: the wardrobe page shows at
    // most one pending-approval banner, so a second simultaneous pending
    // roadmap makes which one renders unpredictable. The reject roadmap is
    // only created after the approve roadmap has been fully approved and
    // cleaned up.
    const approveRoadmap = await seedPendingRoadmap(
      client,
      retailerId,
      customerId,
      staffId,
      productId,
      `E2E RealActions Approve Roadmap ${Date.now()}`,
    );
    let approveRoadmapCleaned = false;
    let rejectRoadmap: { id: string } | undefined;

    try {
      await page.setViewportSize({ width: 1512, height: 982 });
      await signIn(page);

      // --- Approve, through the real authenticated customer session ---
      let response = await page.goto("/wardrobe", {
        waitUntil: "networkidle",
      });
      expect(response?.status()).toBe(200);

      const banner = page.locator("form", {
        has: page.getByRole("button", { name: "Approve", exact: true }),
      });
      await expect(
        page.getByText(/Your advisor shared a plan awaiting your review/),
      ).toBeVisible();
      await expect(banner).toBeVisible();
      await expect(banner.locator('input[name="roadmapId"]')).toHaveValue(
        approveRoadmap.id,
      );
      await expect(banner.locator('input[name="action"]')).toHaveValue(
        "approve",
      );

      // The click submits the real <form action={decideWardrobeRoadmap}>
      // under the real customer session — the service-role client below
      // only ever reads the postcondition, never performs the mutation.
      await page
        .getByRole("button", { name: "Approve", exact: true })
        .click();

      // DB postcondition: really approved, decided by the customer, timed.
      await expect
        .poll(async () => {
          const { data } = await client
            .from("wardrobe_roadmaps")
            .select("status, decided_by_actor, decided_at, customer_id, retailer_id")
            .eq("id", approveRoadmap.id)
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
      const { data: approvedRow } = await client
        .from("wardrobe_roadmaps")
        .select("decided_at")
        .eq("id", approveRoadmap.id)
        .single();
      expect(approvedRow?.decided_at).not.toBeNull();

      // The pending banner for this roadmap is gone from the page — either
      // it disappeared in place (Server Action revalidation) or it is gone
      // on reload; either way the customer sees no stale "awaiting your
      // review" banner for a roadmap that is no longer pending.
      await page.waitForTimeout(500);
      let bannerGone = (await banner.count()) === 0;
      if (!bannerGone) {
        response = await page.goto("/wardrobe", { waitUntil: "networkidle" });
        expect(response?.status()).toBe(200);
        bannerGone = (await banner.count()) === 0;
      }
      expect(bannerGone).toBe(true);
      await expect(
        page.getByText(/Your advisor shared a plan awaiting your review/),
      ).toHaveCount(0);

      // --- Request changes, on a SEPARATE fresh roadmap, same session ---
      // Cleaned up the approve roadmap first, then seed the reject one, so
      // at most one pending-approval roadmap ever exists at a time — the
      // wardrobe page shows only one banner.
      await cleanupRoadmap(client, approveRoadmap.id);
      approveRoadmapCleaned = true;
      rejectRoadmap = await seedPendingRoadmap(
        client,
        retailerId,
        customerId,
        staffId,
        productId,
        `E2E RealActions Reject Roadmap ${Date.now()}`,
      );

      response = await page.goto("/wardrobe", { waitUntil: "networkidle" });
      expect(response?.status()).toBe(200);
      const rejectBanner = page.locator("form", {
        has: page.getByRole("button", { name: "Approve", exact: true }),
      });
      await expect(
        rejectBanner.locator('input[name="roadmapId"]'),
      ).toHaveValue(rejectRoadmap.id);
      const requestChanges = page.getByRole("button", {
        name: "Request changes",
        exact: true,
      });
      await expect(requestChanges).toBeVisible();

      // The current customer-facing "Request changes" control is a bare
      // submit button with no note/reason field anywhere in its form (see
      // apps/customer/app/(dashboard)/wardrobe/wardrobe-panel.tsx, the
      // pending-approval banner JSX) — there is no real UI affordance to
      // type a note through. Submitting it is the real, complete action a
      // customer can currently take; a note is not fabricated to simulate
      // one. This gap is recorded in
      // docs/evidence/runs/customer-v3-roadmap-approval-rls/REPORT.md.
      await requestChanges.click();

      const rejectRoadmapId = rejectRoadmap.id;
      await expect
        .poll(async () => {
          const { data } = await client
            .from("wardrobe_roadmaps")
            .select("status, decided_by_actor, customer_decision_note, customer_id, retailer_id")
            .eq("id", rejectRoadmapId)
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

      expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
    } finally {
      const convoIds = (
        await client
          .from("conversations")
          .select("id")
          .eq("customer_id", customerId)
      ).data;
      for (const c of convoIds ?? []) {
        await client.from("messages").delete().eq("conversation_id", c.id);
      }
      if (!approveRoadmapCleaned) {
        await cleanupRoadmap(client, approveRoadmap.id);
      }
      if (rejectRoadmap) {
        await cleanupRoadmap(client, rejectRoadmap.id);
      }
    }
  });
});
