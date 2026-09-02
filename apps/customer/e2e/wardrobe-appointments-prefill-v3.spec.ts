import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { WardrobeRepository, createSupabaseAdminClient } from "@paon/database";
import { expect, test, type Page } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

/**
 * DeepSeek remediation Cards 1-2 — Wardrobe-to-Appointment prefill.
 *
 * Previously: "Request a fit-check in store" (owned card) and "Proceed in
 * store" (advisor-selection/roadmap-gap card) both linked to /appointments
 * with query params the appointments page never read — real navigation to
 * a real page, but the booking wizard always opened cold, forcing the
 * customer to re-pick a reason they'd already told the app.
 *
 * Fixed: both links now carry only typed, allowlisted params
 * (`prefillReason` — one of the real `AppointmentReason` values —
 * plus exactly one of `prefillWardrobeItemId` / `prefillRoadmapGapId`).
 * `apps/customer/app/(dashboard)/appointments/page.tsx` re-resolves and
 * re-authorizes whichever garment/gap id is present against this
 * customer's own data server-side before ever opening the wizard; on
 * success the real booking flow auto-opens with the reason and a
 * real-data purpose line preselected. Anything that fails to resolve
 * (bad reason, missing/retired/cross-tenant id) is silently ignored and
 * the page renders exactly like a plain, un-prefilled visit — the closed
 * "Book appointment" button, full reason picker, nothing pre-selected.
 */

const PHOTO_URL =
  "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22400%22%20height%3D%22600%22%3E%3Crect%20width%3D%22400%22%20height%3D%22600%22%20fill%3D%22%236b7360%22%2F%3E%3C%2Fsvg%3E";
const FITCHECK_ITEM_NAME = "Prefill Proof Overcoat";
const ROADMAP_GAP_TITLE = "Prefill Proof Aspirational Knit";

const EVIDENCE_SUBPATH =
  "../../../docs/evidence/runs/customer-v3-wardrobe-appointments-prefill";

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

async function fixtureCustomer() {
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
    .maybeSingle();
  if (!customerRow) throw new Error("fixture customer missing");
  const { data: staffRow } = await client
    .from("retailer_staff_members")
    .select("id")
    .eq("retailer_id", retailer.id)
    .not("accepted_at", "is", null)
    .limit(1)
    .single();
  if (!staffRow) throw new Error("fixture staff member missing");
  return {
    client,
    retailerId: retailer.id as string,
    customerId: customerRow.id as string,
    staffId: staffRow.id as string,
  };
}

async function seedWardrobeItem(): Promise<{ id: string }> {
  const { client, retailerId, customerId } = await fixtureCustomer();
  await client
    .from("wardrobe_items")
    .delete()
    .eq("customer_id", customerId)
    .eq("display_name", FITCHECK_ITEM_NAME);
  const repo = new WardrobeRepository(client);
  const item = await repo.createExternalItem({
    retailerId: retailerId as never,
    customerId: customerId as never,
    categoryCode: "overcoat",
    displayName: FITCHECK_ITEM_NAME,
    brand: "Another Tailor",
    condition: "good",
    careState: "current",
    fitPerception: "true_to_size",
    identifyingPhotoUrl: PHOTO_URL,
    acquiredAt: "2025-01-06T00:00:00.000Z",
  });
  return { id: item.id };
}

async function seedRoadmapGap(): Promise<{
  roadmapId: string;
  gapId: string;
}> {
  const { client, retailerId, customerId, staffId } = await fixtureCustomer();
  const { data: roadmap, error: roadmapError } = await client
    .from("wardrobe_roadmaps")
    .insert({
      retailer_id: retailerId,
      customer_id: customerId,
      title: "Prefill Proof Roadmap",
      status: "approved",
      authored_by_staff_id: staffId,
      decided_at: new Date().toISOString(),
      decided_by_actor: "customer",
    })
    .select("id")
    .single();
  if (roadmapError || !roadmap) throw roadmapError ?? new Error("no roadmap");

  const { data: gap, error: gapError } = await client
    .from("wardrobe_roadmap_gaps")
    .insert({
      roadmap_id: roadmap.id,
      retailer_id: retailerId,
      title: ROADMAP_GAP_TITLE,
      description: "A layering knit the advisor recommended.",
      rank: 1,
      category_code: "knitwear",
    })
    .select("id")
    .single();
  if (gapError || !gap) throw gapError ?? new Error("no gap");

  return { roadmapId: roadmap.id as string, gapId: gap.id as string };
}

