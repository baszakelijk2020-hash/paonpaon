import {
  CustomerRepository,
  OrderRepository,
  ProductRepository,
  ProductVariantRepository,
  RetailerRepository,
} from "@paon/database";
import { formatMoney } from "@paon/utils";
import { NextResponse } from "next/server";

import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Backs the floating basket widget appended to `paon-template.html` — the
 * raw-served storefront page has no React tree to read cart state from,
 * so this returns an already-formatted summary the widget's own
 * `fetch()` can render directly. Unauthenticated visitors get an empty,
 * not-authenticated summary rather than a 401 — the basket rectangle is
 * always present on the page (per the founder's spec: "not a floating
 * pill or toast"), it just has nothing in it yet.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const session = await getSession();
  if (!session || session.accountType !== "customer") {
    return NextResponse.json({
      authenticated: false,
      count: 0,
      lines: [],
      total: "",
    });
  }

  const supabase = await getSupabaseServerClient();
  const retailer = await new RetailerRepository(supabase).findBySlug(slug);
  if (!retailer) {
    return NextResponse.json({
      authenticated: false,
      count: 0,
      lines: [],
      total: "",
    });
  }

  const relationships = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const customer = relationships.find(
    (item) => item.retailerId === retailer.id,
  );
  if (!customer) {
    return NextResponse.json({
      authenticated: true,
      count: 0,
      lines: [],
      total: "",
    });
  }

  const orderRepo = new OrderRepository(supabase);
  const cart = await orderRepo.findCart(retailer.id, customer.id);
  if (!cart) {
    return NextResponse.json({
      authenticated: true,
      count: 0,
      lines: [],
      total: "",
    });
  }

  const orderLines = await orderRepo.findLinesByOrder(cart.id);
  const variantRepo = new ProductVariantRepository(supabase);
  const productRepo = new ProductRepository(supabase);

  const lines = await Promise.all(
    orderLines.map(async (line) => {
      const variant = await variantRepo.findById(line.productVariantId);
      const product = variant
        ? await productRepo.findById(variant.productId)
        : null;
      return {
        lineId: line.id,
        name: product?.name ?? "Item",
        variantLabel:
          [variant?.size, variant?.color].filter(Boolean).join(" · ") ||
          variant?.sku ||
          "",
        quantity: line.quantity,
        unitPrice: formatMoney(line.unitPrice, "en-US"),
        lineTotal: formatMoney(
          {
            amountMinorUnits: line.unitPrice.amountMinorUnits * line.quantity,
            currency: line.unitPrice.currency,
          },
          "en-US",
        ),
      };
    }),
  );

  const totalMinor = orderLines.reduce(
    (sum, line) => sum + line.unitPrice.amountMinorUnits * line.quantity,
    0,
  );
  const currency = orderLines[0]?.unitPrice.currency ?? "EUR";

  return NextResponse.json({
    authenticated: true,
    count: orderLines.reduce((sum, line) => sum + line.quantity, 0),
    lines,
    total: formatMoney({ amountMinorUnits: totalMinor, currency }, "en-US"),
  });
}
