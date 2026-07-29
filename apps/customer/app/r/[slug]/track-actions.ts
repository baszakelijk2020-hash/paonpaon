"use server";

import {
  AnalyticsRepository,
  CustomerConsentRepository,
  CustomerRepository,
} from "@paon/database";
import {
  asId,
  mayCapturePersonalizationForCustomer,
  retentionExpiresAt,
  type InteractionEventName,
} from "@paon/domain";

import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export type StorefrontTrackedEvent = Extract<
  InteractionEventName,
  | "product_viewed"
  | "category_browsed"
  | "search_performed"
  | "filter_applied"
  | "cart_updated"
  | "knowledge_opened"
  | "advisor_question"
  | "appointment_intent"
  | "conversion_recorded"
>;

/**
 * Feeds consented personalization signals (ADR-061 / PHASE 3.1).
 * Only fires for an identified, signed-in customer with personalization
 * consent. Anonymous storefront browsers are never tracked here (jurisdiction
 * gate). Best-effort: a failed capture must never break browsing.
 */
export async function trackStorefrontEvent(
  retailerId: string,
  name: StorefrontTrackedEvent,
  properties: Record<string, unknown>,
): Promise<void> {
  const session = await getSession();
  if (!session || session.accountType !== "customer") return;

  const supabase = await getSupabaseServerClient();
  const rId = asId<"RetailerId">(retailerId);

  try {
    const customers = await new CustomerRepository(supabase).findByUserId(
      session.userId,
    );
    const customer = customers.find((c) => c.retailerId === rId);
    if (!customer) return;

    const consentRepo = new CustomerConsentRepository(supabase);
    const consentState = await consentRepo.getState(rId, customer.id);
    if (!mayCapturePersonalizationForCustomer(consentState)) return;

    const occurredAt = new Date().toISOString();
    const consentSnapshot = await consentRepo.snapshotForCapture(
      rId,
      customer.id,
      occurredAt,
    );

    await new AnalyticsRepository(supabase).capture({
      retailerId: rId,
      customerId: customer.id,
      name,
      properties,
      occurredAt,
      source: "customer_portal",
      purpose: "personalization",
      consentBasis: "explicit_opt_in",
      consentSnapshot,
      retentionClass: "personalization_signal",
      retentionExpiresAt: retentionExpiresAt({ occurredAt }),
    });
  } catch {
    // Swallow — view tracking is not on the critical browsing path.
  }
}
