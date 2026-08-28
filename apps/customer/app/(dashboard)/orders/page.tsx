import {
  CustomerRepository,
  OrderRepository,
  ProductRepository,
  ProductVariantRepository,
  RetailerRepository,
} from "@paon/database";
import { ORDER_STATUS_LABELS, type Order } from "@paon/domain";
import { formatDate, formatMoney } from "@paon/utils";
import Image from "next/image";
import Link from "next/link";

import { RelatedLinks } from "../related-links";
import { buildCategorizedCatalogue } from "../wardrobe/complete-the-look-catalogue";

import { SeasonalStaffFavourites } from "./seasonal-staff-favourites";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const TERMINAL_ORDER_STATUSES = new Set([
  "completed",
  "canceled",
  "refunded",
  "delivered",
]);

const COMPLETE_THE_LOOK_LIMIT = 8;

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

function reorderHref(view: OrderView): string {
  if (view.retailerSlug && view.firstProduct) {
    return `/r/${view.retailerSlug}/products/${view.firstProduct.slug}`;
  }
  if (view.retailerSlug) return `/r/${view.retailerSlug}`;
  return `/orders/${view.order.id}`;
}

/** §7's per-order action set. Each target is a shipped customer route and,
 * where the route accepts it, carries this order's own context so the
 * action continues *this* order rather than a generic flow. */
function orderActions(view: OrderView) {
  const completeTheLookHref = view.firstProduct
    ? `/digital-fitting-room?productSlug=${encodeURIComponent(view.firstProduct.slug)}`
    : "/orders#complete-the-look";
  const askHref = `/messages?prefill=${encodeURIComponent(
    `A question about order ${view.order.orderNumber}: `,
  )}`;
  return [
    { label: "Order again", href: reorderHref(view) },
    { label: "Complete the look", href: completeTheLookHref },
    { label: "Ask a question", href: askHref },
    { label: "Request service", href: "/services" },
    { label: "View order / invoice", href: `/orders/${view.order.id}` },
  ];
}

