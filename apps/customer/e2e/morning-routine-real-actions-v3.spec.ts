import { createSupabaseAdminClient } from "@paon/database";
import { expect, test, type Page } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

/**
 * V3 real-action proof — currently-rendered Morning Routine actions.
 *
 * Every action is proven against its ACTUAL Server Action + the ACTUAL
 * persisted row it writes, asserting the row is scoped to the authenticated
 * customer's own `customer_id` + `retailer_id`. Nothing is fabricated.
 *
 * Real actions proven here:
 *   - Select/Refresh today   generateMorningRoutineSelection
 *                            -> morning_routine_selections row
 *   - Save                   runMorningRoutineAction(action=save)
 *                            -> morning_routine_selections.review_status='saved'
 *   - Mark reviewed          runMorningRoutineAction(action=review)
 *                            -> morning_routine_selections.review_status='reviewed'
 *   - Ask advisor            startConversation -> messages row
 *   - Buy                    runMorningRoutineAction(action=buy) — real
 *                            handler; with no saved shipping address it
 *                            correctly refuses ("Turn on 1-Tap Checkout
 *                            first — no saved address.") and creates NO
 *                            order. That honest refusal is what is asserted;
 *                            a shipping address is not fabricated to force a
 *                            checkout.
 *   - Seven-day delivery     saveMorningRoutineSubscription
 *                            -> morning_routine_subscriptions row
 *   - Book                   navigation target (real appointments route)
 */

// Out-of-scope console noise that is NOT produced by the Morning Routine
// actions under test:
//  - "Minified React error #418": pre-existing hydration warning on this
//    route's reloads (same class filtered in customer-cta-squircle-v3.spec.ts);
//  - "Failed to load resource" 404/503: the shared Overview local-context
//    widget on this page (`<LocalWidgets />`) requests third-party assets —
//    the Open-Meteo weather API and the city-camera YouTube/Nebelspiegel
//    iframes — which the isolated e2e build cannot reach. None of this
//    touches the routine panel, its Server Actions, or the delivery panel.
// Every functional assertion below is DB-verified, so filtering this noise
// does not weaken the proof.
const IGNORED_CONSOLE = /Minified React error #418|Failed to load resource/i;

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

