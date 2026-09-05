"use server";

import {
  AnalyticsRepository,
  CustomerConsentRepository,
  CustomerRepository,
  InteractionSessionRepository,
  WishlistRepository,
} from "@paon/database";
import {
  asId,
  mayCapturePersonalizationForCustomer,
  retentionExpiresAt,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { assertRetailerModuleActive } from "@/lib/module-session";
import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

async function captureTieMateSignal(args: {
  readonly retailerId: string;
  readonly name: "product_favorited" | "product_skipped" | "tie_mate_impressed";
  readonly properties: Record<string, unknown>;
  readonly idempotencyKey?: string;
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
    deviceClass: "mobile",
  });

  await new AnalyticsRepository(supabase).capture({
    retailerId: rId,
    customerId: customer.id,
    sessionId: interactionSession.id,
    name: args.name,
    properties: args.properties,
    occurredAt,
    receivedAt: occurredAt,
    pagePath: "/tie-mate",
    deviceClass: "mobile",
    ...(args.idempotencyKey ? { idempotencyKey: args.idempotencyKey } : {}),
    source: "customer_portal",
    purpose: "personalization",
    consentBasis: "explicit_opt_in",
    consentSnapshot,
    retentionClass: "personalization_signal",
    retentionExpiresAt: retentionExpiresAt({ occurredAt }),
  });
}

/** Save the current fabric to the wishlist (Tie-Mate swipe-right / Save). */
export async function saveTieMateFabric(args: {
  readonly retailerId: string;
  readonly slug: string;
  readonly productVariantId: string;
  readonly productId: string;
}): Promise<
  { readonly ok: true } | { readonly ok: false; readonly error: string }
> {
  await requireSession();
  const supabase = await getSupabaseServerClient();
  const rId = asId<"RetailerId">(args.retailerId);

  try {
    await assertRetailerModuleActive(supabase, rId, "wardrobe_styling");
    await new WishlistRepository(supabase).toggleItem(
      rId,
      asId<"ProductVariantId">(args.productVariantId),
    );
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save fabric",
    };
  }

  try {
    await captureTieMateSignal({
      retailerId: args.retailerId,
      name: "product_favorited",
      properties: {
        productId: args.productId,
        productVariantId: args.productVariantId,
        via: "tie_mate",
      },
      idempotencyKey: `tie-mate:save:${args.productVariantId}:${args.retailerId}`,
    });
  } catch {
    // Best-effort — a failed capture must never block the save.
  }

  revalidatePath(`/r/${args.slug}/tie-mate`);
  revalidatePath("/wishlist");
  return { ok: true };
}

/** Skip the current fabric (Tie-Mate swipe-left). Consented signal only. */
export async function skipTieMateFabric(args: {
  readonly retailerId: string;
  readonly productId: string;
}): Promise<void> {
  await requireSession();
  try {
    await captureTieMateSignal({
      retailerId: args.retailerId,
      name: "product_skipped",
      properties: { productId: args.productId, via: "tie_mate" },
      idempotencyKey: `tie-mate:skip:${args.productId}:${Date.now()}`,
    });
  } catch {
    // Best-effort.
  }
}
