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
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const FEEDBACK_EVENTS = new Set<InteractionEventName>([
  "for_you_impressed",
  "for_you_clicked",
  "for_you_dismissed",
  "for_you_corrected",
]);

export async function recordForYouFeedback(formData: FormData): Promise<void> {
  const session = await requireSession();
  const eventName = formData.get("eventName");
  const productId = formData.get("productId");
  const retailerId = formData.get("retailerId");
  const customerId = formData.get("customerId");
  if (
    typeof eventName !== "string" ||
    typeof productId !== "string" ||
    typeof retailerId !== "string" ||
    typeof customerId !== "string" ||
    !FEEDBACK_EVENTS.has(eventName as InteractionEventName)
  ) {
    return;
  }

  const supabase = await getSupabaseServerClient();
  const customer = await new CustomerRepository(supabase).findById(
    asId<"CustomerId">(customerId),
  );
  if (!customer || customer.userId !== session.userId) {
    return;
  }

  const rId = asId<"RetailerId">(retailerId);
  const consentRepo = new CustomerConsentRepository(supabase);
  const consentState = await consentRepo.getState(rId, customer.id);
  if (!mayCapturePersonalizationForCustomer(consentState)) {
    return;
  }

  const occurredAt = new Date().toISOString();
  const consentSnapshot = await consentRepo.snapshotForCapture(
    rId,
    customer.id,
    occurredAt,
  );

  await new AnalyticsRepository(supabase).capture({
    retailerId: rId,
    customerId: customer.id,
    name: eventName as InteractionEventName,
    properties: { productId },
    occurredAt,
    receivedAt: occurredAt,
    pagePath: "/for-you",
    idempotencyKey: `for-you:${eventName}:${customer.id}:${productId}:${occurredAt.slice(0, 13)}`,
    source: "customer_portal",
    purpose: "personalization",
    consentBasis: "explicit_opt_in",
    consentSnapshot,
    retentionClass: "personalization_signal",
    retentionExpiresAt: retentionExpiresAt({ occurredAt }),
  });

  revalidatePath("/for-you");
}
