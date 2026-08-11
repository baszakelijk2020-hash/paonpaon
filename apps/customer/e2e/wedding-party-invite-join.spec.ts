import {
  WeddingPartyRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test, type Page } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function e2ePartySetup() {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Wedding-party invite proof requires local Supabase.");
  }

  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const partyRepo = new WeddingPartyRepository(admin);
  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const { data: organizer } = await admin
    .from("customers")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("email", TEST_CUSTOMER_EMAIL)
    .single();
  if (!organizer) throw new Error("fixture organizer missing");

  const party = await partyRepo.create({
    retailerId: asId<"RetailerId">(retailer.id),
    organizerCustomerId: asId<"CustomerId">(organizer.id),
    venueName: `E2E Invite Venue ${Date.now()}`,
    notes: "PRIVATE E2E ORGANIZER NOTE — never expose this on an invite.",
  });
  return { admin, party, retailerId: retailer.id };
}

async function signInOrganizer(
  page: Page,
  admin: ReturnType<typeof createSupabaseAdminClient>,
) {
  const { data, error } = await admin.auth.admin.generateLink({
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
}

async function softDeleteParty(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  partyId: string,
) {
  const { error } = await admin
    .from("wedding_parties")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", partyId);
  if (error) console.error("wedding party cleanup failed:", error);
}

test("an organizer invite lets a fresh anonymous guest join with fitting details and a photo", async ({
  page,
  browser,
}) => {
  const { admin, party, retailerId } = await e2ePartySetup();
  const guestEmail = `e2e-wedding-guest-${Date.now()}@nebelspiegel.com`;

  try {
    await signInOrganizer(page, admin);
    await page.goto(`/wedding-parties/${party.id}`);
    const inviteUrl = await page.locator("input[readonly]").inputValue();
    expect(inviteUrl).toContain(
      `/r/${TEST_RETAILER_SLUG}/wedding-parties/join/${party.inviteToken}`,
    );

    const anonymousContext = await browser.newContext();
    const anonymousPage = await anonymousContext.newPage();
    try {
      await anonymousPage.goto(new URL(inviteUrl).pathname);
      await expect(
        anonymousPage.getByRole("heading", { name: "You’re invited" }),
      ).toBeVisible();
      await expect(
        anonymousPage.getByText("E2E Shopper", { exact: true }),
      ).toHaveCount(0);
      await expect(
        anonymousPage.getByText("PRIVATE E2E ORGANIZER NOTE", { exact: false }),
      ).toHaveCount(0);

      await anonymousPage
        .getByLabel("Your name")
        .fill("Anonymous Wedding Guest");
      await anonymousPage.getByLabel("Your email").fill(guestEmail);
      await anonymousPage.getByLabel("Your role").selectOption("best_man");
      await anonymousPage.getByLabel("Height (cm)").fill("183.5");
      await anonymousPage.getByLabel("Weight (kg)").fill("82.4");
      await anonymousPage.getByLabel("Your photo").setInputFiles({
        name: "guest.png",
        mimeType: "image/png",
        buffer: PNG,
      });
      await anonymousPage
        .getByRole("button", { name: "Join the party" })
        .click();
      await expect(
        anonymousPage.getByText(
          /You’re in — the atelier can see you on the party roster/,
        ),
      ).toBeVisible();
    } finally {
      await anonymousContext.close();
    }

    const { data: member, error } = await admin
      .from("wedding_party_members")
      .select(
        "wedding_party_id, name, role, height_cm, weight_kg, photo_url, customers!inner(email, retailer_id)",
      )
      .eq("wedding_party_id", party.id)
      .eq("name", "Anonymous Wedding Guest")
      .single();
    if (error || !member) throw error ?? new Error("joined member missing");
    expect(member.wedding_party_id).toBe(party.id);
    expect(member.name).toBe("Anonymous Wedding Guest");
    expect(member.role).toBe("best_man");
    expect(Number(member.height_cm)).toBe(183.5);
    expect(Number(member.weight_kg)).toBe(82.4);
    expect(member.photo_url).toContain(
      `/party-photos/${retailerId}/${party.id}/members/`,
    );
    expect(member.customers.email).toBe(guestEmail);
    expect(member.customers.retailer_id).toBe(retailerId);
  } finally {
    await softDeleteParty(admin, party.id);
  }
});

test("an invalid or cancelled invite exposes no party data and writes no member", async ({
  browser,
}) => {
  const { admin, party } = await e2ePartySetup();
  const anonymousContext = await browser.newContext();
  const anonymousPage = await anonymousContext.newPage();

  try {
    await admin
      .from("wedding_parties")
      .update({ status: "cancelled" })
      .eq("id", party.id);

    const response = await anonymousPage.goto(
      `/r/${TEST_RETAILER_SLUG}/wedding-parties/join/${party.inviteToken}`,
    );
    expect(response?.status()).toBe(404);
    await expect(
      anonymousPage.getByText("E2E Shopper", { exact: true }),
    ).toHaveCount(0);

    const { count, error } = await admin
      .from("wedding_party_members")
      .select("id", { count: "exact", head: true })
      .eq("wedding_party_id", party.id);
    if (error) throw error;
    expect(count).toBe(0);
  } finally {
    await anonymousContext.close();
    await softDeleteParty(admin, party.id);
  }
});