async function seedPublishedBranch(): Promise<{ id: string; name: string }> {
  const { client, retailerId } = await fixtureCustomer();
  const openingHours = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ].map((day) => ({ day, closed: false, opens: "09:00", closes: "18:00" }));
  const name = `Prefill Proof Branch ${Date.now()}`;
  const { data: branch, error } = await client
    .from("retailer_branches")
    .insert({
      retailer_id: retailerId,
      name,
      timezone: "UTC",
      is_default: true,
      published: true,
      opening_hours: openingHours,
    })
    .select("id")
    .single();
  if (error || !branch) {
    throw new Error(
      `failed to seed fixture branch: ${error?.message ?? "unknown"}`,
    );
  }
  return { id: branch.id as string, name };
}

/** Advances the already-open, prefilled wizard past location/date/time to
 * the review step, where the reason label is finally rendered — proving
 * "visibly preselect the valid reason" against the real DOM at the step
 * it actually appears in, not the location step it opens on. */
async function advanceToReview(page: Page, branchName: string): Promise<void> {
  await page.getByRole("button", { name: branchName, exact: true }).click();
  const dateButtons = page.getByRole("button", {
    name: /^[A-Za-z]{3} \d{1,2} [A-Za-z]+$/,
  });
  await expect(dateButtons.first()).toBeVisible();
  await dateButtons.first().click();
  const timeButtons = page.getByRole("button", { name: /^\d{2}:\d{2}$/ });
  await expect(timeButtons.first()).toBeVisible();
  await timeButtons.first().click();
}

