"use server";

import {
  AnalyticsRepository,
  CustomerConsentRepository,
  CustomerRepository,
  StyleProfileRepository,
  TableServiceRepository,
  WishlistRepository,
} from "@paon/database";
import {
  asId,
  defaultPolarityForEvidenceSource,
  evidenceSourceFromEventName,
  mayCapturePersonalizationForCustomer,
  retentionExpiresAt,
  type ProductId,
  type MetadataConceptId,
} from "@paon/domain";

import { requireSession } from "@/lib/session";
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

  await new AnalyticsRepository(supabase).capture({
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

  const conceptIds = args.properties.conceptIds;
  if (Array.isArray(conceptIds) && conceptIds.length > 0) {
    const styleRepo = new StyleProfileRepository(supabase);
    const source = evidenceSourceFromEventName(args.name);
    if (source) {
      const polarity = defaultPolarityForEvidenceSource(source);
      for (const rawId of conceptIds) {
        if (typeof rawId !== "string") continue;
        await styleRepo.recordEvidence(customer.id, {
          conceptId: asId<"MetadataConceptId">(rawId),
          source,
          polarity,
          confidence: 1,
        });
      }
      await styleRepo.recompute(rId, customer.id, occurredAt);
    }
  }
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
  const pId = asId<"ProductId">(productId);

  await new WishlistRepository(supabase).toggleItem(
    rId,
    asId<"ProductVariantId">(productVariantId),
  );

  let conceptIds: string[] = [];
  try {
    conceptIds = [
      ...(await new TableServiceRepository(supabase).loadProductConceptIds(
        rId,
        pId,
      )),
    ].map(String);
  } catch {
    conceptIds = [];
  }

  try {
    await captureSwipeSignal({
      retailerId,
      name: "product_favorited",
      properties: {
        productId,
        productVariantId,
        via: "swipe",
        ...(conceptIds.length > 0 ? { conceptIds } : {}),
      },
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
  const supabase = await getSupabaseServerClient();
  const rId = asId<"RetailerId">(retailerId);
  const pId = asId<"ProductId">(productId);

  let conceptIds: string[] = [];
  try {
    conceptIds = [
      ...(await new TableServiceRepository(supabase).loadProductConceptIds(
        rId,
        pId,
      )),
    ].map(String);
  } catch {
    conceptIds = [];
  }

  try {
    await captureSwipeSignal({
      retailerId,
      name: "product_skipped",
      properties: {
        productId,
        via: "swipe",
        ...(conceptIds.length > 0 ? { conceptIds } : {}),
      },
    });
  } catch {
    // Best-effort.
  }
}
