import {
  CustomerRepository,
  OrderRepository,
  ProductVariantRepository,
} from "@paon/database";
import { asId, ORDER_STATUS_LABELS } from "@paon/domain";
import { formatDate, formatMoney } from "@paon/utils";
import { notFound } from "next/navigation";

import { PrintButton } from "../../../alterations/[id]/print/print-button";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * A printable order pack — the paper handoff a fulfilment or fitting
 * team can carry with a garment, same shape as the alteration work-order
 * print pack (deliberately outside `(dashboard)`, no sidebar chrome).
 */
export default async function OrderPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const supabase = await getSupabaseServerClient();

  const orderRepo = new OrderRepository(supabase);
  const order = await orderRepo.findById(asId<"OrderId">(id));
  if (!order || order.retailerId !== session.retailerId) {
    notFound();
  }
  if (!order.customerId) {
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

  return (
    <div className="min-h-screen bg-white text-[#1a1a1a] print:min-h-0">
      <div className="mx-auto max-w-2xl px-8 py-10 print:max-w-none print:px-0 print:py-0">
        <div className="mb-6 flex justify-end print:hidden">
          <PrintButton />
        </div>

        <header className="flex items-start justify-between border-b-2 border-[#1a1a1a] pb-4">
          <div>
            <p className="font-accent text-xs uppercase tracking-[0.24em] text-[#1a1a1a]/60">
              PAON · Order pack
            </p>
            <h1 className="font-display mt-1 text-3xl leading-none">
              {order.orderNumber}
            </h1>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.18em] text-[#1a1a1a]/60">
              Status
            </p>
            <p className="text-lg font-medium">
              {ORDER_STATUS_LABELS[order.status]}
            </p>
            <p className="mt-1 text-sm text-[#1a1a1a]/70">
              {formatDate(order.createdAt, "en-US")} · {order.channel}
            </p>
          </div>
        </header>

        <section className="mt-6">
          <p className="text-xs uppercase tracking-[0.18em] text-[#1a1a1a]/50">
            Customer
          </p>
          <p className="mt-1 text-base font-medium">
            {customer?.fullName ?? "Unknown customer"}
          </p>
          {customer?.phone ? (
            <p className="text-sm text-[#1a1a1a]/70">{customer.phone}</p>
          ) : null}
          {customer?.email ? (
            <p className="text-sm text-[#1a1a1a]/70">{customer.email}</p>
          ) : null}
        </section>

        <section className="mt-6 border-t border-[#1a1a1a]/15 pt-4">
          <h2 className="text-sm font-medium uppercase tracking-[0.1em]">
            Lines
          </h2>
          <div className="mt-2 flex flex-col gap-3">
            {lines.map((line, index) => {
              const variant = variants[index];
              return (
                <div
                  key={line.id}
                  className="break-inside-avoid rounded border border-[#1a1a1a]/15 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{variant?.sku ?? "Item"}</p>
                    <p className="text-sm">
                      {formatMoney(line.unitPrice, "en-US")}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-[#1a1a1a]/60">
                    Qty {line.quantity}
                    {line.requiresProduction ? " · Made to order" : ""}
                    {line.requiresAlteration ? " · Alterable" : ""}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-6 flex items-center justify-between border-t border-[#1a1a1a]/15 pt-4">
          <p className="text-sm font-medium uppercase tracking-[0.1em]">
            Total
          </p>
          <p className="text-lg font-medium">
            {formatMoney(order.total, "en-US")}
          </p>
        </section>

        <footer className="mt-10 flex items-center justify-between border-t border-[#1a1a1a]/15 pt-4 text-xs text-[#1a1a1a]/50">
          <span>Printed {formatDate(new Date().toISOString(), "en-US")}</span>
          <span className="font-mono tracking-[0.2em]">
            {order.orderNumber}
          </span>
        </footer>
      </div>
    </div>
  );
}
