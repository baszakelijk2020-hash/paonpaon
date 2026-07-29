"use server";

import {
  AnalyticsRepository,
  CustomerConsentRepository,
  CustomerRepository,
  WishlistRepository,
} from "@paon/database";
import {
  asId,
  mayCapturePersonalizationForCustomer,
  retentionExpiresAt,
} from "@paon/domain";

import { requireSession } from "@/lib/session";
import { recordStyleEvidenceForInteraction } from "@/lib/style-profile-capture";
import { getSupabaseServerClient } from "@/lib/supabase-server";

async function captureSwipeSignal(args: {
  readonly retailerId: string;
  readonly name: "product_favorited" | "product_skipped";
  readonly properties: Record<string, unknown>;
}): Promise<void> {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const rId = asId<"RetailerId">(args.retailerId);

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

  const eventId = await new AnalyticsRepository(supabase).capture({
    retailerId: rId,
    customerId: customer.id,
    name: args.name,
    properties: args.properties,
    occurredAt,
    source: "customer_portal",
    purpose: "personalization",
    consentBasis: "explicit_opt_in",
    consentSnapshot,
    retentionClass: "personalization_signal",
    retentionExpiresAt: retentionExpiresAt({ occurredAt }),
  });

  await recordStyleEvidenceForInteraction({
    supabase,
    retailerId: rId,
    customerId: customer.id,
    personalizationGranted: true,
    eventId,
    name: args.name,
    properties: args.properties,
  });
}

/** A swipe-right: saves the variant and logs a consented favorite signal. */
export async function swipeRight(
  retailerId: string,
  productVariantId: string,
  productId: string,
): Promise<void> {
  await requireSession();
  const supabase = await getSupabaseServerClient();
  const rId = asId<"RetailerId">(retailerId);

  await new WishlistRepository(supabase).toggleItem(
    rId,
    asId<"ProductVariantId">(productVariantId),
  );

  try {
    await captureSwipeSignal({
      retailerId,
      name: "product_favorited",
      properties: { productId, productVariantId, via: "swipe" },
    });
  } catch {
    // Best-effort — a failed capture must never block the save.
  }
}

/** A swipe-left: consented skip signal only. */
export async function swipeLeft(
  retailerId: string,
  productId: string,
): Promise<void> {
  await requireSession();
  try {
    await captureSwipeSignal({
      retailerId,
      name: "product_skipped",
      properties: { productId, via: "swipe" },
    });
  } catch {
    // Best-effort.
  }
}
