import {
  CustomerRepository,
  MetadataRepository,
  OrderRepository,
  ProductVariantRepository,
} from "@paon/database";
import {
  asId,
  rankCustomersBySpend,
  retailerRoleAtLeast,
  type CurrencyCode,
  type CustomerBuyerSegment,
  type CustomerOrderSummary,
} from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Card } from "@paon/ui/components/Card";
import { formatMoney } from "@paon/utils";
import Link from "next/link";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const SEGMENT_LABELS: Record<CustomerBuyerSegment, string> = {
  one_time: "One-time",
  repeat: "Repeat",
  seasonal: "Seasonal",
  dormant: "Dormant",
  suit_focused: "Suit-focused",
  casual_focused: "Casual-focused",
};

export default async function CustomerRankingsPage() {
  const session = await requireSession();
  if (!retailerRoleAtLeast(session.retailerRole, "manager")) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Customer rankings
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Not available for this role.
        </p>
      </div>
    );
  }
  const supabase = await getSupabaseServerClient();

  const [customers, orders] = await Promise.all([
    new CustomerRepository(supabase).findByRetailer(session.retailerId),
    new OrderRepository(supabase).findByRetailer(session.retailerId),
  ]);

  const nameByCustomerId = new Map(
    customers.map((customer) => [customer.id, customer.fullName]),
  );

  // Real, currently-placed revenue only — never a draft cart or a
  // canceled/refunded order counted as spend.
  const orderRepo = new OrderRepository(supabase);
  const completedOrders = orders.filter(
    (order) =>
      order.placedAt &&
      order.status !== "canceled" &&
      order.status !== "refunded",
  );

  const metadataRepo = new MetadataRepository(supabase);
  const variantRepo = new ProductVariantRepository(supabase);
  const garmentTypeConcepts = await metadataRepo.findVisibleConcepts(
    session.retailerId,
    "garment_type",
  );
  const garmentTypeConceptIds = new Set(
    garmentTypeConcepts.map((concept) => concept.id),
  );
  const garmentTypeSlugByConceptId = new Map(
    garmentTypeConcepts.map((concept) => [concept.id, concept.slug]),
  );
  // Cache per product id: which garment-type concepts it carries. Real
  // product count is bounded and far smaller than order-line count.
  const garmentTypeSlugsByProductId = new Map<string, string[]>();

  const summariesByCustomer = new Map<
    string,
    {
      totalSpendMinorUnits: number;
      currency: string;
      orderCount: number;
      orderMonths: number[];
      mostRecentOrderAt?: string;
      categoryCounts: Record<string, number>;
    }
  >();

  for (const order of completedOrders) {
    const existing = summariesByCustomer.get(order.customerId) ?? {
      totalSpendMinorUnits: 0,
      currency: order.total.currency,
      orderCount: 0,
      orderMonths: [],
      categoryCounts: {},
    };
    existing.totalSpendMinorUnits += order.total.amountMinorUnits;
    existing.orderCount += 1;
    if (order.placedAt) {
      existing.orderMonths.push(new Date(order.placedAt).getMonth() + 1);
      if (
        !existing.mostRecentOrderAt ||
        Date.parse(order.placedAt) > Date.parse(existing.mostRecentOrderAt)
      ) {
        existing.mostRecentOrderAt = order.placedAt;
      }
    }

    const lines = await orderRepo.findLinesByOrder(order.id);
    for (const line of lines) {
      const variant = await variantRepo.findById(line.productVariantId);
      if (!variant) continue;
      let slugs = garmentTypeSlugsByProductId.get(variant.productId);
      if (!slugs) {
        const conceptIds = await metadataRepo.findAcceptedConceptIdsForProduct(
          session.retailerId,
          variant.productId,
        );
        slugs = conceptIds
          .filter((id) => garmentTypeConceptIds.has(id))
          .map((id) => garmentTypeSlugByConceptId.get(id)!);
        garmentTypeSlugsByProductId.set(variant.productId, slugs);
      }
      for (const slug of slugs) {
        existing.categoryCounts[slug] =
          (existing.categoryCounts[slug] ?? 0) + 1;
      }
    }

    summariesByCustomer.set(order.customerId, existing);
  }

  const summaries: CustomerOrderSummary[] = [...summariesByCustomer.entries()]
    .map(([customerId, data]) => ({
      customerId,
      customerName:
        nameByCustomerId.get(asId<"CustomerId">(customerId)) ?? "Client",
      totalSpendMinorUnits: data.totalSpendMinorUnits,
      currency: data.currency,
      orderCount: data.orderCount,
      orderMonths: data.orderMonths,
      ...(data.mostRecentOrderAt
        ? { mostRecentOrderAt: data.mostRecentOrderAt }
        : {}),
      ...(Object.keys(data.categoryCounts).length > 0
        ? { categoryCounts: data.categoryCounts }
        : {}),
    }))
    .filter((summary) => summary.orderCount > 0);

  const rankings = rankCustomersBySpend(summaries, new Date());

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Customer rankings
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Best customers by real total spend, and honest buyer segments — every
          ranking and label computed from real orders, nothing hidden.
        </p>
      </div>

      <Card className="flex flex-col gap-0 divide-y divide-[var(--color-stone-100)] p-0">
        {rankings.length === 0 ? (
          <p className="p-5 text-sm text-[var(--color-stone-500)]">
            No placed orders yet.
          </p>
        ) : (
          rankings.map((ranking) => (
            <Link
              key={ranking.customerId}
              href={`/customers/${ranking.customerId}`}
              className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-[var(--color-stone-50)]"
            >
              <div className="flex items-center gap-4">
                <span className="font-display text-xl text-[var(--color-stone-400)]">
                  #{ranking.rank}
                </span>
                <div>
                  <p className="text-sm font-medium text-[var(--color-stone-900)]">
                    {ranking.customerName}
                  </p>
                  <p className="text-xs text-[var(--color-stone-500)]">
                    {ranking.orderCount} order
                    {ranking.orderCount === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex flex-wrap justify-end gap-1">
                  {ranking.segments.map((segment) => (
                    <Badge key={segment} tone="neutral">
                      {SEGMENT_LABELS[segment]}
                    </Badge>
                  ))}
                </div>
                <p className="w-28 text-right text-sm font-medium text-[var(--color-stone-900)]">
                  {formatMoney(
                    {
                      amountMinorUnits: ranking.totalSpendMinorUnits,
                      currency: ranking.currency as CurrencyCode,
                    },
                    "en-US",
                  )}
                </p>
              </div>
            </Link>
          ))
        )}
      </Card>
    </div>
  );
}
