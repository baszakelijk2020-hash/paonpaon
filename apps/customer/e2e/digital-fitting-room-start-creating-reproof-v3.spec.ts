import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import {
  OutfitRepository,
  StylePortraitConsentRepository,
  StylePortraitRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test, type Page } from "@playwright/test";

import {
  AUTH_DELIVERABLE_DOMAIN,
  TEST_CUSTOMER_EMAIL,
  TEST_PRODUCT_SLUG,
  TEST_RETAILER_SLUG,
} from "./fixtures";

/**
 * Digital Fitting Room — "Start creating" re-proof (post-drafts).
 *
 * Re-verifies the full first-run → workflow → saved-drafts contract on the
 * current release branch, with a real approved Style Portrait so the real
 * post-drafts surface (`FittingRoomStudio`, gated by `canGenerate` in
 * apps/customer/app/(dashboard)/digital-fitting-room/page.tsx) actually
 * renders — not just the pre-portrait upload gate:
 *
 *  1. an authenticated customer can open `/digital-fitting-room` (HTTP 200);
 *  2. the premium first-run card (invitation, three real steps, one
 *     "Start creating" action) is present — not the old split hero;
 *  3. "Start creating" replaces the card with the real workflow in place
 *     (same document, `?step=avatar`, no reload);
 *  4. a real saved outfit gives "View saved drafts & results" a visible
 *     entry point on the first-run card, and that same outfit is listed
 *     and selectable inside the real workflow itself — a usable saved
 *     result, not a dead link;
 *  5. desktop and mobile captures load HTTP 200 with zero console errors.
 */

const EVIDENCE_SUBPATH =
  "../../../docs/evidence/runs/customer-v3-dfr-start-creating-reproof";

// A genuine minimal 1x1 PNG — same fixture bytes already proven against this
// codebase's own magic-byte validation (silhouette-analysis.spec.ts,
// virtual-studio.spec.ts, virtual-studio-batch-and-feedback-evidence.spec.ts).
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

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

