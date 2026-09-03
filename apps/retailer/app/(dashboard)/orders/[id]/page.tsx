import {
  CustomerRepository,
  HoneymoonProgrammeRepository,
  OrderRepository,
  ProductVariantRepository,
} from "@paon/database";
import { asId, retailerRoleAtLeast } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Card } from "@paon/ui/components/Card";
import { HoneymoonProgrammeCard } from "@paon/ui/components/HoneymoonProgrammeCard";
import { formatDate, formatMoney } from "@paon/utils";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderStatusBadge } from "../status-badge";

import { MarkPaidInStoreForm, RequestReturnForm } from "./order-actions";
import { StatusForm } from "./status-form";

import { requireSession } from "@/lib/session";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const supabase = await getSupabaseServerClient();

  const orderRepo = new OrderRepository(supabase);
  const order = await orderRepo.findById(asId<"OrderId">(id));
  if (!order) {
    notFound();
  }

  const [lines, customer] = await Promise.all([
    orderRepo.findLinesByOrder(order.id),
    new CustomerRepository(supabase).findById(order.customerId),
  ]);

  const variantRepo = new ProductVariantRepository(supabase);
  const variants = await Promise.all(
    lines.map((line) => variantRepo.findById(line.productVariantId)),
  );

  const admin = getSupabaseAdminClient();
  const honeymoonProgramme = await new HoneymoonProgrammeRepository(
    admin,
  ).ensureForOrder({
    retailerId: order.retailerId,
    customerId: order.customerId,
    orderId: order.id,
    orderStatus: order.status,
    contactPressureActive: false,
    lines: lines
      .map((line, index) => {
        const variant = variants[index];
        if (!variant) return null;
        return {
          productLabel: variant.sku,
          quantity: line.quantity,
          inStock: variant.inventoryQuantity > 0,
          leadTimeDays: variant.leadTimeDays ?? 0,
        };
      })
      .filter((line) => line !== null),
  });

  const canManageOrders = retailerRoleAtLeast(
    session.retailerRole,
    "production_staff",
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
            {order.orderNumber}
          </h1>
          <OrderStatusBadge status={order.status} />
          {honeymoonProgramme.payAtDelivery ? (
            <Badge tone="warning">Pay at delivery</Badge>
          ) : null}
        </div>
        <p className="text-sm text-[var(--color-stone-500)]">
          {customer?.fullName ?? "Unknown customer"} ·{" "}
          {formatDate(order.createdAt, "en-US")} · {order.channel} ·{" "}
          <Link href={`/orders/${order.id}/print`} className="underline">
            Print
          </Link>
        </p>
      </div>

      <Card className="divide-y divide-[var(--color-stone-100)] overflow-hidden rounded-[var(--radius-md)] p-0 shadow-[var(--shadow-elevated)]">
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
                  {line.requiresProduction ? " · Made to order" : ""}
                  {line.requiresAlteration ? " · Alterable" : ""}
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

      {canManageOrders ? (
        <StatusForm orderId={order.id} currentStatus={order.status} />
      ) : null}

      {canManageOrders ? (
        <div className="flex flex-wrap items-start gap-3">
          {order.status === "pending_payment" ? (
            <MarkPaidInStoreForm orderId={order.id} />
          ) : null}
          {order.status !== "refunded" ? (
            <RequestReturnForm orderId={order.id} />
          ) : null}
        </div>
      ) : null}

      <HoneymoonProgrammeCard
        orderId={honeymoonProgramme.orderId}
        payAtDelivery={honeymoonProgramme.payAtDelivery}
        actions={honeymoonProgramme.actions}
      />
    </div>
  );
}
