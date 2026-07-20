import {
  OrderRepository,
  PaymentRepository,
  ProductVariantRepository,
  RetailerRepository,
} from "@paon/database";
import { asId } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Card } from "@paon/ui/components/Card";
import { formatDate, formatMoney } from "@paon/utils";
import { notFound } from "next/navigation";

import { PayPanel } from "./pay-panel";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ payment?: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const { payment } = await searchParams;
  const supabase = await getSupabaseServerClient();

  const orderRepo = new OrderRepository(supabase);
  const order = await orderRepo.findById(asId<"OrderId">(id));
  if (!order) {
    notFound();
  }

  const [lines, retailer, paymentRecord] = await Promise.all([
    orderRepo.findLinesByOrder(order.id),
    new RetailerRepository(supabase).findById(order.retailerId),
    new PaymentRepository(supabase).findByOrder(order.id),
  ]);

  const variantRepo = new ProductVariantRepository(supabase);
  const variants = await Promise.all(
    lines.map((line) => variantRepo.findById(line.productVariantId)),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-medium text-[var(--color-stone-900)]">
            {order.orderNumber}
          </h1>
          <Badge tone="warning">{order.status.replaceAll("_", " ")}</Badge>
        </div>
        <p className="text-sm text-[var(--color-stone-500)]">
          {retailer?.displayName ?? "Unknown retailer"} ·{" "}
          {formatDate(order.createdAt, "en-US")}
        </p>
      </div>

      <Card className="divide-y divide-[var(--color-stone-100)] p-0">
        {lines.map((line, index) => {
          const variant = variants[index];
          return (
            <div
              key={line.id}
              className="flex items-center justify-between px-6 py-4"
            >
              <div>
                <p className="font-medium text-[var(--color-stone-900)]">
                  {variant?.sku ?? "Item"}
                </p>
                <p className="text-sm text-[var(--color-stone-500)]">
                  Qty {line.quantity}
                </p>
              </div>
              <p className="font-medium text-[var(--color-stone-900)]">
                {formatMoney(line.unitPrice, "en-US")}
              </p>
            </div>
          );
        })}
      </Card>

      <Card className="flex items-center justify-between">
        <p className="font-medium text-[var(--color-stone-900)]">Total</p>
        <p className="font-medium text-[var(--color-stone-900)]">
          {formatMoney(order.total, "en-US")}
        </p>
      </Card>

      {order.status === "pending_payment" ? (
        payment === "success" ? (
          <p className="text-sm text-[var(--color-stone-500)]">
            Confirming your payment — this can take a few seconds. Refresh if
            the status above doesn&rsquo;t update.
          </p>
        ) : (
          <PayPanel
            orderId={order.id}
            paymentCanceled={payment === "canceled"}
          />
        )
      ) : paymentRecord?.status === "captured" ? (
        <p className="text-sm text-[var(--color-stone-500)]">
          Paid {formatMoney(paymentRecord.amount, "en-US")}
          {paymentRecord.capturedAt
            ? ` on ${formatDate(paymentRecord.capturedAt, "en-US")}`
            : ""}
          .
        </p>
      ) : paymentRecord?.status === "refunded" ? (
        <p className="text-sm text-[var(--color-stone-500)]">
          Refunded {formatMoney(paymentRecord.amount, "en-US")}.
        </p>
      ) : null}
    </div>
  );
}
