import { OrderRepository } from "@paon/database";
import { Card } from "@paon/ui/components/Card";
import { formatDate, formatMoney } from "@paon/utils";
import Link from "next/link";

import { OrderStatusBadge } from "./status-badge";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function OrdersPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const orders = await new OrderRepository(supabase).findByRetailer(
    session.retailerId,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Orders
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          {orders.length} order{orders.length === 1 ? "" : "s"}
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-stone-300)] px-6 py-16 text-center">
          <p className="text-[var(--color-stone-600)]">No orders yet.</p>
        </div>
      ) : (
        <Card className="divide-y divide-[var(--color-stone-100)] overflow-hidden rounded-[var(--radius-xl)] p-0 shadow-[var(--shadow-elevated)]">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="flex items-center justify-between px-6 py-4 hover:bg-[var(--color-stone-50)]"
            >
              <div>
                <p className="font-medium text-[var(--color-stone-900)]">
                  {order.orderNumber}
                </p>
                <p className="text-sm text-[var(--color-stone-500)]">
                  {formatDate(order.createdAt, "en-US")} · {order.channel}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p className="font-medium text-[var(--color-stone-900)]">
                  {formatMoney(order.total, "en-US")}
                </p>
                <OrderStatusBadge status={order.status} />
              </div>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
