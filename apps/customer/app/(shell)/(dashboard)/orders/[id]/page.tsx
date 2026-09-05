import {
  HoneymoonProgrammeRepository,
  OrderRepository,
  PaymentRepository,
  ProductRepository,
  ProductVariantRepository,
  RetailerRepository,
} from "@paon/database";
import { asId, ORDER_STATUS_LABELS } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Card } from "@paon/ui/components/Card";
import { formatDate, formatMoney } from "@paon/utils";
import Link from "next/link";
import { notFound } from "next/navigation";

import { HoneymoonProgrammeCard } from "./honeymoon-programme-card";
import { PayPanel } from "./pay-panel";

import { env } from "@/lib/env";
import { requireSession } from "@/lib/session";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
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
  if (!order.customerId) {
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

  const firstVariant = variants.find((variant) => variant !== null) ?? null;
  const firstProduct = firstVariant
    ? await new ProductRepository(supabase).findById(firstVariant.productId)
    : null;

  // §7 per-order real actions. Each target is a shipped customer route —
  // nothing here fabricates a flow. "View order / invoice" is the itemised
  // block below, so it is not repeated as a link on the order's own page.
  const reorderHref =
    retailer?.slug && firstProduct
      ? `/r/${retailer.slug}/products/${firstProduct.slug}`
      : retailer?.slug
        ? `/r/${retailer.slug}`
        : `/orders/${order.id}`;
  const orderActions = [
    { label: "Order again", href: reorderHref },
    { label: "Complete the look", href: "/orders#complete-the-look" },
    { label: "Ask a question", href: "/messages" },
    { label: "Request service", href: "/services" },
  ];

  // Order-to-delivery tracker (PHASE 10.2 / CMP-106). Recomputed on every
  // view from the order's current status and each variant's real
  // inventory/lead-time — never a cached snapshot that could drift from
  // stock truth. Uses the admin client because honeymoon_programmes /
  // honeymoon_programme_actions are service-role-write-only (matching
  // integration_connections before its own retailer-write grant was added
  // for PHASE 9.2 — these tables have no such grant, since a customer must
  // never set their own action's suppression state). contactPressureActive
  // is false here deliberately: that field suppresses unsolicited STAFF
  // outreach, not a customer's own view of their own order.
  const admin = getSupabaseAdminClient();
  const honeymoonProgramme = await new HoneymoonProgrammeRepository(
    admin,
  ).ensureForOrder({
    retailerId: order.retailerId,
    customerId: order.customerId,
    orderId: order.id,
    orderStatus: order.status,
    contactPressureActive: false,
    lines: variants
      .filter((variant) => variant !== null)
      .map((variant) => ({
        productLabel: variant.sku,
        quantity: 1,
        inStock: variant.inventoryQuantity > 0,
        leadTimeDays: variant.leadTimeDays ?? 0,
      })),
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
            {order.orderNumber}
          </h1>
          <Badge tone="warning">{ORDER_STATUS_LABELS[order.status]}</Badge>
        </div>
        <p className="text-sm text-[var(--color-stone-500)]">
          {retailer?.displayName ?? "Unknown retailer"} ·{" "}
          {formatDate(order.createdAt, "en-US")}
        </p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-stone-500)]">
          {orderActions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="underline underline-offset-2 hover:text-[var(--color-stone-900)]"
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>

      <Card className="paon-reveal divide-y divide-[var(--color-stone-100)] p-0">
        <div className="flex items-center justify-between px-6 py-3">
          <p className="customer-kicker text-[var(--color-stone-500)]">
            Invoice
          </p>
          <p className="text-xs text-[var(--color-stone-500)]">
            {order.orderNumber}
          </p>
        </div>
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

      <Card
        className="paon-reveal flex flex-col gap-2"
        style={{ animationDelay: "120ms" }}
      >
        <div className="flex items-center justify-between text-sm text-[var(--color-stone-600)]">
          <p>Subtotal</p>
          <p>{formatMoney(order.subtotal, "en-US")}</p>
        </div>
        <div className="flex items-center justify-between">
          <p className="font-medium text-[var(--color-stone-900)]">Total</p>
          <p className="font-medium text-[var(--color-stone-900)]">
            {formatMoney(order.total, "en-US")}
          </p>
        </div>
      </Card>

      {lines.some(
        (line) => line.requiresProduction || line.requiresAlteration,
      ) ? (
        <Card
          className="paon-reveal bg-[var(--color-stone-50)]"
          style={{ animationDelay: "150ms" }}
        >
          <p className="text-sm font-medium text-[var(--color-stone-900)]">
            Three separate timelines
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--color-stone-600)]">
            This order&rsquo;s status above tracks payment and fulfilment.
            {lines.some((line) => line.requiresProduction)
              ? " Made-to-measure lines are cut and assembled on their own production schedule, "
              : " "}
            {lines.some((line) => line.requiresAlteration)
              ? "and any tailoring is tracked as a separate alteration work order once the garment arrives."
              : "."}{" "}
            Your Style Advisor can tell you where a specific line stands in
            either.
          </p>
        </Card>
      ) : null}

      {order.status === "pending_payment" ? (
        payment === "success" ? (
          <p className="text-sm text-[var(--color-stone-500)]">
            Confirming your payment — this can take a few seconds. Refresh if
            the status above doesn&rsquo;t update.
          </p>
        ) : (
          <PayPanel
            orderId={order.id}
            orderNumber={order.orderNumber}
            paymentCanceled={payment === "canceled"}
            payAtDelivery={honeymoonProgramme.payAtDelivery}
            canOfferPayAtDelivery={!honeymoonProgramme.payAtDelivery}
            demoPaymentsEnabled={env.demoPaymentsEnabled}
            stripeConfigured={Boolean(env.stripeSecretKey)}
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

      <HoneymoonProgrammeCard programme={honeymoonProgramme} />
    </div>
  );
}
