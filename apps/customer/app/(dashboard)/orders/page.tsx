import { CustomerRepository, OrderRepository } from "@paon/database";
import { ORDER_STATUS_LABELS } from "@paon/domain";
import { Card } from "@paon/ui/components/Card";
import { formatDate, formatMoney } from "@paon/utils";
import Link from "next/link";

import { RelatedLinks } from "../related-links";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const TERMINAL_ORDER_STATUSES = new Set(["completed", "canceled", "refunded"]);

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
  const activeOrderCount = orders.filter(
    (order) => !TERMINAL_ORDER_STATUSES.has(order.status),
  ).length;
  const mostRecentOrder = orders[0];

  return (
    <div className="flex flex-col gap-8">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
          Order archive
        </p>
        <h1 className="font-display text-4xl text-[var(--color-stone-900)]">
          Orders
        </h1>
        <p className="max-w-xl text-sm leading-6 text-[var(--color-stone-600)]">
          A quiet record of your tailoring journey, from confirmation through
          collection.
        </p>
      </header>
      <RelatedLinks
        links={[
          { href: "/preferred-tailoring", label: "Preferred Tailoring" },
          { href: "/services", label: "Services" },
        ]}
      />

      {orders.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-stone-300)] px-6 py-16 text-center">
          <p className="text-[var(--color-stone-600)]">No orders yet.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-[var(--color-stone-200)] sm:grid-cols-3">
            <div className="bg-[var(--color-stone-50)] px-5 py-4">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-stone-500)]">
                Orders
              </p>
              <p className="mt-1 text-xl text-[var(--color-stone-900)]">
                {orders.length}
              </p>
            </div>
            <div className="bg-[var(--color-stone-50)] px-5 py-4">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-stone-500)]">
                In progress
              </p>
              <p className="mt-1 text-xl text-[var(--color-stone-900)]">
                {activeOrderCount}
              </p>
            </div>
            <div className="bg-[var(--color-stone-50)] px-5 py-4">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-stone-500)]">
                Most recent
              </p>
              <p className="mt-1 text-xl text-[var(--color-stone-900)]">
                {mostRecentOrder
                  ? formatDate(mostRecentOrder.createdAt, "en-US")
                  : "—"}
              </p>
            </div>
          </div>
          <Card className="divide-y divide-[var(--color-stone-100)] p-0">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="group flex flex-wrap items-center justify-between gap-5 px-5 py-6 transition-colors hover:bg-[var(--color-stone-50)] focus-visible:bg-[var(--color-stone-50)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-stone-500)] sm:px-7"
              >
                <div className="min-w-0 space-y-2">
                  <p className="font-medium text-[var(--color-stone-900)]">
                    {order.orderNumber}
                  </p>
                  <p className="text-sm text-[var(--color-stone-500)]">
                    {formatDate(order.createdAt, "en-US")}
                  </p>
                </div>
                <div className="flex items-center gap-5">
                  <div className="text-right">
                    <p className="font-medium text-[var(--color-stone-900)]">
                      {formatMoney(order.total, "en-US")}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-stone-500)]">
                      {ORDER_STATUS_LABELS[order.status]}
                    </p>
                  </div>
                  <span className="text-sm text-[var(--color-stone-700)] underline decoration-[var(--color-stone-300)] underline-offset-4 group-hover:decoration-[var(--color-stone-700)]">
                    View order
                  </span>
                </div>
              </Link>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
