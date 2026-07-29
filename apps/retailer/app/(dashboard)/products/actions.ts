"use server";

import { requireRetailerRole } from "@paon/auth";
import { ProductVariantRepository } from "@paon/database";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface LowStockRow {
  sku: string;
  productName: string;
  inventoryQuantity: number;
  productId: string;
}

/** High 24/35 mitigation: rows for a client-side CSV export — no report
 * infrastructure exists yet, so this just hands back the same
 * low-stock join the dashboard's attention tile already counts. */
export async function getLowStockRows(): Promise<LowStockRow[]> {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "manager");
  const supabase = await getSupabaseServerClient();
  const rows = await new ProductVariantRepository(
    supabase,
  ).findLowStockForRetailer(session.retailerId, 5);
  return rows.map((row) => ({
    sku: row.sku,
    productName: row.productName,
    inventoryQuantity: row.inventoryQuantity,
    productId: row.productId,
  }));
}