async function signIn(page: Page): Promise<void> {
  const { data, error } = await admin().auth.admin.generateLink({
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
}

for (const viewport of [
  { name: "desktop", width: 1512, height: 982 },
  { name: "mobile", width: 390, height: 844 },
] as const) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("Wardrobe 'Request a fit-check in store' opens the real booking flow with the reason and garment preselected", async ({
      page,
    }, testInfo) => {
      const evidenceDir = resolve(testInfo.config.rootDir, EVIDENCE_SUBPATH);
      await mkdir(evidenceDir, { recursive: true });
      const consoleErrors: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") consoleErrors.push(m.text());
      });

      const { id: itemId } = await seedWardrobeItem();
      const { id: branchId, name: branchName } = await seedPublishedBranch();

      try {
        await signIn(page);
        await page.goto("/wardrobe");
        const card = page
          .locator("article", { hasText: FITCHECK_ITEM_NAME })
          .first();
        await expect(card).toBeVisible();
        await card.getByRole("button", { name: "Actions +" }).click();
        await card
          .getByRole("link", { name: "Request a fit-check in store" })
          .click();

        await expect(page).toHaveURL(
          new RegExp(
            `/appointments\\?prefillReason=service_size_check&prefillWardrobeItemId=${itemId}`,
          ),
        );
        // Real booking flow auto-opens — no extra click — with the real
        // step-by-step wizard still intact (jumps past "reason" straight
        // to "location", exactly like the Suggestions-to-book cards do).
        await expect(page.getByText("Book an appointment")).toBeVisible();
        await expect(
          page.getByText(`Fit-check: ${FITCHECK_ITEM_NAME}`),
        ).toBeVisible();
        // No reason-picker step was ever shown — confirms the reason really
        // was preselected, not just labeled.
        await expect(
          page.getByRole("button", { name: "A quick glance", exact: true }),
        ).not.toBeVisible();

        // Advance to the review step, where the reason label finally
        // renders in the real DOM, and confirm it's the exact preselected
        // reason — the strongest proof of "visibly preselect the reason".
        await advanceToReview(page, branchName);
        await expect(page.getByText("Service — size check")).toBeVisible();
        // The review card echoes the same purpose text the persistent
        // header already shows — both are real, correct UI at this step.
        await expect(
          page.getByText(`Fit-check: ${FITCHECK_ITEM_NAME}`).first(),
        ).toBeVisible();

        await page.screenshot({
          path: `${evidenceDir}/${viewport.name}-fitcheck-prefilled.png`,
          fullPage: true,
        });

        expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
      } finally {
        await admin().from("wardrobe_items").delete().eq("id", itemId);
        await admin()
          .from("retailer_branches")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", branchId);
      }
    });

    test("Wardrobe 'Proceed in store' opens the real booking flow with the reason and roadmap gap preselected", async ({
      page,
    }, testInfo) => {
      const evidenceDir = resolve(testInfo.config.rootDir, EVIDENCE_SUBPATH);
      await mkdir(evidenceDir, { recursive: true });
      const consoleErrors: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") consoleErrors.push(m.text());
      });

      const { roadmapId, gapId } = await seedRoadmapGap();
      const { id: branchId, name: branchName } = await seedPublishedBranch();

      try {
        await signIn(page);
        await page.goto("/wardrobe");
        const card = page
          .locator("article", { hasText: ROADMAP_GAP_TITLE })
          .first();
        await expect(card).toBeVisible();
        await card.getByRole("button", { name: "Actions +" }).click();
        await card.getByRole("link", { name: "Proceed in store" }).click();

        await expect(page).toHaveURL(
          new RegExp(
            `/appointments\\?prefillReason=in_the_mood_for_something_fresh&prefillRoadmapGapId=${gapId}`,
          ),
        );
        await expect(page.getByText("Book an appointment")).toBeVisible();
        await expect(
          page.getByText(`In-store: ${ROADMAP_GAP_TITLE}`),
        ).toBeVisible();
        // No reason-picker step was ever shown.
        await expect(
          page.getByRole("button", { name: "A quick glance", exact: true }),
        ).not.toBeVisible();

        await advanceToReview(page, branchName);
        await expect(
          page.getByText("In the mood for something fresh"),
        ).toBeVisible();
        // The review card echoes the same purpose text the persistent
        // header already shows — both are real, correct UI at this step.
        await expect(
          page.getByText(`In-store: ${ROADMAP_GAP_TITLE}`).first(),
        ).toBeVisible();

        await page.screenshot({
          path: `${evidenceDir}/${viewport.name}-roadmap-gap-prefilled.png`,
          fullPage: true,
        });

        expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
      } finally {
        await admin().from("wardrobe_roadmaps").delete().eq("id", roadmapId);
        await admin()
          .from("retailer_branches")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", branchId);
      }
    });

    test("an invalid prefill garment id fails closed to the normal, un-prefilled booking flow", async ({
      page,
    }) => {
      const consoleErrors: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") consoleErrors.push(m.text());
      });

      await signIn(page);
      // A syntactically valid UUID that does not exist as a wardrobe item —
      // simulates missing/cross-tenant/unavailable garment data.
      await page.goto(
        "/appointments?prefillReason=service_size_check&prefillWardrobeItemId=00000000-0000-0000-0000-000000000000",
      );

      // No auto-opened wizard, no fabricated preselection — the plain
      // closed launcher and full real flow remain exactly as normal.
      await expect(
        page.getByRole("button", { name: "Book appointment", exact: true }),
      ).toBeVisible();
      await expect(page.getByText("Book an appointment")).not.toBeVisible();

      // The real flow underneath is still fully usable: open it manually
      // and confirm the reason step (not the location step) is first,
      // proving nothing was silently preselected.
      await page
        .getByRole("button", { name: "Book appointment", exact: true })
        .click();
      await expect(page.getByText("Book an appointment")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "In the mood for something fresh" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "A quick glance", exact: true }),
      ).toBeVisible();

      expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
    });
  });
}
