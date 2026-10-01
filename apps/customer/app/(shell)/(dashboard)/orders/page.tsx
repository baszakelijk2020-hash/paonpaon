import {
  OrderRepository,
  ProductRepository,
  ProductVariantRepository,
  RetailerRepository,
} from "@paon/database";
import { ORDER_STATUS_LABELS, type Order } from "@paon/domain";
import { formatDate, formatMoney } from "@paon/utils";
import Image from "next/image";
import Link from "next/link";

import { getCustomersForUser } from "@/lib/customer-context";
import { getViewerSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const TERMINAL_ORDER_STATUSES = new Set([
  "completed",
  "canceled",
  "refunded",
  "delivered",
]);

interface OrderView {
  readonly order: Order;
  readonly retailerSlug: string | undefined;
  readonly retailerName: string;
  readonly firstProduct:
    | {
        readonly id: string;
        readonly slug: string;
        readonly name: string;
        readonly imageUrl: string | undefined;
      }
    | undefined;
  readonly lineCount: number;
}

/** The real product-detail route (`/r/[slug]/products/[productSlug]`)
 * redirects to the storefront root unless `?legacy=1` is present — it
 * exists only as the canonical signed-in action target, not the default
 * shopping surface (see that route's own file comment). `firstProduct`
 * is only populated here when its linked product resolved and is
 * `status === "active"` (see the OrdersPage loader below), so reaching
 * this branch already guarantees a real, live landing rather than a
 * silent bounce back to the generic storefront home. */
function reorderHref(view: OrderView): string {
  if (view.retailerSlug && view.firstProduct) {
    return `/r/${view.retailerSlug}/products/${view.firstProduct.slug}?legacy=1`;
  }
  if (view.retailerSlug) return `/r/${view.retailerSlug}`;
  return `/orders/${view.order.id}`;
}

/** §7's per-order action set. Each target is a shipped customer route and,
 * where the route accepts it, carries this order's own context so the
 * action continues *this* order rather than a generic flow. */
function orderActions(view: OrderView) {
  return [
    { label: "Order again", href: reorderHref(view) },
    { label: "Request care", href: "/appointments" },
    { label: "View order", href: `/orders/${view.order.id}` },
  ];
}

function OrderActionRow({ view }: { view: OrderView }) {
  return (
    <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4 text-sm sm:col-span-3">
      {orderActions(view).map((action) => (
        <Link
          key={action.label}
          href={action.href}
          className="inline-flex min-h-10 items-center rounded-full border border-white/15 px-4 text-white/75 transition-colors hover:bg-white/[0.1] hover:text-white"
        >
          {action.label}
        </Link>
      ))}
    </div>
  );
}

function OrderCard({ view }: { view: OrderView }) {
  const { order } = view;
  return (
    <article
      className="pe-card grid gap-5 rounded-[28px] bg-[#191b1d] p-5 text-white sm:grid-cols-[72px_minmax(0,1fr)_auto] sm:items-center sm:p-6"
      data-pe-card
    >
      <div className="relative hidden h-[72px] w-[72px] overflow-hidden rounded-[18px] bg-white/[0.06] sm:block">
        {view.firstProduct?.imageUrl ? (
          <Image
            src={view.firstProduct.imageUrl}
            alt=""
            fill
            unoptimized
            className="object-cover object-top"
          />
        ) : null}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3 sm:block">
          <div>
            <Link
              href={`/orders/${order.id}`}
              className="font-display text-xl font-semibold tracking-[-0.025em] text-white hover:underline"
            >
              {order.orderNumber}
            </Link>
            <p className="mt-1 text-sm text-white/55">
              {view.retailerName} · {formatDate(order.createdAt, "en-US")} ·{" "}
              {view.lineCount} item{view.lineCount === 1 ? "" : "s"}
            </p>
          </div>
          <p className="inline-flex rounded-full bg-[#b8e6be] px-3 py-1.5 text-xs font-semibold text-[#181818] sm:hidden">
            {ORDER_STATUS_LABELS[order.status]}
          </p>
        </div>
      </div>
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <p className="text-lg font-semibold text-white">
          {formatMoney(order.total, "en-US")}
        </p>
        <p className="inline-flex rounded-full bg-[#b8e6be] px-3 py-1.5 text-xs font-semibold text-[#181818]">
          {ORDER_STATUS_LABELS[order.status]}
        </p>
      </div>
      <OrderActionRow view={view} />
    </article>
  );
}

export default async function OrdersPage() {
  const session = await getViewerSession();
  const supabase = await getSupabaseServerClient();

  const customers = await getCustomersForUser(session.userId);
  const orderRepo = new OrderRepository(supabase);
  const retailerRepo = new RetailerRepository(supabase);
  const variantRepo = new ProductVariantRepository(supabase);
  const productRepo = new ProductRepository(supabase);

  const ordersByCustomer = await Promise.all(
    customers.map((customer) => orderRepo.findByCustomer(customer.id)),
  );
  const orders = ordersByCustomer
    .flat()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const retailerIds = [...new Set(orders.map((order) => order.retailerId))];
  const retailers = await Promise.all(
    retailerIds.map((retailerId) => retailerRepo.findById(retailerId)),
  );
  const retailerById = new Map(
    retailers
      .filter((retailer): retailer is NonNullable<typeof retailer> =>
        Boolean(retailer),
      )
      .map((retailer) => [retailer.id, retailer]),
  );

  const views: OrderView[] = await Promise.all(
    orders.map(async (order): Promise<OrderView> => {
      const lines = await orderRepo.findLinesByOrder(order.id);
      const firstLine = lines[0];
      let firstProduct: OrderView["firstProduct"];
      if (firstLine) {
        const variant = await variantRepo.findById(firstLine.productVariantId);
        const product = variant
          ? await productRepo.findById(variant.productId)
          : null;
        if (product && product.status === "active") {
          firstProduct = {
            id: product.id,
            slug: product.slug,
            name: product.name,
            imageUrl: product.primaryImageUrl,
          };
        }
      }
      const retailer = retailerById.get(order.retailerId);
      return {
        order,
        retailerSlug: retailer?.slug,
        retailerName: retailer?.displayName ?? "Your retailer",
        firstProduct,
        lineCount: lines.length,
      };
    }),
  );

  const history = views.filter((view) =>
    TERMINAL_ORDER_STATUSES.has(view.order.status),
  );
  const mostRecent = views[0];
  const shopHref = mostRecent?.retailerSlug
    ? `/r/${mostRecent.retailerSlug}`
    : "/wardrobe";

  return (
    <div className="customer-page flex flex-col gap-6 bg-black pb-12 text-white">
      <header className="pe-page-head pb-3">
        <div>
          <h1 className="font-display text-5xl font-semibold leading-none tracking-[-0.055em] text-white sm:text-6xl">
            Past orders
          </h1>
        </div>
      </header>

      {/* Two sections only when there is something in them. With no orders
          at all, "Pending: nothing" above "History: nothing" was two empty
          tiles saying the same thing; one card says it once. */}
      {history.length === 0 ? (
        <section className="pe-card" data-pe-card>
          <p className="customer-kicker">Orders</p>
          <h2 className="mt-2">Your first piece starts here.</h2>
          <p className="mt-1 max-w-md">
            Purchases and their progress will appear here.
          </p>
          <Link href={shopHref} className="customer-button mt-5 inline-flex">
            Explore the collection
          </Link>
        </section>
      ) : (
        <>
          <section aria-labelledby="orders-history-heading">
            <div className="grid gap-4 lg:grid-cols-2">
              {history.map((view) => (
                <OrderCard key={`history-${view.order.id}`} view={view} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
