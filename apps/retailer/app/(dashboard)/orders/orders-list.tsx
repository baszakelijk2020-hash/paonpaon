"use client";

import type { Order } from "@paon/domain";
import { Card } from "@paon/ui/components/Card";
import { SearchableCollection } from "@paon/ui/components/SearchableCollection";
import { formatDate, formatMoney } from "@paon/utils";
import Link from "next/link";

import { OrderStatusBadge } from "./status-badge";

export function OrdersList({ orders }: { orders: Order[] }) {
  return (
    <SearchableCollection
      items={orders}
      placeholder="Search order number, channel or status…"
      label="Search orders"
      predicate={(order, query) =>
        order.orderNumber.toLowerCase().includes(query) ||
        order.channel.toLowerCase().includes(query) ||
        order.status.replaceAll("_", " ").toLowerCase().includes(query)
      }
      empty={
        <p className="text-sm text-[var(--color-stone-500)]">
          No orders match that search.
        </p>
      }
    >
      {(filtered) => (
        <Card className="paon-reveal divide-y divide-[var(--color-stone-100)] overflow-hidden rounded-[var(--radius-md)] p-0 shadow-[var(--shadow-elevated)]">
          {filtered.map((order) => (
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
                  {formatDate(order.createdAt, "en-US")} · {order.channel}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <p className="font-medium text-[var(--color-stone-900)]">
                  {formatMoney(order.total, "en-US")}
                </p>
                <OrderStatusBadge status={order.status} />
              </div>
            </Link>
          ))}
        </Card>
      )}
    </SearchableCollection>
  );
}
