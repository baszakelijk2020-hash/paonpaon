import type { RetailerId } from "@paon/domain";

import type { PaonSupabaseClient } from "../../client-type";

interface StaffFixture {
  id: string;
  retailerId: RetailerId;
  role: string;
}

const FIXTURE_RETAILER_SLUG = "integration-proof-house";
const FIXTURE_PRODUCT_SLUG = "integration-proof-jacket";

async function ensureFixtureRetailer(
  client: PaonSupabaseClient,
): Promise<RetailerId> {
  const { error: upsertError } = await client.from("retailers").upsert(
    {
      legal_name: "Integration Proof House Ltd",
      display_name: "Integration Proof House",
      slug: FIXTURE_RETAILER_SLUG,
      status: "active",
      tier: "house",
    },
    { onConflict: "slug", ignoreDuplicates: true },
  );
  if (upsertError) throw upsertError;

  const { data, error } = await client
    .from("retailers")
    .select("id")
    .eq("slug", FIXTURE_RETAILER_SLUG)
    .single();
  if (error) throw error;
  return data.id as RetailerId;
}

async function ensureFixtureStaff(
  client: PaonSupabaseClient,
  retailerId: RetailerId,
): Promise<StaffFixture[]> {
  const acceptedAt = "2026-08-01T00:00:00.000Z";
  const { error: upsertError } = await client
    .from("retailer_staff_members")
    .upsert(
      [
        {
          retailer_id: retailerId,
          full_name: "Integration Proof Owner",
          email: "integration-proof-owner@paon.test",
          role: "owner",
          accepted_at: acceptedAt,
        },
        {
          retailer_id: retailerId,
          full_name: "Integration Proof Manager",
          email: "integration-proof-manager@paon.test",
          role: "manager",
          accepted_at: acceptedAt,
        },
      ],
      { onConflict: "retailer_id,email", ignoreDuplicates: true },
    );
  if (upsertError) throw upsertError;

  const { data, error } = await client
    .from("retailer_staff_members")
    .select("id, retailer_id, role")
    .eq("retailer_id", retailerId)
    .in("email", [
      "integration-proof-owner@paon.test",
      "integration-proof-manager@paon.test",
    ])
    .is("deleted_at", null)
    .order("email");
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    retailerId: row.retailer_id as RetailerId,
    role: row.role,
  }));
}

export async function findStaffCohort(
  client: PaonSupabaseClient,
  minimumStaff: number,
): Promise<{ retailerId: RetailerId; staff: StaffFixture[] }> {
  const retailerId = await ensureFixtureRetailer(client);
  const staff = await ensureFixtureStaff(client, retailerId);
  if (staff.length < minimumStaff) {
    throw new Error(
      `Integration fixture needs one retailer with at least ${minimumStaff} active staff member(s).`,
    );
  }
  return { retailerId, staff };
}

export async function findProductId(
  client: PaonSupabaseClient,
  retailerId: RetailerId,
): Promise<string> {
  const { error: productUpsertError } = await client.from("products").upsert(
    {
      retailer_id: retailerId,
      name: "Integration Proof Jacket",
      slug: FIXTURE_PRODUCT_SLUG,
      description: "Stable disposable integration fixture",
      status: "active",
    },
    { onConflict: "retailer_id,slug", ignoreDuplicates: true },
  );
  if (productUpsertError) throw productUpsertError;

  const { data, error } = await client
    .from("products")
    .select("id")
    .eq("retailer_id", retailerId)
    .eq("slug", FIXTURE_PRODUCT_SLUG)
    .single();
  if (error) throw error;
  return data.id;
}

export async function findVariantIds(
  client: PaonSupabaseClient,
  retailerId: RetailerId,
  minimumVariants: number,
): Promise<string[]> {
  const productId = await findProductId(client, retailerId);
  const { error: upsertError } = await client.from("product_variants").upsert(
    [
      {
        product_id: productId,
        sku: "INTEGRATION-PROOF-ONE",
        price_amount_minor_units: 10000,
        price_currency: "EUR",
        inventory_quantity: 0,
      },
      {
        product_id: productId,
        sku: "INTEGRATION-PROOF-TWO",
        price_amount_minor_units: 12000,
        price_currency: "EUR",
        inventory_quantity: 0,
      },
    ],
    { onConflict: "product_id,sku", ignoreDuplicates: true },
  );
  if (upsertError) throw upsertError;

  const { data: variants, error: variantError } = await client
    .from("product_variants")
    .select("id")
    .eq("product_id", productId)
    .in("sku", ["INTEGRATION-PROOF-ONE", "INTEGRATION-PROOF-TWO"])
    .is("deleted_at", null)
    .order("sku")
    .limit(Math.max(minimumVariants, 1));
  if (variantError) throw variantError;

  const variantIds = (variants ?? []).map((variant) => variant.id);
  if (variantIds.length < minimumVariants) {
    throw new Error(
      `Integration fixture needs ${minimumVariants} active variant(s) for one retailer.`,
    );
  }
  return variantIds;
}

export async function findCustomerId(
  client: PaonSupabaseClient,
  retailerId: RetailerId,
): Promise<string> {
  const email = "integration-proof-customer@paon.test";
  const { data: existing, error: findError } = await client
    .from("customers")
    .select("id")
    .eq("retailer_id", retailerId)
    .eq("email", email)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return existing.id;

  const { data, error } = await client
    .from("customers")
    .insert({
      retailer_id: retailerId,
      full_name: "Integration Proof Customer",
      email,
      lifecycle_stage: "returning",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}
