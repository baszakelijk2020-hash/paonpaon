"use server";

import { AnalyticsRepository } from "@paon/database";
import { asId } from "@paon/domain";

import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export type StorefrontTrackedEvent = "product_viewed" | "category_browsed";

/**
 * Feeds Self-Portrait (ADR-034) — only fires for an identified,
 * signed-in customer, matching `capture_behavioral_event`'s own
 * `source = 'customer_portal'` re-derivation of `customer_id` from
 * `auth.uid()`; an anonymous storefront browser is never tracked here.
 * Best-effort: a failed capture must never break browsing.
 */
export async function trackStorefrontEvent(
  retailerId: string,
  name: StorefrontTrackedEvent,
  properties: Record<string, unknown>,
): Promise<void> {
  const session = await getSession();
  if (!session || session.accountType !== "customer") return;

  const supabase = await getSupabaseServerClient();
  try {
    await new AnalyticsRepository(supabase).capture({
      retailerId: asId<"RetailerId">(retailerId),
      name,
      properties,
      occurredAt: new Date().toISOString(),
      source: "customer_portal",
    });
  } catch {
    // Swallow — view tracking is not on the critical browsing path.
  }
}
