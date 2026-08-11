import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL } from "./fixtures";

function accessTokenFromCookies(
  cookies: readonly { name: string; value: string }[],
): string {
  const tokenCookie = cookies.find(
    (cookie) =>
      cookie.name.startsWith("sb-") && cookie.name.endsWith("-auth-token"),
  );
  if (!tokenCookie?.value.startsWith("base64-")) {
    throw new Error("customer auth cookie missing");
  }
  const session = JSON.parse(
    Buffer.from(
      tokenCookie.value.slice("base64-".length),
      "base64url",
    ).toString("utf8"),
  ) as { access_token?: unknown };
  if (typeof session.access_token !== "string") {
    throw new Error("customer access token missing");
  }
  return session.access_token;
}

test("a customer corrects an eligible House Memory fact without mutating its source, while cross-customer and restricted facts fail closed", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error("requires local Supabase.");
  }
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const ownerEmail = `e2e-house-memory-owner-${suffix}@paon.test`;
  const otherEmail = `e2e-house-memory-other-${suffix}@paon.test`;
  const password = "E2E-house-memory-123!";
  let ownerUserId: string | null = null;
  let otherUserId: string | null = null;
  let ownerCustomerId: string | null = null;
  let otherCustomerId: string | null = null;

  try {
    const { data: fixtureCustomer, error: fixtureError } = await admin
      .from("customers")
      .select("retailer_id")
      .eq("email", TEST_CUSTOMER_EMAIL)
      .single();
    if (fixtureError || !fixtureCustomer) {
      throw new Error("fixture retailer missing");
    }

    const { data: ownerUser, error: ownerUserError } =
      await admin.auth.admin.createUser({
        email: ownerEmail,
        password,
        email_confirm: true,
      });
    if (ownerUserError || !ownerUser.user) throw ownerUserError;
    ownerUserId = ownerUser.user.id;
    const { data: otherUser, error: otherUserError } =
      await admin.auth.admin.createUser({
        email: otherEmail,
        password,
        email_confirm: true,
      });
    if (otherUserError || !otherUser.user) throw otherUserError;
    otherUserId = otherUser.user.id;

    const { data: customers, error: customerError } = await admin
      .from("customers")
      .insert([
        {
          retailer_id: fixtureCustomer.retailer_id,
          user_id: ownerUserId,
          full_name: "E2E House Memory Owner",
          email: ownerEmail,
        },
        {
          retailer_id: fixtureCustomer.retailer_id,
          user_id: otherUserId,
          full_name: "E2E House Memory Other",
          email: otherEmail,
        },
      ])
      .select("id, user_id");
    if (customerError || !customers) throw customerError;
    ownerCustomerId =
      customers.find((row) => row.user_id === ownerUserId)?.id ?? null;
    otherCustomerId =
      customers.find((row) => row.user_id === otherUserId)?.id ?? null;
    if (!ownerCustomerId || !otherCustomerId)
      throw new Error("test customers missing");

    const { data: sourceFacts, error: sourceError } = await admin
      .from("customer_facts")
      .insert([
        {
          retailer_id: fixtureCustomer.retailer_id,
          customer_id: ownerCustomerId,
          fact_type: "colour_interest",
          provenance_class: "advisor_observed",
          value_label: "E2E incorrect navy preference",
          sensitivity: "standard",
          visibility: "customer_and_advisor",
          observed_at: new Date().toISOString(),
        },
        {
          retailer_id: fixtureCustomer.retailer_id,
          customer_id: ownerCustomerId,
          fact_type: "fit_note",
          provenance_class: "advisor_observed",
          value_label: "E2E restricted measurement detail",
          sensitivity: "restricted",
          visibility: "customer_and_advisor",
          observed_at: new Date().toISOString(),
        },
        {
          retailer_id: fixtureCustomer.retailer_id,
          customer_id: otherCustomerId,
          fact_type: "colour_interest",
          provenance_class: "advisor_observed",
          value_label: "E2E other customer fact",
          sensitivity: "standard",
          visibility: "customer_and_advisor",
          observed_at: new Date().toISOString(),
        },
      ])
      .select("id, customer_id, value_label");
    if (sourceError || !sourceFacts) throw sourceError;
    const ownSource = sourceFacts.find(
      (fact) =>
        fact.customer_id === ownerCustomerId &&
        fact.value_label.includes("incorrect"),
    );
    const otherSource = sourceFacts.find(
      (fact) => fact.customer_id === otherCustomerId,
    );
    if (!ownSource || !otherSource) throw new Error("source facts missing");

    const { data: link, error: linkError } =
      await admin.auth.admin.generateLink({
        type: "magiclink",
        email: ownerEmail,
      });
    if (linkError || !link.properties) throw linkError;
    await page.goto(
      `/auth/confirm?token_hash=${link.properties.hashed_token}&type=magiclink`,
    );
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/account");
    await expect(
      page.getByRole("heading", { name: /House Memory/ }),
    ).toBeVisible();
    await expect(page.getByText("E2E incorrect navy preference")).toBeVisible();
    await expect(
      page.getByText("E2E restricted measurement detail"),
    ).toHaveCount(0);

    const correction = page.locator("li", {
      hasText: "E2E incorrect navy preference",
    });
    await correction
      .getByLabel("Correct or replace this")
      .fill("E2E prefers charcoal");
    await correction
      .getByLabel(/Why is this incorrect/)
      .fill("Navy is not preferred");
    await correction.getByRole("button", { name: "Submit correction" }).click();
    await expect(
      correction.getByText(
        "Your correction has been added to your House Memory.",
      ),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByText("E2E prefers charcoal")).toBeVisible();

    const { data: persistedSource, error: persistedSourceError } = await admin
      .from("customer_facts")
      .select("deleted_at, superseded_by_fact_id")
      .eq("id", ownSource.id)
      .single();
    if (persistedSourceError || !persistedSource) throw persistedSourceError;
    expect(persistedSource.deleted_at).toBeNull();
    expect(persistedSource.superseded_by_fact_id).toBeNull();

    const { data: declaredSuccessor, error: successorError } = await admin
      .from("customer_facts")
      .select("id, correction_of_fact_id, provenance_class, author_customer_id")
      .eq("correction_of_fact_id", ownSource.id)
      .eq("value_label", "E2E prefers charcoal")
      .single();
    if (successorError || !declaredSuccessor) throw successorError;
    expect(declaredSuccessor.provenance_class).toBe("customer_declared");
    expect(declaredSuccessor.author_customer_id).toBe(ownerCustomerId);

    const { data: correctionRows, error: correctionError } = await admin
      .from("customer_fact_corrections")
      .select("actor_customer_id, fact_id")
      .eq("fact_id", ownSource.id);
    if (correctionError) throw correctionError;
    expect(correctionRows).toContainEqual({
      actor_customer_id: ownerCustomerId,
      fact_id: ownSource.id,
    });

    const { data: otherLink, error: otherLinkError } =
      await admin.auth.admin.generateLink({
        type: "magiclink",
        email: otherEmail,
      });
    if (otherLinkError || !otherLink.properties) throw otherLinkError;
    const otherContext = await browser.newContext();
    try {
      const otherPage = await otherContext.newPage();
      await otherPage.goto(
        `/auth/confirm?token_hash=${otherLink.properties.hashed_token}&type=magiclink`,
      );
      await expect(otherPage).toHaveURL(/\/dashboard$/);
      const accessToken = accessTokenFromCookies(await otherContext.cookies());
      const crossCustomerAttempt = await otherPage.evaluate(
        async ({ apiUrl, publicKey, token, factId }) => {
          const response = await fetch(
            `${apiUrl}/rest/v1/rpc/correct_own_customer_fact`,
            {
              method: "POST",
              headers: {
                apikey: publicKey,
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                p_fact_id: factId,
                p_replacement_value_label:
                  "E2E forbidden cross-customer correction",
              }),
            },
          );
          return { ok: response.ok, body: await response.text() };
        },
        {
          apiUrl: supabaseUrl,
          publicKey: anonKey,
          token: accessToken,
          factId: ownSource.id,
        },
      );
      expect(crossCustomerAttempt.ok).toBe(false);
      expect(crossCustomerAttempt.body).toContain(
        "Fact is not available for customer correction",
      );
    } finally {
      await otherContext.close();
    }
  } finally {
    if (ownerCustomerId || otherCustomerId) {
      await admin
        .from("customers")
        .delete()
        .in(
          "id",
          [ownerCustomerId, otherCustomerId].filter((id): id is string =>
            Boolean(id),
          ),
        );
    }
    if (ownerUserId) await admin.auth.admin.deleteUser(ownerUserId);
    if (otherUserId) await admin.auth.admin.deleteUser(otherUserId);
  }
});
