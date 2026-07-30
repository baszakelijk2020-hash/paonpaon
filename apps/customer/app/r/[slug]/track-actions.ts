"use server";

import {
  AnalyticsRepository,
  CustomerConsentRepository,
  CustomerRepository,
  InteractionSessionRepository,
  StyleProfileRepository,
} from "@paon/database";
import {
  asId,
  conceptIdsFromEventProperties,
  defaultPolarityForEvidenceSource,
  evidenceSourceFromEventName,
  mayCapturePersonalizationForCustomer,
  retentionExpiresAt,
  type InteractionDeviceClass,
  type InteractionEventName,
} from "@paon/domain";

import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export type StorefrontTrackedEvent = Extract<
  InteractionEventName,
  | "page_viewed"
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

function resolveDeviceClass(
  value: unknown,
): InteractionDeviceClass | undefined {
  if (
    value === "mobile" ||
    value === "tablet" ||
    value === "desktop" ||
    value === "unknown"
  ) {
    return value;
  }
  return undefined;
}

/**
 * Feeds consented personalization signals (ADR-061 / PHASE 3.1 / 7.2).
 * Only fires for an identified, signed-in customer with personalization
 * consent. Anonymous storefront browsers are never tracked here (jurisdiction
 * gate). Best-effort: a failed capture must never break browsing.
 * Ensures an interaction session and stamps idempotency when provided.
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

    const deviceClass = resolveDeviceClass(properties.deviceClass);
    const pagePath =
      typeof properties.pagePath === "string" ? properties.pagePath : undefined;
    const idempotencyKey =
      typeof properties.idempotencyKey === "string"
        ? properties.idempotencyKey
        : undefined;

    const interactionSession = await new InteractionSessionRepository(
      supabase,
    ).ensureForCustomer({
      retailerId: rId,
      customerId: customer.id,
      now: occurredAt,
      ...(deviceClass ? { deviceClass } : {}),
    });

    const captureProperties = { ...properties };
    delete captureProperties.password;
    delete captureProperties.cardNumber;
    delete captureProperties.cvv;
    delete captureProperties.credentials;
    delete captureProperties.rawForm;
    delete captureProperties.formValues;

    await new AnalyticsRepository(supabase).capture({
      retailerId: rId,
      customerId: customer.id,
      sessionId: interactionSession.id,
      name,
      properties: captureProperties,
      occurredAt,
      receivedAt: occurredAt,
      ...(pagePath ? { pagePath } : {}),
      ...(deviceClass ? { deviceClass } : {}),
      ...(idempotencyKey ? { idempotencyKey } : {}),
      source: "customer_portal",
      purpose: "personalization",
      consentBasis: "explicit_opt_in",
      consentSnapshot,
      retentionClass: "personalization_signal",
      retentionExpiresAt: retentionExpiresAt({ occurredAt }),
    });

    const source = evidenceSourceFromEventName(name);
    const conceptIds = conceptIdsFromEventProperties(properties);
    if (source && conceptIds.length > 0) {
      const styleRepo = new StyleProfileRepository(supabase);
      const polarity = defaultPolarityForEvidenceSource(source);
      for (const conceptId of conceptIds) {
        await styleRepo.recordEvidence(customer.id, {
          conceptId,
          source,
          polarity,
          confidence: 1,
        });
      }
      await styleRepo.recompute(rId, customer.id, occurredAt);
    }
  } catch {
    // Swallow — view tracking is not on the critical browsing path.
  }
}