function OrderActionRow({ view }: { view: OrderView }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-stone-500)]">
      {orderActions(view).map((action) => (
        <Link
          key={action.label}
          href={action.href}
          className="underline underline-offset-2 hover:text-[var(--color-stone-900)]"
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
    <article className="flex flex-col gap-3 px-5 py-6 sm:px-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <Link
            href={`/orders/${order.id}`}
            className="font-display text-xl text-[var(--color-stone-900)] hover:underline"
          >
            {order.orderNumber}
          </Link>
          <p className="text-sm text-[var(--color-stone-500)]">
            {view.retailerName} · {formatDate(order.createdAt, "en-US")} ·{" "}
            {view.lineCount} item{view.lineCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="text-right">
          <p className="font-medium text-[var(--color-stone-900)]">
            {formatMoney(order.total, "en-US")}
          </p>
          <p className="mt-1 text-xs text-[var(--color-stone-500)]">
            {ORDER_STATUS_LABELS[order.status]}
          </p>
        </div>
      </div>
      <OrderActionRow view={view} />
    </article>
  );
}

function SupportingModules({ shopHref }: { shopHref: string }) {
  const modules = [
    { label: "Advisor selections", href: "/wardrobe" },
    { label: "Saved items", href: "/wishlist" },
    { label: "Complete the Look", href: "/orders#complete-the-look" },
    { label: "Shop", href: shopHref },
    { label: "Book in-store appointment", href: "/appointments" },
    { label: "TableService", href: "/messages" },
  ];
  return (
    <section aria-labelledby="orders-support-heading">
      <p
        id="orders-support-heading"
        className="customer-kicker mb-3 text-[var(--color-stone-500)]"
      >
        Keep going
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {modules.map((module) => (
          <Link
            key={module.label}
            href={module.href}
            className="rounded-[var(--customer-radius)] bg-gradient-to-br from-[rgba(203,211,197,0.45)] to-[rgba(203,211,197,0.18)] px-5 py-4 text-sm text-[var(--color-stone-700)] shadow-sm transition-colors hover:text-[var(--color-stone-900)]"
          >
            {module.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

function CompleteTheLookModule({
  source,
  suggestions,
}: {
  source: {
    readonly name: string;
    readonly imageUrl: string | undefined;
    readonly href: string;
  };
  suggestions: readonly {
    readonly productId: string;
    readonly productSlug: string;
    readonly displayName: string;
    readonly primaryImageUrl?: string;
    readonly href: string;
  }[];
}) {
  return (
    <section
      id="complete-the-look"
      aria-labelledby="orders-ctl-heading"
      className="scroll-mt-24"
    >
      <p
        id="orders-ctl-heading"
        className="customer-kicker mb-3 text-[var(--color-stone-500)]"
      >
        Complete the Look
      </p>
      <div className="border-y border-[var(--customer-border)] py-6">
        <Link
          href={source.href}
          className="mx-auto flex h-[70px] w-[70px] items-center justify-center overflow-hidden rounded-[22px] bg-[var(--color-stone-100)]"
          aria-label={`From your order: ${source.name}`}
        >
          {source.imageUrl ? (
            <Image
              src={source.imageUrl}
              alt={source.name}
              width={70}
              height={70}
              unoptimized
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="px-1 text-center text-[10px] leading-tight text-[var(--color-stone-500)]">
              {source.name}
            </span>
          )}
        </Link>
        <p className="mt-2 text-center text-xs text-[var(--color-stone-500)]">
          Pairs for {source.name}
        </p>
        {suggestions.length > 0 ? (
          <ul className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1">
            {suggestions.map((suggestion) => (
              <li key={suggestion.productId} className="shrink-0 snap-start">
                <Link
                  href={suggestion.href}
                  className="flex w-32 flex-col gap-2"
                >
                  <span className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-[14px] bg-[var(--color-stone-100)]">
                    {suggestion.primaryImageUrl ? (
                      <Image
                        src={suggestion.primaryImageUrl}
                        alt={suggestion.displayName}
                        width={128}
                        height={128}
                        unoptimized
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="px-2 text-center text-[10px] text-[var(--color-stone-500)]">
                        {suggestion.displayName}
                      </span>
                    )}
                  </span>
                  <span className="line-clamp-2 text-xs text-[var(--color-stone-700)]">
                    {suggestion.displayName}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-center text-xs text-[var(--color-stone-500)]">
            No catalogue pairings available from this retailer yet.
          </p>
        )}
      </div>
    </section>
  );
}

export default async function OrdersPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
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
        if (product) {
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

  const pending = views.filter(
    (view) => !TERMINAL_ORDER_STATUSES.has(view.order.status),
  );
  const mostRecent = views[0];
  const shopHref = mostRecent?.retailerSlug
    ? `/r/${mostRecent.retailerSlug}`
    : "/wardrobe";

  let completeTheLook: {
    source: {
      readonly name: string;
      readonly imageUrl: string | undefined;
      readonly href: string;
    };
    suggestions: readonly {
      readonly productId: string;
      readonly productSlug: string;
      readonly displayName: string;
      readonly primaryImageUrl?: string;
      readonly href: string;
    }[];
  } | null = null;

  if (mostRecent?.firstProduct && mostRecent.retailerSlug) {
    const source = mostRecent.firstProduct;
    const retailerSlug = mostRecent.retailerSlug;

    const catalogue = await buildCategorizedCatalogue({
      supabase,
      retailerId: mostRecent.order.retailerId,
    });
    // §7: never duplicate the source product inside its own pairing carousel.
    const suggestions = catalogue
      .filter((candidate) => candidate.productId !== source.id)
      .slice(0, COMPLETE_THE_LOOK_LIMIT)
      .map((candidate) => ({
        productId: candidate.productId,
        productSlug: candidate.productSlug,
        displayName: candidate.displayName,
        ...(candidate.primaryImageUrl
          ? { primaryImageUrl: candidate.primaryImageUrl }
          : {}),
        href: `/r/${retailerSlug}/products/${candidate.productSlug}`,
      }));

    completeTheLook = {
      source: {
        name: source.name,
        imageUrl: source.imageUrl,
        href: `/r/${retailerSlug}/products/${source.slug}`,
      },
      suggestions,
    };
  }

  return (
    <div className="customer-page flex flex-col gap-8">
      <header className="customer-page-header space-y-2">
        <p className="customer-kicker text-xs font-medium uppercase tracking-[0.18em]">
          Purchases
        </p>
        <h1 className="font-display text-4xl text-[var(--color-stone-900)]">
          Orders
        </h1>
        <p className="max-w-xl text-sm leading-6 text-[var(--color-stone-600)]">
          Pending orders first, then your full purchase history — every order
          you have placed, with the actions to carry each one forward.
        </p>
      </header>
      <RelatedLinks
        links={[
          { href: "/preferred-tailoring", label: "Preferred Tailoring" },
          { href: "/services", label: "Services" },
        ]}
      />

      <section aria-labelledby="orders-pending-heading">
        <p
          id="orders-pending-heading"
          className="customer-kicker mb-3 text-[var(--color-stone-500)]"
        >
          Pending orders
        </p>
        {pending.length > 0 ? (
          <div className="divide-y divide-[var(--color-stone-100)] border-y border-[var(--customer-border)]">
            {pending.map((view) => (
              <OrderCard key={view.order.id} view={view} />
            ))}
          </div>
        ) : (
          <div className="border-y border-[var(--customer-border)] px-5 py-8 text-sm text-[var(--color-stone-500)]">
            Nothing in progress right now.
          </div>
        )}
      </section>

      <section aria-labelledby="orders-history-heading">
        <p
          id="orders-history-heading"
          className="customer-kicker mb-3 text-[var(--color-stone-500)]"
        >
          Order history
        </p>
        {views.length > 0 ? (
          <div className="divide-y divide-[var(--color-stone-100)] border-y border-[var(--customer-border)]">
            {views.map((view) => (
              <OrderCard key={`history-${view.order.id}`} view={view} />
            ))}
          </div>
        ) : (
          <div className="customer-panel px-6 py-16 text-center">
            <p className="text-[var(--color-stone-600)]">No orders yet.</p>
          </div>
        )}
      </section>

      {completeTheLook ? (
        <CompleteTheLookModule
          source={completeTheLook.source}
          suggestions={completeTheLook.suggestions}
        />
      ) : null}

      {mostRecent?.retailerSlug ? (
        <SeasonalStaffFavourites
          retailerId={mostRecent.order.retailerId}
          retailerSlug={mostRecent.retailerSlug}
          excludeProductIds={
            new Set(
              completeTheLook
                ? [
                    ...(mostRecent.firstProduct
                      ? [mostRecent.firstProduct.id]
                      : []),
                    ...completeTheLook.suggestions.map(
                      (suggestion) => suggestion.productId,
                    ),
                  ]
                : [],
            )
          }
        />
      ) : null}

      {views.length > 0 ? <SupportingModules shopHref={shopHref} /> : null}
    </div>
  );
}
