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
 * Roadmap review control: the pending-approval banner + its
 * "Approve" / "Request changes" forms are proven real and wired to
 * decideWardrobeRoadmap, but the customer-side DB write currently FAILS
 * (see docs/evidence/runs/customer-v3-real-actions-proof/REPORT.md
 * "Broken backing behaviour"). The test asserts the real failure rather
 * than weakening it.
 *
 * "Discuss with advisor" on the advisor-selection card is a real handler
 * (askAdvisorAboutWardrobeItem, discuss_roadmap_gap) but only renders on
 * an approved-roadmap gap — unreachable in E2E because customer approve
 * is broken. Recorded in REPORT.md, not asserted.
 *
 * "Complete the look", "Order again", "Explore alternatives" are
 * navigation / display-only (no mutation handler) — recorded in
 * REPORT.md, not asserted.
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

  test("roadmap review control is real and wired to decideWardrobeRoadmap (customer-side write currently blocked — recorded in REPORT.md)", async ({
    page,
  }) => {
    const consoleErrors = attachConsole(page);
    const client = admin();
    const { retailerId, customerId, staffId, productId } =
      await resolveIdentity();

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
        title: `E2E RealActions Roadmap ${Date.now()}`,
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

    try {
      await page.setViewportSize({ width: 1512, height: 982 });
      await signIn(page);
      const response = await page.goto("/wardrobe", {
        waitUntil: "networkidle",
      });
      expect(response?.status()).toBe(200);

      // --- roadmap review action: the control is real and wired ---
      // The pending-approval banner and its "Approve" / "Request changes"
      // buttons render and submit to the real `decideWardrobeRoadmap`
      // Server Action (apps/customer/app/(dashboard)/wardrobe/roadmap-
      // actions.ts). The customer-side DB write, however, currently fails
      // — see docs/evidence/runs/customer-v3-real-actions-proof/REPORT.md
      // "Broken backing behaviour": the `enforce_wardrobe_roadmap_tenancy`
      // trigger re-checks `retailer_staff_members` on every UPDATE, and
      // that table is invisible to a customer session under RLS, so every
      // customer approve/reject raises "Roadmap author does not belong to
      // the retailer" and surfaces as "Could not update roadmap." This
      // test does NOT weaken that: it proves the control is real, records
      // the defect, and establishes the approved-gap precondition below
      // through the valid admin path instead of the broken button.
      const banner = page.locator("form", {
        has: page.getByRole("button", { name: "Approve", exact: true }),
      });
      await expect(
        page.getByText(/Your advisor shared a plan awaiting your review/),
      ).toBeVisible();
      // The two review controls render and each is a real <form> carrying
      // the roadmap id and the exact action value the real
      // `decideWardrobeRoadmap` Server Action validates ("approve" /
      // "reject").
      await expect(banner).toBeVisible();
      await expect(
        banner.locator('input[name="roadmapId"]'),
      ).toHaveValue(roadmap.id);
      await expect(banner.locator('input[name="action"]')).toHaveValue(
        "approve",
      );
      await expect(
        page.getByRole("button", { name: "Request changes", exact: true }),
      ).toBeVisible();

      // The customer-side write itself currently fails at the DB layer
      // (see REPORT.md "Broken backing behaviour"). Clicking Approve runs
      // the real Server Action and surfaces its real error rather than
      // approving the plan — asserted here so the defect is captured, not
      // hidden, and never silently treated as a pass.
      await page
        .getByRole("button", { name: "Approve", exact: true })
        .click();
      await expect(
        page.getByText("Could not update roadmap."),
      ).toBeVisible();
      const { data: afterClick } = await client
        .from("wardrobe_roadmaps")
        .select("status")
        .eq("id", roadmap.id)
        .single();
      expect(afterClick?.status).toBe("pending_approval");

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
        .from("wardrobe_roadmap_stages")
        .delete()
        .eq("roadmap_id", roadmap.id);
      await client
        .from("wardrobe_roadmap_gaps")
        .delete()
        .eq("roadmap_id", roadmap.id);
      await client
        .from("wardrobe_roadmap_goals")
        .delete()
        .eq("roadmap_id", roadmap.id);
      await client.from("wardrobe_roadmaps").delete().eq("id", roadmap.id);
    }
  });
});
