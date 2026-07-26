import {
  OrderRepository,
  ProductRepository,
  ProductVariantRepository,
} from "@paon/database";
import { NextResponse } from "next/server";

import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * The real backend behind paon.html's "Continue In-Store" / "Add to Bag"
 * buttons — the original file just opens a decorative modal; this adds
 * the item to the customer's real cart via the same repository the
 * existing Server Action path uses.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.accountType !== "customer") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = (await request.json()) as { variantId?: string };
  if (!body.variantId) {
    return NextResponse.json({ error: "missing variantId" }, { status: 400 });
  }

  const supabase = await getSupabaseServerClient();
  const variantRepo = new ProductVariantRepository(supabase);
  const variant = await variantRepo.findById(body.variantId as never);
  if (!variant) {
    return NextResponse.json({ error: "variant not found" }, { status: 404 });
  }

  const product = await new ProductRepository(supabase).findById(
    variant.productId,
  );
  if (!product) {
    return NextResponse.json({ error: "product not found" }, { status: 404 });
  }

  try {
    await new OrderRepository(supabase).addToCart({
      retailerId: product.retailerId,
      productVariantId: variant.id,
      quantity: 1,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
