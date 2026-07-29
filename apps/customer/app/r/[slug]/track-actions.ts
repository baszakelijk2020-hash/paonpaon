"use server";

import {
  AnalyticsRepository,
  ConsentRepository,
  CustomerRepository,
} from "@paon/database";
import { asId, type InteractionEventType } from "@paon/domain";

import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export type StorefrontTrackedEvent = Extract<
  InteractionEventType,
  "product_viewed" | "category_browsed"
>;

/**
 * Feeds Self-Portrait when personalization consent is granted (ADR-061).
 * Best-effort: a failed capture must never break browsing.
 */
export async function trackStorefrontEvent(
  retailerId: string,
  interactionType: StorefrontTrackedEvent,
  properties: Record<string, unknown>,
): Promise<void> {
  const session = await getSession();
  if (!session || session.accountType !== "customer") return;

  const supabase = await getSupabaseServerClient();
  const rId = asId<"RetailerId">(retailerId);
  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const customer = customers.find((candidate) => candidate.retailerId === rId);
  if (!customer) return;

  try {
    const consentRepo = new ConsentRepository(supabase);
    await new AnalyticsRepository(supabase).captureWithConsent(
      {
        retailerId: rId,
        customerId: customer.id,
        interactionType,
        properties,
        occurredAt: new Date().toISOString(),
        source: "customer_portal",
      },
      consentRepo,
    );
  } catch {
    // Swallow — view tracking is not on the critical browsing path.
  }
}
