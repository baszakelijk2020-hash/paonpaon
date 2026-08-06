import { createSupabaseAdminClient, WardrobeRepository } from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test, type Page } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

// A genuine minimal 1x1 PNG — same fixture bytes already proven against
// this codebase's own magic-byte validation (silhouette-analysis.spec.ts,
// tableservice-attachments.spec.ts).
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function signIn(
  page: Page,
  admin: ReturnType<typeof createSupabaseAdminClient>,
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: TEST_CUSTOMER_EMAIL,
    });
    if (error || !data.properties) {
      throw error ?? new Error("magic link missing");
    }
    await page.goto(
      `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`,
    );
    const hasAuthCookie = (await page.context().cookies()).some(
      (cookie) =>
        cookie.name.startsWith("sb-") &&
        cookie.name.includes("auth-token") &&
        !cookie.name.includes("code-verifier"),
    );
    const isCustomerDashboard = await page
      .getByRole("button", { name: "Sign out" })
      .isVisible();
    if (
      /\/dashboard$/.test(page.url()) &&
      hasAuthCookie &&
      isCustomerDashboard
    ) {
      return;
    }
  }
  throw new Error(`local magic-link sign-in did not complete: ${page.url()}`);
}

/**
 * Virtual Wardrobe Studio (VWS-001..003 / PHASE 4.6-4.8 / ADR-074) —
 * Style Portrait onboarding on /account through to composing and
 * enqueuing a look on /wardrobe. Proves the real path: consent gate,
 * private-bucket upload, fit-archetype declaration through the existing
 * StyleProfile RPC, the onboarding preview/approve state machine, outfit
 * composition with real slot-consistency rules, and generation enqueue
 * with idempotency. This sandbox has no OPENAI_API_KEY, so the enqueued
 * job is proven to reach `queued` and stay there — actual image
 * rendering is the queue processor's own concern
 * (apps/admin/app/api/cron/process-wardrobe-visualizations), out of
 * scope for this spec, same "hard blocker: missing provider credential
 * blocks only live smoke verification" posture every other AI-assisted
 * surface in this codebase already documents.
 */
