import { RetailerRepository } from "@paon/database";
import { cache } from "react";

import { getSupabaseServerClient } from "@/lib/supabase-server";

/** Request-scoped retailer lookup shared by the storefront layout and route. */
export const getStorefrontRetailer = cache(async (slug: string) => {
  const supabase = await getSupabaseServerClient();
  return new RetailerRepository(supabase).findBySlug(slug);
});