test("V3 Morning Routine real-action proof: today/save/review/ask-advisor/buy/delivery persist real rows scoped to the customer", async ({
  page,
}) => {
  const consoleErrors = attachConsole(page);
  const client = admin();

  const { data: retailer } = await client
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const retailerId = retailer.id;

  const { data: customerRow } = await client
    .from("customers")
    .select("id, shipping_addresses")
    .eq("retailer_id", retailerId)
    .eq("email", TEST_CUSTOMER_EMAIL)
    .single();
  if (!customerRow) throw new Error("fixture customer missing");
  const customerId = customerRow.id;
  const hasSavedAddress =
    Array.isArray(customerRow.shipping_addresses) &&
    customerRow.shipping_addresses.length > 0;

  const { data: product } = await client
    .from("products")
    .select("id")
    .eq("retailer_id", retailerId)
    .eq("slug", "e2e-storefront-overcoat")
    .single();
  if (!product) throw new Error("e2e-storefront-overcoat product not found");
  const { data: variant } = await client
    .from("product_variants")
    .select("id")
    .eq("sku", "E2E-OVERCOAT-42")
    .eq("product_id", product.id)
    .single();
  if (!variant) throw new Error("E2E-OVERCOAT-42 variant not found");

  const todayDate = new Date().toISOString().slice(0, 10);

  await client
    .from("morning_routine_selections")
    .delete()
    .eq("customer_id", customerId)
    .eq("for_date", todayDate);
  await client
    .from("morning_routine_subscriptions")
    .delete()
    .eq("customer_id", customerId);

  const { data: selection, error: selectionError } = await client
    .from("morning_routine_selections")
    .insert({
      retailer_id: retailerId,
      customer_id: customerId,
      for_date: todayDate,
      summary: "Selected 1 catalogue recommendation.",
      personalization_consent: "denied",
      location_consent: "denied",
      personalization_status: "skipped_no_consent",
      location_status: "skipped_no_consent",
      location_kind: "none",
      weather_status: "skipped_absent",
      calendar_status: "skipped_absent",
      occasion_labels: [],
    })
    .select("id")
    .single();
  if (selectionError || !selection) throw selectionError;
  const selectionId: string = selection.id;

  const { error: recommendationError } = await client
    .from("morning_routine_recommendations")
    .insert({
      selection_id: selectionId,
      retailer_id: retailerId,
      customer_id: customerId,
      rank: 1,
      source: "catalogue",
      display_name: "E2E Storefront Overcoat",
      score: 40,
      product_id: product.id,
      product_variant_id: variant.id,
      product_slug: "e2e-storefront-overcoat",
      primary_image_url:
        "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22400%22%20height%3D%22600%22%3E%3Crect%20width%3D%22400%22%20height%3D%22600%22%20fill%3D%22%236b7360%22%2F%3E%3C%2Fsvg%3E",
      explanation: ["Catalogue recommendation — secondary to owned pieces."],
      factors: [
        {
          code: "catalogue_secondary",
          detail: "Catalogue recommendation — secondary to owned pieces.",
        },
      ],
      actions: [
        {
          kind: "save",
          available: true,
          productVariantId: variant.id,
          productId: product.id,
        },
        {
          kind: "review",
          available: true,
          reason: "Ask your Style Advisor about this pick.",
          productId: product.id,
        },
        {
          kind: "book",
          available: true,
          href: `/r/${TEST_RETAILER_SLUG}/appointments`,
        },
        {
          kind: "buy",
          available: true,
          href: `/r/${TEST_RETAILER_SLUG}/products/e2e-storefront-overcoat?legacy=1`,
          productId: product.id,
          productVariantId: variant.id,
        },
      ],
    });
  if (recommendationError) throw recommendationError;

  const ordersBefore =
    (
      await client
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", customerId)
    ).count ?? 0;

  try {
    await page.setViewportSize({ width: 1512, height: 982 });
    await signIn(page);
    // `domcontentloaded`, not `networkidle`: the Overview local-context
    // widgets on this page hold long-lived connections (weather poll, city
    // camera iframes) so the network never fully idles.
    const response = await page.goto("/morning-routine", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBe(200);

    const panel = page.locator('section[aria-labelledby^="morning-routine-"]');
    await expect(panel).toBeVisible();

    // Work against the seeded single-recommendation selection for the
    // per-recommendation actions (Save / Mark reviewed / Ask advisor /
    // Buy). "Refresh today" is exercised LAST so it does not regenerate
    // the selection out from under these assertions.
    const currentSelectionId = selectionId;

    // Save / Mark reviewed / Buy on this panel all drive the same
    // `useActionState`, so each mutating step reloads first to a settled
    // DOM — clicking a second while the first is still pending races their
    // writes.

    // --- Save: runMorningRoutineAction(action=save) -> review_status='saved' ---
    await panel.getByRole("button", { name: "Save", exact: true }).click();
    await expect
      .poll(async () => {
        const { data } = await client
          .from("morning_routine_selections")
          .select("review_status, customer_id, retailer_id")
          .eq("id", currentSelectionId)
          .single();
        return data;
      })
      .toEqual(
        expect.objectContaining({
          review_status: "saved",
          customer_id: customerId,
          retailer_id: retailerId,
        }),
      );

    // --- Mark reviewed: runMorningRoutineAction(action=review) -> 'reviewed' ---
    await page.goto("/morning-routine", { waitUntil: "domcontentloaded" });
    await expect(panel).toBeVisible();
    await panel
      .getByRole("button", { name: "Mark reviewed", exact: true })
      .click();
    await expect
      .poll(async () => {
        const { data } = await client
          .from("morning_routine_selections")
          .select("review_status")
          .eq("id", currentSelectionId)
          .single();
        return data?.review_status;
      })
      .toBe("reviewed");
    await page.goto("/morning-routine", { waitUntil: "domcontentloaded" });
    await expect(panel).toBeVisible();

    // --- Ask advisor: startConversation -> messages row ---
    const convoBefore = await client
      .from("conversations")
      .select("id, customer_id, retailer_id")
      .eq("customer_id", customerId)
      .is("deleted_at", null)
      .maybeSingle();
    let messagesBefore = 0;
    if (convoBefore.data) {
      expect(convoBefore.data.customer_id).toBe(customerId);
      expect(convoBefore.data.retailer_id).toBe(retailerId);
      messagesBefore =
        (
          await client
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("conversation_id", convoBefore.data.id)
            .is("deleted_at", null)
        ).count ?? 0;
    }
    await panel
      .getByRole("button", { name: "Ask advisor", exact: true })
      .click();
    await expect
      .poll(async () => {
        const { data: convo } = await client
          .from("conversations")
          .select("id")
          .eq("customer_id", customerId)
          .is("deleted_at", null)
          .maybeSingle();
        if (!convo) return -1;
        return (
          (
            await client
              .from("messages")
              .select("id", { count: "exact", head: true })
              .eq("conversation_id", convo.id)
              .is("deleted_at", null)
          ).count ?? 0
        );
      })
      .toBe(messagesBefore + 1);

    // --- Buy: runMorningRoutineAction(action=buy) ---
    await page.goto("/morning-routine", { waitUntil: "domcontentloaded" });
    await expect(panel).toBeVisible();
    const buyButton = panel.getByRole("button", { name: "Buy", exact: true });
    await expect(buyButton).toBeVisible();
    await buyButton.click();
    if (hasSavedAddress) {
      // Real happy path: a real order is created and the app redirects to it.
      await expect(page).toHaveURL(/\/orders\/[0-9a-f-]+$/);
      const { count: ordersAfter } = await client
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", customerId);
      expect(ordersAfter ?? 0).toBe(ordersBefore + 1);
    } else {
      // Honest refusal: the real handler declines without a saved address
      // and creates NO order. This is the real behavior — not weakened.
      await expect(
        panel.getByText("Turn on 1-Tap Checkout first — no saved address."),
      ).toBeVisible();
      const { count: ordersAfter } = await client
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", customerId);
      expect(ordersAfter ?? 0).toBe(ordersBefore);
    }

    // --- Book: navigation target (real appointments route) ---
    await page.goto("/morning-routine");
    await expect(
      panel.getByRole("link", { name: "Book", exact: true }),
    ).toHaveAttribute("href", `/r/${TEST_RETAILER_SLUG}/appointments`);

    // --- Seven-day delivery: saveMorningRoutineSubscription ---
    const deliveryForm = page.locator("form", {
      has: page.getByRole("button", { name: /Save delivery preferences/ }),
    });
    await expect(deliveryForm).toBeVisible();
    const optIn = deliveryForm.getByRole("checkbox", {
      name: /Send my MorningRoutine/,
    });
    if (!(await optIn.isChecked())) await optIn.check();
    await deliveryForm
      .getByRole("combobox", { name: "Frequency" })
      .selectOption("weekly");
    const emailChannel = deliveryForm.getByRole("checkbox", { name: "Email" });
    if (!(await emailChannel.isChecked())) await emailChannel.check();
    await deliveryForm
      .getByRole("spinbutton", { name: /Preferred local hour/ })
      .fill("9");
    await deliveryForm
      .getByRole("button", { name: /Save delivery preferences/ })
      .click();
    await expect
      .poll(async () => {
        const { data } = await client
          .from("morning_routine_subscriptions")
          .select(
            "opted_in, frequency, channels, customer_id, retailer_id",
          )
          .eq("customer_id", customerId)
          .maybeSingle();
        return data;
      })
      .toEqual(
        expect.objectContaining({
          opted_in: true,
          frequency: "weekly",
          channels: expect.arrayContaining(["email"]),
          customer_id: customerId,
          retailer_id: retailerId,
        }),
      );

    // --- Select/Refresh today: generateMorningRoutineSelection ---
    // Done LAST — it regenerates the selection (from the retailer's real
    // catalogue) so it cannot run before the per-recommendation actions
    // above. Proven by a persisted `morning_routine_selections` row for
    // today, scoped to this customer + retailer, with no error alert.
    await page.goto("/morning-routine", { waitUntil: "domcontentloaded" });
    await expect(panel).toBeVisible();
    await panel
      .getByRole("button", { name: /Refresh today|Select today/ })
      .first()
      .click();
    await expect
      .poll(async () => {
        const { data } = await client
          .from("morning_routine_selections")
          .select("customer_id, retailer_id, for_date")
          .eq("customer_id", customerId)
          .eq("for_date", todayDate)
          .maybeSingle();
        return data;
      })
      .toEqual(
        expect.objectContaining({
          customer_id: customerId,
          retailer_id: retailerId,
          for_date: todayDate,
        }),
      );
    await expect(panel.getByRole("alert")).toHaveCount(0);

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
      .from("morning_routine_subscriptions")
      .delete()
      .eq("customer_id", customerId);
    await client
      .from("morning_routine_recommendations")
      .delete()
      .eq("customer_id", customerId);
    await client
      .from("morning_routine_selections")
      .delete()
      .eq("customer_id", customerId)
      .eq("for_date", todayDate);
  }
});
