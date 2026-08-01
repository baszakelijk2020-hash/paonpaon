import { createSupabaseAdminClient } from "@paon/database";
import { ensureProgrammeProofSeed } from "@paon/database/programme-proof-seed";
import { PROGRAMME_PROOF_RETAILER_SLUG } from "@paon/domain";
import { expect, test } from "@playwright/test";

import { TEST_RETAILER_SLUG } from "./fixtures";

test("canonical proof house is deep, rerunnable and isolated from demo/e2e tenants", async () => {
  test.setTimeout(300_000);
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;

  const first = await ensureProgrammeProofSeed({
    supabaseUrl,
    anonKey,
    serviceRoleKey,
  });
  const second = await ensureProgrammeProofSeed({
    supabaseUrl,
    anonKey,
    serviceRoleKey,
  });
  expect(second).toEqual(first);

  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const count = async (
    table:
      | "retailer_staff_members"
      | "customers"
      | "products"
      | "appointments"
      | "orders"
      | "alteration_work_orders",
  ) => {
    const { count: value, error } = await admin
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("retailer_id", first.retailerId);
    expect(error).toBeNull();
    return value ?? 0;
  };

  expect(await count("retailer_staff_members")).toBeGreaterThanOrEqual(6);
  // Twelve lived-in client-book stories plus two isolated wedding-party
  // participants created by the same deterministic seed.
  expect(await count("customers")).toBe(14);
  expect(await count("products")).toBeGreaterThanOrEqual(20);
  expect(await count("appointments")).toBeGreaterThanOrEqual(5);
  expect(await count("orders")).toBeGreaterThanOrEqual(10);
  expect(await count("alteration_work_orders")).toBeGreaterThanOrEqual(1);

  const { data: classes, error: classError } = await admin
    .from("retailers")
    .select("id, slug")
    .in("slug", [
      PROGRAMME_PROOF_RETAILER_SLUG,
      TEST_RETAILER_SLUG,
      "maison-dubois",
    ]);
  expect(classError).toBeNull();
  const idBySlug = new Map((classes ?? []).map((row) => [row.slug, row.id]));
  expect(idBySlug.get(PROGRAMME_PROOF_RETAILER_SLUG)).toBe(first.retailerId);
  expect(idBySlug.get(TEST_RETAILER_SLUG)).toBeTruthy();
  expect(idBySlug.get(TEST_RETAILER_SLUG)).not.toBe(first.retailerId);
  if (idBySlug.has("maison-dubois")) {
    expect(idBySlug.get("maison-dubois")).not.toBe(first.retailerId);
  }
});
