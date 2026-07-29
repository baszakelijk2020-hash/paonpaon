"use server";

import {
  AnalyticsRepository,
  ConsentRepository,
  CustomerRepository,
  WishlistRepository,
} from "@paon/database";
import { asId } from "@paon/domain";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

async function customerForRetailer(retailerId: string) {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const rId = asId<"RetailerId">(retailerId);
  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  return customers.find((candidate) => candidate.retailerId === rId) ?? null;
}

/** A swipe-right: saves the variant and logs `product_favorited` when
 * personalization consent is granted. */
export async function swipeRight(
  retailerId: string,
  productVariantId: string,
  productId: string,
): Promise<void> {
  await requireSession();
  const customer = await customerForRetailer(retailerId);
  if (!customer) return;

  const supabase = await getSupabaseServerClient();
  const rId = asId<"RetailerId">(retailerId);

  await new WishlistRepository(supabase).toggleItem(
    rId,
    asId<"ProductVariantId">(productVariantId),
  );

  try {
    const consentRepo = new ConsentRepository(supabase);
    await new AnalyticsRepository(supabase).captureWithConsent(
      {
        retailerId: rId,
        customerId: customer.id,
        interactionType: "product_favorited",
        properties: { productId, productVariantId, via: "swipe" },
        occurredAt: new Date().toISOString(),
        source: "customer_portal",
      },
      consentRepo,
    );
  } catch {
    // Best-effort — a failed capture must never block the save.
  }
}

/** A swipe-left: logs `product_skipped` when consent allows. */
export async function swipeLeft(
  retailerId: string,
  productId: string,
): Promise<void> {
  await requireSession();
  const customer = await customerForRetailer(retailerId);
  if (!customer) return;

  const supabase = await getSupabaseServerClient();
  try {
    const consentRepo = new ConsentRepository(supabase);
    await new AnalyticsRepository(supabase).captureWithConsent(
      {
        retailerId: asId<"RetailerId">(retailerId),
        customerId: customer.id,
        interactionType: "product_skipped",
        properties: { productId, via: "swipe" },
        occurredAt: new Date().toISOString(),
        source: "customer_portal",
      },
      consentRepo,
    );
  } catch {
    // Best-effort.
  }
}
