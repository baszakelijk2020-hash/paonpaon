"use server";

import {
  AnalyticsRepository,
  CustomerConsentRepository,
  CustomerRepository,
  InteractionSessionRepository,
  MetadataRepository,
  ProductRepository,
  ProductVariantRepository,
  StyleProfileRepository,
  WishlistRepository,
} from "@paon/database";
import {
  asId,
  defaultPolarityForEvidenceSource,
  evidenceSourceFromEventName,
  mayCapturePersonalizationForCustomer,
  retentionExpiresAt,
} from "@paon/domain";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

async function captureSwipeSignal(args: {
  readonly retailerId: string;
  readonly name: "product_favorited" | "product_skipped";
  readonly properties: Record<string, unknown>;
  readonly deckVersion: string;
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

  const interactionSession = await new InteractionSessionRepository(
    supabase,
  ).ensureForCustomer({
    retailerId: rId,
    customerId: customer.id,
    now: occurredAt,
    deviceClass: "unknown",
  });

  const productId = args.properties["productId"];
  if (typeof productId !== "string") return;

  const rawVariantId = args.properties["productVariantId"];
  const productVariantId =
    typeof rawVariantId === "string"
      ? asId<"ProductVariantId">(rawVariantId)
      : undefined;
  const metadataRepo = new MetadataRepository(supabase);
  const conceptIds = await metadataRepo.findAcceptedConceptIdsForProduct(
    rId,
    asId<"ProductId">(productId),
    productVariantId,
  );
  const captureProperties = {
    ...args.properties,
    deckVersion: args.deckVersion,
    conceptIds,
  };

  const sourceEventId = await new AnalyticsRepository(supabase).capture({
    retailerId: rId,
    customerId: customer.id,
    sessionId: interactionSession.id,
    name: args.name,
    properties: captureProperties,
    occurredAt,
    receivedAt: occurredAt,
    pagePath: "/swipe",
    deviceClass: "unknown",
    idempotencyKey: `swipe:${args.deckVersion}:${args.name}:${productId}:${consentState.updatedAt}`,
    source: "customer_portal",
    purpose: "personalization",
    consentBasis: "explicit_opt_in",
    consentSnapshot,
    retentionClass: "personalization_signal",
    retentionExpiresAt: retentionExpiresAt({ occurredAt }),
  });

  const source = evidenceSourceFromEventName(args.name);
  if (!source || conceptIds.length === 0) return;

  const styleRepo = new StyleProfileRepository(supabase);
  const polarity = defaultPolarityForEvidenceSource(source);
  for (const conceptId of conceptIds) {
    await styleRepo.recordEvidence(customer.id, {
      conceptId,
      source,
      polarity,
      confidence: 1,
      sourceEventId: asId<"BehavioralEventId">(sourceEventId),
    });
  }
  await styleRepo.recompute(rId, customer.id, occurredAt);
}

function assertDeckVersion(deckVersion: string): void {
  if (!/^[a-f0-9]{16}$/.test(deckVersion)) {
    throw new Error("Invalid swipe deck version");
  }
}

/** A swipe-right: saves the variant and logs a consented favorite signal. */
export async function swipeRight(
  retailerId: string,
  productVariantId: string,
  productId: string,
  deckVersion: string,
): Promise<void> {
  assertDeckVersion(deckVersion);
  await requireSession();
  const supabase = await getSupabaseServerClient();
  const rId = asId<"RetailerId">(retailerId);
  const pId = asId<"ProductId">(productId);
  const variantId = asId<"ProductVariantId">(productVariantId);
  const [product, variant] = await Promise.all([
    new ProductRepository(supabase).findById(pId),
    new ProductVariantRepository(supabase).findById(variantId),
  ]);
  if (
    !product ||
    product.retailerId !== rId ||
    product.status !== "active" ||
    !variant ||
    variant.productId !== pId
  ) {
    throw new Error("Swipe product is unavailable");
  }

  await new WishlistRepository(supabase).saveItem(rId, variantId);

  try {
    await captureSwipeSignal({
      retailerId,
      name: "product_favorited",
      properties: { productId, productVariantId, via: "swipe" },
      deckVersion,
    });
  } catch {
    // Best-effort — a failed capture must never block the save.
  }
}

/** A swipe-left: consented skip signal only. */
export async function swipeLeft(
  retailerId: string,
  productId: string,
  deckVersion: string,
): Promise<void> {
  assertDeckVersion(deckVersion);
  await requireSession();
  const supabase = await getSupabaseServerClient();
  const rId = asId<"RetailerId">(retailerId);
  const product = await new ProductRepository(supabase).findById(
    asId<"ProductId">(productId),
  );
  if (!product || product.retailerId !== rId || product.status !== "active") {
    throw new Error("Swipe product is unavailable");
  }
  try {
    await captureSwipeSignal({
      retailerId,
      name: "product_skipped",
      properties: { productId, via: "swipe" },
      deckVersion,
    });
  } catch {
    // Best-effort.
  }
}
