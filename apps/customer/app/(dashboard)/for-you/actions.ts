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

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

async function captureForYouSignal(args: {
  readonly retailerId: string;
  readonly customerId: string;
  readonly name:
    | "for_you_impressed"
    | "for_you_clicked"
    | "for_you_dismissed"
    | "for_you_correction";
  readonly properties: Record<string, unknown>;
  readonly idempotencyKey?: string;
}): Promise<{ readonly ok: true } | { readonly ok: false; readonly error: string }> {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const rId = asId<"RetailerId">(args.retailerId);
  const cId = asId<"CustomerId">(args.customerId);

  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const customer = customers.find(
    (candidate) =>
      candidate.id === args.customerId && candidate.retailerId === args.retailerId,
  );
  if (!customer) {
    return { ok: false, error: "Customer relationship not found." };
  }

  const consentRepo = new CustomerConsentRepository(supabase);
  const consentState = await consentRepo.getState(rId, cId);
  if (!mayCapturePersonalizationForCustomer(consentState)) {
    return { ok: false, error: "Personalization consent is not granted." };
  }

  const occurredAt = new Date().toISOString();
  const consentSnapshot = await consentRepo.snapshotForCapture(
    rId,
    cId,
    occurredAt,
  );

  const interactionSession = await new InteractionSessionRepository(
    supabase,
  ).ensureForCustomer({
    retailerId: rId,
    customerId: cId,
    now: occurredAt,
    deviceClass: "desktop",
  });

  await new AnalyticsRepository(supabase).capture({
    retailerId: rId,
    customerId: cId,
    sessionId: interactionSession.id,
    name: args.name,
    properties: args.properties,
    occurredAt,
    receivedAt: occurredAt,
    pagePath: "/for-you",
    deviceClass: "desktop",
    ...(args.idempotencyKey ? { idempotencyKey: args.idempotencyKey } : {}),
    source: "customer_portal",
    purpose: "personalization",
    consentBasis: "explicit_opt_in",
    consentSnapshot,
    retentionClass: "personalization_signal",
    retentionExpiresAt: retentionExpiresAt({ occurredAt }),
  });

  return { ok: true };
}

export async function recordForYouImpression(args: {
  readonly retailerId: string;
  readonly customerId: string;
  readonly productId: string;
  readonly rank: number;
}): Promise<void> {
  try {
    await captureForYouSignal({
      retailerId: args.retailerId,
      customerId: args.customerId,
      name: "for_you_impressed",
      properties: {
        productId: args.productId,
        rank: args.rank,
        surface: "for_you",
      },
      idempotencyKey: `for-you:impression:${args.productId}:${args.rank}`,
    });
  } catch {
    // Best-effort learning signal.
  }
}

export async function recordForYouClick(args: {
  readonly retailerId: string;
  readonly customerId: string;
  readonly productId: string;
  readonly productSlug: string;
}): Promise<void> {
  try {
    await captureForYouSignal({
      retailerId: args.retailerId,
      customerId: args.customerId,
      name: "for_you_clicked",
      properties: {
        productId: args.productId,
        productSlug: args.productSlug,
        surface: "for_you",
      },
      idempotencyKey: `for-you:click:${args.productId}`,
    });
  } catch {
    // Best-effort.
  }
}

export async function dismissForYouRecommendation(args: {
  readonly retailerId: string;
  readonly customerId: string;
  readonly productId: string;
}): Promise<
  { readonly ok: true } | { readonly ok: false; readonly error: string }
> {
  const result = await captureForYouSignal({
    retailerId: args.retailerId,
    customerId: args.customerId,
    name: "for_you_dismissed",
    properties: {
      productId: args.productId,
      surface: "for_you",
    },
    idempotencyKey: `for-you:dismiss:${args.productId}`,
  });
  if (result.ok) {
    revalidatePath("/for-you");
  }
  return result;
}

export async function correctForYouRecommendation(args: {
  readonly retailerId: string;
  readonly customerId: string;
  readonly productId: string;
  readonly conceptId: string;
  readonly label: string;
}): Promise<
  { readonly ok: true } | { readonly ok: false; readonly error: string }
> {
  const captureResult = await captureForYouSignal({
    retailerId: args.retailerId,
    customerId: args.customerId,
    name: "for_you_correction",
    properties: {
      productId: args.productId,
      conceptId: args.conceptId,
      label: args.label,
      surface: "for_you",
    },
    idempotencyKey: `for-you:correction:${args.productId}:${args.conceptId}`,
  });
  if (!captureResult.ok) return captureResult;

  revalidatePath("/for-you");
  return { ok: true };
}

export async function saveForYouRecommendation(args: {
  readonly retailerId: string;
  readonly productVariantId: string;
}): Promise<
  { readonly ok: true } | { readonly ok: false; readonly error: string }
> {
  await requireSession();
  const supabase = await getSupabaseServerClient();
  try {
    await new WishlistRepository(supabase).toggleItem(
      asId<"RetailerId">(args.retailerId),
      asId<"ProductVariantId">(args.productVariantId),
    );
    revalidatePath("/wishlist");
    revalidatePath("/for-you");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save item.",
    };
  }
}
