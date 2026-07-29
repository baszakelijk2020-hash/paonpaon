import { OrderRepository } from "@paon/database";

import { OrdersList } from "./orders-list";

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
        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-stone-300)] px-6 py-16 text-center">
          <p className="text-[var(--color-stone-600)]">No orders yet.</p>
        </div>
      ) : (
        <OrdersList orders={orders} />
      )}
    </div>
  );
}
