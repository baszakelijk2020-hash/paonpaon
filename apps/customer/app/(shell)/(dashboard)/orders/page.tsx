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

import { RelatedLinks } from "../related-links";
import { buildCategorizedCatalogue } from "../wardrobe/complete-the-look-catalogue";

import { SeasonalStaffFavourites } from "./seasonal-staff-favourites";

import { getCustomersForUser } from "@/lib/customer-context";
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
    <div className="flex flex-wrap gap-2 text-sm">
      {orderActions(view).map((action) => (
        <Link
          key={action.label}
          href={action.href}
          className="inline-flex min-h-[44px] items-center rounded-full bg-white/[0.08] px-4 text-white/75 transition-colors hover:bg-white/[0.14] hover:text-white"
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
      className="pe-card flex flex-col gap-6 rounded-[32px] bg-[#191b1d] p-6 text-white sm:p-8"
      data-pe-card
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <Link
            href={`/orders/${order.id}`}
            className="font-display text-2xl font-semibold tracking-[-0.025em] text-white hover:underline"
          >
            {order.orderNumber}
          </Link>
          <p className="mt-2 text-sm text-white/55">
            {view.retailerName} · {formatDate(order.createdAt, "en-US")} ·{" "}
            {view.lineCount} item{view.lineCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-white">
            {formatMoney(order.total, "en-US")}
          </p>
          <p className="mt-2 inline-flex rounded-full bg-[#b8e6be] px-3 py-1.5 text-xs font-semibold text-[#181818]">
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
        className="customer-kicker mb-4 text-white/55"
      >
        Keep going
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {modules.map((module, index) => (
          <Link
            key={module.label}
            href={module.href}
            data-pe-card
            className={`flex min-h-28 items-end rounded-[32px] p-5 text-base font-semibold text-[#181818] transition-transform hover:-translate-y-0.5 ${
              ["bg-[#aed6e7]", "bg-[#b8e6be]", "bg-[#c7c1ef]", "bg-[#f0b6a4]"][
                index % 4
              ]
            }`}
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
      className="pe-card scroll-mt-24 rounded-[32px] bg-[#191b1d] p-6 text-white sm:p-8"
      data-pe-card
    >
      <p id="orders-ctl-heading" className="customer-kicker mb-4 text-white/55">
        Complete the Look
      </p>
      <div>
        <Link
          href={source.href}
          className="relative mx-auto flex h-[70px] w-[70px] items-center justify-center overflow-hidden rounded-[22px] bg-[var(--color-stone-900)]"
          aria-label={`From your order: ${source.name}`}
        >
          {source.imageUrl ? (
            <>
              {/* Restrained blurred backing layer only — never plain
                  empty letterboxing — while the full original image
                  stays primary via object-contain below (§5.3's
                  owned-card treatment, reused here). */}
              <Image
                src={source.imageUrl}
                alt=""
                fill
                unoptimized
                aria-hidden="true"
                className="scale-110 object-cover opacity-50 blur-md"
              />
              <Image
                src={source.imageUrl}
                alt={source.name}
                fill
                unoptimized
                className="object-contain"
              />
            </>
          ) : (
            <span className="px-1 text-center text-[10px] leading-tight text-[var(--color-stone-300)]">
              {source.name}
            </span>
          )}
        </Link>
        <p className="mt-3 text-center text-sm text-white/55">
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
                  <span className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-[14px] bg-[var(--color-stone-900)]">
                    {suggestion.primaryImageUrl ? (
                      <>
                        <Image
                          src={suggestion.primaryImageUrl}
                          alt=""
                          fill
                          unoptimized
                          aria-hidden="true"
                          className="scale-110 object-cover opacity-50 blur-md"
                        />
                        <Image
                          src={suggestion.primaryImageUrl}
                          alt={suggestion.displayName}
                          fill
                          unoptimized
                          className="object-contain"
                        />
                      </>
                    ) : (
                      <span className="px-2 text-center text-[10px] text-[var(--color-stone-300)]">
                        {suggestion.displayName}
                      </span>
                    )}
                  </span>
                  <span className="line-clamp-2 text-xs text-white/70">
                    {suggestion.displayName}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-center text-xs text-white/55">
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
        href: `/r/${retailerSlug}/products/${candidate.productSlug}?legacy=1`,
      }));

    completeTheLook = {
      source: {
        name: source.name,
        imageUrl: source.imageUrl,
        href: `/r/${retailerSlug}/products/${source.slug}?legacy=1`,
      },
      suggestions,
    };
  }

  return (
    <div className="customer-page flex flex-col gap-6 bg-black pb-12 text-white">
      <header className="pe-page-head items-end gap-6 pb-3">
        <div>
          <p className="customer-kicker mb-2 text-white/55">
            Purchases and progress
          </p>
          <h1 className="font-display text-5xl font-semibold leading-none tracking-[-0.055em] text-white sm:text-6xl">
            Orders
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-white/60">
            Follow what is being made, then revisit every piece and its
            services.
          </p>
        </div>
        <RelatedLinks
          links={[
            { href: "/preferred-tailoring", label: "Preferred Tailoring" },
            { href: "/services", label: "Services" },
          ]}
        />
      </header>

      {/* Two sections only when there is something in them. With no orders
          at all, "Pending: nothing" above "History: nothing" was two empty
          tiles saying the same thing; one card says it once. */}
      {views.length === 0 ? (
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
          {pending.length > 0 ? (
            <section aria-labelledby="orders-pending-heading">
              <p id="orders-pending-heading" className="customer-kicker mb-3">
                In progress
              </p>
              <div className="grid gap-4 lg:grid-cols-2">
                {pending.map((view) => (
                  <OrderCard key={view.order.id} view={view} />
                ))}
              </div>
            </section>
          ) : null}

          <section aria-labelledby="orders-history-heading">
            <p id="orders-history-heading" className="customer-kicker mb-3">
              Order history
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              {views.map((view) => (
                <OrderCard key={`history-${view.order.id}`} view={view} />
              ))}
            </div>
          </section>
        </>
      )}

      {completeTheLook ? (
        <CompleteTheLookModule
          source={completeTheLook.source}
          suggestions={completeTheLook.suggestions}
        />
      ) : null}

      {mostRecent?.retailerSlug ? (
        <div
          className="pe-card rounded-[32px] bg-[#191b1d] p-6 text-white sm:p-8"
          data-pe-card
        >
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
        </div>
      ) : null}

      {views.length > 0 ? <SupportingModules shopHref={shopHref} /> : null}
    </div>
  );
}