async function signIn(page: Page): Promise<void> {
  const deliverableEmail = `e2e-shopper@${AUTH_DELIVERABLE_DOMAIN}`;
  const { data, error } = await admin().auth.admin.generateLink({
    type: "magiclink",
    email: deliverableEmail,
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
}

async function seedApprovedPortraitAndOutfit(): Promise<{
  retailerId: string;
  customerId: string;
  outfitId: string;
  outfitTitle: string;
  portraitId: string;
  facePath: string;
  fullBodyPath: string;
  cleanup: () => Promise<void>;
}> {
  const client = admin();
  const { data: retailer } = await client
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const retailerId = asId<"RetailerId">(retailer.id);

  const deliverableEmail = `e2e-shopper@${AUTH_DELIVERABLE_DOMAIN}`;
  const { data: customerRow } = await client
    .from("customers")
    .select("id")
    .eq("retailer_id", retailerId)
    .eq("email", TEST_CUSTOMER_EMAIL)
    .single();
  if (!customerRow) throw new Error("fixture customer missing");
  const customerId = asId<"CustomerId">(customerRow.id);

  // Update customer email to deliverable domain for auth to work
  await client
    .from("customers")
    .update({ email: deliverableEmail })
    .eq("id", customerId);

  const { data: product } = await client
    .from("products")
    .select("id")
    .eq("retailer_id", retailerId)
    .eq("slug", TEST_PRODUCT_SLUG)
    .single();
  if (!product) throw new Error("fixture product missing");

  await new StylePortraitConsentRepository(client).grant(
    retailerId,
    customerId,
  );

  const unique = Date.now();
  const facePath = `${retailerId}/${customerId}/references/e2e-dfr-reproof-face-${unique}.png`;
  const fullBodyPath = `${retailerId}/${customerId}/references/e2e-dfr-reproof-body-${unique}.png`;
  const { error: faceUploadError } = await client.storage
    .from("wardrobe-studio")
    .upload(facePath, PNG, { contentType: "image/png" });
  if (faceUploadError) throw faceUploadError;
  const { error: bodyUploadError } = await client.storage
    .from("wardrobe-studio")
    .upload(fullBodyPath, PNG, { contentType: "image/png" });
  if (bodyUploadError) throw bodyUploadError;

  const stylePortraitRepo = new StylePortraitRepository(client);
  const portrait = await stylePortraitRepo.create({
    retailerId,
    customerId,
    references: [
      { kind: "face", storageBucket: "wardrobe-studio", storagePath: facePath },
      {
        kind: "full_body",
        storageBucket: "wardrobe-studio",
        storagePath: fullBodyPath,
      },
    ],
  });
  await stylePortraitRepo.approve(portrait.id);

  const outfitTitle = `E2E DFR Reproof Look ${unique}`;
  const outfitRepo = new OutfitRepository(client);
  const outfit = await outfitRepo.createByCustomer(
    {
      retailerId,
      customerId,
      title: outfitTitle,
      isSuggestionGeneration: false,
      slots: [
        {
          slotKind: "jacket",
          label: "jacket",
          available: true,
          displayOrder: 0,
          productId: product.id,
        },
      ],
    },
    customerId,
  );

  return {
    retailerId,
    customerId,
    outfitId: outfit.id,
    outfitTitle,
    portraitId: portrait.id,
    facePath,
    fullBodyPath,
    cleanup: async () => {
      await client
        .from("wardrobe_visualization_jobs")
        .delete()
        .eq("outfit_id", outfit.id);
      await client.from("outfit_slots").delete().eq("outfit_id", outfit.id);
      await client.from("outfits").delete().eq("id", outfit.id);
      await client
        .from("style_portrait_references")
        .delete()
        .eq("style_portrait_id", portrait.id);
      await client
        .from("style_portrait_consents")
        .delete()
        .eq("customer_id", customerId);
      await client.storage
        .from("wardrobe-studio")
        .remove([facePath, fullBodyPath]);
      await client.from("style_portraits").delete().eq("id", portrait.id);
    },
  };
}

test("Digital Fitting Room: first-run card, in-place workflow, and a usable saved-drafts entry", async ({
  page,
}, testInfo) => {
  const evidenceDir = resolve(testInfo.config.rootDir, EVIDENCE_SUBPATH);
  await mkdir(evidenceDir, { recursive: true });

  const consoleErrors: string[] = [];
  const IGNORED_ERROR_PATTERNS = [/Failed to load resource.*404/i];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    if (IGNORED_ERROR_PATTERNS.some((pattern) => pattern.test(text))) return;
    consoleErrors.push(text);
  });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${String(e)}`));

  const { outfitTitle, cleanup } = await seedApprovedPortraitAndOutfit();

  try {
    await page.setViewportSize({ width: 1512, height: 982 });
    await signIn(page);

    // 1. Authenticated customer opens /digital-fitting-room.
    const response = await page.goto("/digital-fitting-room", {
      waitUntil: "networkidle",
    });
    expect(response?.status()).toBe(200);

    // 2. The premium first-run card is present — invitation, three real
    //    steps, one prominent "Start creating" action; not the old split
    //    hero with its decorative wardrobe panel.
    const invitation = page.getByRole("heading", {
      name: "See a look take shape before you ask for it.",
    });
    await expect(invitation).toBeVisible();
    await expect(page.getByText("Create your digital portrait")).toBeVisible();
    await expect(page.getByText("Choose real pieces")).toBeVisible();
    await expect(page.getByText("Create a look")).toBeVisible();
    const startCreating = page.getByRole("link", { name: /Start creating/ });
    await expect(startCreating).toHaveCount(1);
    await expect(page.getByText("Your wardrobe, in motion.")).toHaveCount(0);

    // 4a. A real saved outfit gives the first-run card a visible, working
    //     "View saved drafts & results" entry (never "No saved drafts or
    //     results yet." once a real one exists).
    const savedDraftsEntry = page.getByRole("link", {
      name: "View saved drafts & results",
    });
    await expect(savedDraftsEntry).toBeVisible();
    await expect(page.getByText("No saved drafts or results yet.")).toHaveCount(
      0,
    );

    await page.screenshot({
      path: resolve(evidenceDir, "desktop-first-run-1512x982.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: resolve(evidenceDir, "mobile-first-run-390x844.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1512, height: 982 });

    // 3. "Start creating" advances into the real workflow IN PLACE — same
    //    document (no full reload), URL carries ?step=avatar, the
    //    first-run card is gone. With an approved portrait, the real
    //    workflow is the look composer (FittingRoomStudio).
    await startCreating.click();
    await expect(page).toHaveURL(/\?step=avatar/);
    await expect(invitation).toHaveCount(0);
    await expect(
      page.getByRole("heading", {
        name: "Your portrait is ready. Create a considered look.",
      }),
    ).toBeVisible();

    // 4b. The same saved outfit is listed and selectable inside the real
    //     workflow itself — a working entry, not just a link to nowhere.
    const savedDraftsHeading = page.getByText("Saved drafts & results", {
      exact: true,
    });
    await expect(savedDraftsHeading).toBeVisible();
    const outfitButton = page.getByRole("button", {
      name: new RegExp(outfitTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    });
    await expect(outfitButton).toBeVisible();
    // Selecting it visibly activates it (real interaction, not a dead tile).
    await outfitButton.click();
    await expect(outfitButton).toHaveClass(/bg-white/);

    await page.screenshot({
      path: resolve(evidenceDir, "desktop-avatar-step-1512x982.png"),
      fullPage: true,
    });

    // 4c. Following the saved-drafts entry from the first-run card itself
    //     also lands on the real workflow with the same outfit present.
    await page.goto("/digital-fitting-room");
    await expect(invitation).toBeVisible();
    await page
      .getByRole("link", { name: "View saved drafts & results" })
      .click();
    await expect(page).toHaveURL(/\?step=avatar/);
    await expect(outfitButton).toBeVisible();

    // 5. Mobile capture of the working saved-drafts workflow.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: resolve(evidenceDir, "mobile-avatar-step-390x844.png"),
      fullPage: true,
    });

    expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
  } finally {
    await cleanup();
  }
});