test("a customer builds a Style Portrait, composes a look, and enqueues generation", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("requires local Supabase.");
  }
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");

  const { data: customerRow } = await admin
    .from("customers")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("email", TEST_CUSTOMER_EMAIL)
    .single();
  if (!customerRow) throw new Error("fixture customer missing");

  // A composable owned item — global-setup doesn't seed one, and this
  // spec's job is Virtual Studio, not wardrobe intake.
  const wardrobeRepo = new WardrobeRepository(admin);
  const existingItems = await wardrobeRepo.findByCustomer(
    asId<"CustomerId">(customerRow.id),
  );
  let fixtureItem = existingItems.find(
    (item) => item.displayName === "E2E Navy Jacket",
  );
  fixtureItem ??= await wardrobeRepo.createExternalItem({
    retailerId: retailer.id,
    customerId: customerRow.id,
    categoryCode: "jacket",
    displayName: "E2E Navy Jacket",
    condition: "good",
    careState: "current",
    fitPerception: "unknown",
  });

  const portraitIds: string[] = [];
  const outfitIds: string[] = [];

  try {
    await signIn(page, admin);

    // --- Style Portrait onboarding (on /account, alongside StyleProfile) ---
    await page.goto("/account");
    await expect(
      page.getByRole("heading", { name: /Style Portrait/ }),
    ).toBeVisible();

    await page.getByRole("button", { name: "I understand — continue" }).click();
    await expect(page.getByLabel("Face photo")).toBeVisible();

    const { data: consentAfterGrant } = await admin
      .from("style_portrait_consents")
      .select("status, disclosures_acknowledged")
      .eq("customer_id", customerRow.id)
      .single();
    expect(consentAfterGrant?.status).toBe("granted");
    expect(consentAfterGrant?.disclosures_acknowledged).toBe(true);

    await page.getByLabel("Face photo").setInputFiles({
      name: "face.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await page.getByRole("button", { name: "Upload" }).first().click();
    await expect(page.getByText("✓ received").first()).toBeVisible();

    await page.getByLabel("Full-body photo").setInputFiles({
      name: "full-body.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await page
      .getByRole("button", { name: /Upload|Replace photo/ })
      .nth(1)
      .click();
    await expect(page.getByText("✓ received")).toHaveCount(2);

    const { data: portraitAfterUploads } = await admin
      .from("style_portraits")
      .select("id, status")
      .eq("customer_id", customerRow.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (!portraitAfterUploads) throw new Error("portrait was not created");
    portraitIds.push(portraitAfterUploads.id);
    expect(portraitAfterUploads.status).toBe("draft");

    // Fit archetype — a real declared StyleProfile preference, not a
    // second schema (ADR-074 §3.2). A plain <form action> click only
    // awaits the browser event, not the Server Action's own commit, so
    // poll rather than reading immediately (same race
    // silhouette-analysis.spec.ts's own comment documents).
    await page.getByRole("button", { name: "Slim", exact: true }).click();
    await expect
      .poll(async () => {
        const { data } = await admin
          .from("style_portraits")
          .select("fit_archetype_concept_id")
          .eq("id", portraitAfterUploads.id)
          .single();
        return data?.fit_archetype_concept_id ?? null;
      })
      .not.toBeNull();

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(
      page.getByText(
        "Check your photo, then approve to activate your Style Portrait.",
      ),
    ).toBeVisible();

    await page.getByRole("button", { name: "Approve" }).click();
    await expect(
      page.getByText(
        "Your Style Portrait is approved and ready for the Virtual Studio.",
      ),
    ).toBeVisible();

    const { data: approvedPortrait } = await admin
      .from("style_portraits")
      .select("status")
      .eq("id", portraitAfterUploads.id)
      .single();
    expect(approvedPortrait?.status).toBe("approved");

    // --- Compose and enqueue a look (on /wardrobe) ---
    await page.goto("/wardrobe");
    await expect(
      page.getByRole("heading", { name: /Virtual Studio/ }),
    ).toBeVisible();

    await page.getByLabel(`Include ${fixtureItem.displayName}`).check();
    await page.getByLabel("Look title").fill("E2E Client Dinner Look");
    await page.getByRole("button", { name: "Create look" }).click();

    // Wait for the round trip to land (revalidated server data rendering
    // the new outfit) before querying for it — same race the fit-archetype
    // step above and silhouette-analysis.spec.ts's own comment document.
    await expect(page.getByText("E2E Client Dinner Look")).toBeVisible();

    const { data: outfitAfterCreate } = await admin
      .from("outfits")
      .select("id, title, created_by_customer_id, created_by_staff_id")
      .eq("customer_id", customerRow.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (!outfitAfterCreate) throw new Error("outfit was not created");
    outfitIds.push(outfitAfterCreate.id);
    expect(outfitAfterCreate.title).toBe("E2E Client Dinner Look");
    expect(outfitAfterCreate.created_by_customer_id).toBe(customerRow.id);
    expect(outfitAfterCreate.created_by_staff_id).toBeNull();

    // Generate — approved portrait + trigger-seeded retailer default
    // preset both exist, so this must reach the queue, not a
    // "not configured" error.
    await page
      .locator("li", { hasText: "E2E Client Dinner Look" })
      .getByRole("button", { name: "Create look" })
      .click();
    await expect(
      page.locator("li", { hasText: "E2E Client Dinner Look" }),
    ).toContainText(/Queued|Generating/);

    const { data: jobAfterEnqueue } = await admin
      .from("wardrobe_visualization_jobs")
      .select("id, status, outfit_id, customer_id")
      .eq("outfit_id", outfitAfterCreate.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (!jobAfterEnqueue) throw new Error("visualization job was not created");
    expect(jobAfterEnqueue.status).toBe("queued");
    expect(jobAfterEnqueue.customer_id).toBe(customerRow.id);
  } finally {
    if (outfitIds.length > 0) {
      const { error: jobDeleteError } = await admin
        .from("wardrobe_visualization_jobs")
        .delete()
        .in("outfit_id", outfitIds);
      if (jobDeleteError) {
        console.error("cleanup: job delete failed", jobDeleteError);
      }
      const { error: slotDeleteError } = await admin
        .from("outfit_slots")
        .delete()
        .in("outfit_id", outfitIds);
      if (slotDeleteError) {
        console.error("cleanup: outfit slot delete failed", slotDeleteError);
      }
      const { error: outfitDeleteError } = await admin
        .from("outfits")
        .delete()
        .in("id", outfitIds);
      if (outfitDeleteError) {
        console.error("cleanup: outfit delete failed", outfitDeleteError);
      }
    }
    if (portraitIds.length > 0) {
      const { error: referenceDeleteError } = await admin
        .from("style_portrait_references")
        .delete()
        .in("style_portrait_id", portraitIds);
      if (referenceDeleteError) {
        console.error(
          "cleanup: portrait reference delete failed",
          referenceDeleteError,
        );
      }
      const { data: objects } = await admin.storage
        .from("wardrobe-studio")
        .list(`${retailer.id}/${customerRow.id}/references`);
      if (objects && objects.length > 0) {
        await admin.storage
          .from("wardrobe-studio")
          .remove(
            objects.map(
              (object) =>
                `${retailer.id}/${customerRow.id}/references/${object.name}`,
            ),
          );
      }
      const { error: portraitDeleteError } = await admin
        .from("style_portraits")
        .delete()
        .in("id", portraitIds);
      if (portraitDeleteError) {
        console.error("cleanup: portrait delete failed", portraitDeleteError);
      }
    }
    await admin
      .from("style_portrait_consents")
      .delete()
      .eq("customer_id", customerRow.id);
    await admin
      .from("wardrobe_items")
      .delete()
      .eq("id", fixtureItem.id)
      .eq("customer_id", customerRow.id);
  }
});
