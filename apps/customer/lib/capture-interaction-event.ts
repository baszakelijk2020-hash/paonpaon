"use server";

import {
  AnalyticsRepository,
  CustomerConsentRepository,
  CustomerRepository,
  StyleProfileRepository,
} from "@paon/database";
import {
  asId,
  conceptIdsFromEventProperties,
  defaultPolarityForEvidenceSource,
  evidenceSourceFromEventName,
  mayCapturePersonalizationForCustomer,
  validateCaptureInteractionEvent,
  type InteractionEventName,
} from "@paon/domain";

import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface CaptureSignedInInteractionEventInput {
  readonly retailerId: string;
  readonly name: InteractionEventName;
  readonly properties?: Record<string, unknown>;
  readonly sessionId?: string;
  readonly idempotencyKey?: string;
  readonly occurredAt?: string;
}

export interface CaptureSignedInInteractionEventResult {
  readonly captured: boolean;
  readonly eventId?: string;
}

/**
 * Consent-gated capture for signed-in customer personalization signals.
 * Best-effort: callers should ignore `{ captured: false }` without throwing.
 */
export async function captureSignedInInteractionEvent(
  input: CaptureSignedInInteractionEventInput,
): Promise<CaptureSignedInInteractionEventResult> {
  const session = await getSession();
  if (!session || session.accountType !== "customer") {
    return { captured: false };
  }

  const supabase = await getSupabaseServerClient();
  const retailerId = asId<"RetailerId">(input.retailerId);

  try {
    const customers = await new CustomerRepository(supabase).findByUserId(
      session.userId,
    );
    const customer = customers.find((c) => c.retailerId === retailerId);
    if (!customer) return { captured: false };

    const consentRepo = new CustomerConsentRepository(supabase);
    const consentState = await consentRepo.getState(retailerId, customer.id);
    if (!mayCapturePersonalizationForCustomer(consentState)) {
      return { captured: false };
    }

    const occurredAt = input.occurredAt ?? new Date().toISOString();
    const consentSnapshot = await consentRepo.snapshotForCapture(
      retailerId,
      customer.id,
      occurredAt,
    );

    const properties = {
      ...(input.properties ?? {}),
      ...(input.sessionId ? { sessionId: input.sessionId } : {}),
      ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
    };

    const validation = validateCaptureInteractionEvent({
      retailerId,
      customerId: customer.id,
      name: input.name,
      properties,
      occurredAt,
      source: "customer_portal",
      purpose: "personalization",
      consentBasis: "explicit_opt_in",
      consentSnapshot,
      ...(input.sessionId
        ? {
            sessionId: asId<"CustomerInteractionSessionId">(input.sessionId),
          }
        : {}),
      ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
    });
    if (!validation.ok || !validation.event) return { captured: false };

    const eventId = await new AnalyticsRepository(supabase).capture(
      validation.event,
    );

    const source = evidenceSourceFromEventName(input.name);
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
      await styleRepo.recompute(retailerId, customer.id, occurredAt);
    }

    return { captured: true, eventId };
  } catch {
    return { captured: false };
  }
}
