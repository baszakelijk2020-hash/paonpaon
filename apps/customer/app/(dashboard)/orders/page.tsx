import { CustomerRepository, OrderRepository } from "@paon/database";
import { ORDER_STATUS_LABELS } from "@paon/domain";
import { Card } from "@paon/ui/components/Card";
import { formatDate, formatMoney } from "@paon/utils";
import Link from "next/link";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function OrdersPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const orderRepo = new OrderRepository(supabase);
  const ordersByCustomer = await Promise.all(
    customers.map((customer) => orderRepo.findByCustomer(customer.id)),
  );
  const orders = ordersByCustomer
    .flat()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
        Orders
      </h1>

      {orders.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-stone-300)] px-6 py-16 text-center">
          <p className="text-[var(--color-stone-600)]">No orders yet.</p>
        </div>
      ) : (
        <Card className="divide-y divide-[var(--color-stone-100)] p-0">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 hover:bg-[var(--color-stone-50)]"
            >
              <div className="min-w-0">
                <p className="font-medium text-[var(--color-stone-900)]">
                  {order.orderNumber}
                </p>
                <p className="text-sm text-[var(--color-stone-500)]">
                  {ORDER_STATUS_LABELS[order.status]} ·{" "}
                  {formatDate(order.createdAt, "en-US")}
                </p>
              </div>
              <p className="shrink-0 font-medium text-[var(--color-stone-900)]">
                {formatMoney(order.total, "en-US")}
              </p>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
