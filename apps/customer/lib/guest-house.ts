import "server-only";

import { RetailerRepository } from "@paon/database";
import { CANONICAL_DEMO_RETAILER_SLUG } from "@paon/database/demo-seed";
import { type RetailerId } from "@paon/domain";
import { cache } from "react";

import { getSupabaseServerClient } from "./supabase-server";

/**
 * The house a guest browses the Wardrobe as a client of: the public demo
 * storefront. Only its public projection (branches, price lists) is read
 * under it; everything customer-owned stays empty for the guest.
 */
export const getGuestRetailerId = cache(
  async function getGuestRetailerId(): Promise<RetailerId | null> {
    const supabase = await getSupabaseServerClient();
    const retailer = await new RetailerRepository(supabase).findBySlug(
      CANONICAL_DEMO_RETAILER_SLUG,
    );
    return retailer?.status === "active" ? retailer.id : null;
  },
);
