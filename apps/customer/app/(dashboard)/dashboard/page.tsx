import {
  AppointmentRepository,
  CustomerAlterationRepository,
  CustomerRepository,
  NotificationRepository,
  OrderRepository,
  ProductVariantRepository,
  RetailerBranchRepository,
  RetailerRepository,
} from "@paon/database";
import {
  ALTERATION_STATUS_LABELS,
  APPOINTMENT_TYPE_LABELS,
  asId,
  ORDER_STATUS_LABELS,
} from "@paon/domain";
import { buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { formatDate, formatMoney } from "@paon/utils";
import Link from "next/link";

import { ensureTodaysMorningRoutineSelection } from "../morning-routine/generation";
import { LocalWidgets } from "../morning-routine/local-widgets";
import { buildVariantIdByProductSlug } from "../wishlist/favorites-map";
import {
  MergeFavorites,
  type FavoritesHouse,
} from "../wishlist/merge-favorites";

import { HouseSwitcher } from "./house-switcher";
import {
  MorningRoutineDashboardHero,
  type HeroPiece,
} from "./morning-routine-hero";
import { TodaysPick } from "./todays-pick";

import { getAIProvider } from "@/lib/ai";
import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

const TERMINAL_ORDER_STATUSES = new Set(["completed", "canceled", "refunded"]);
const TERMINAL_ALTERATION_STATUSES = new Set(["completed", "canceled"]);

export default async function DashboardPage() {
  const session = await getSession();
  // Guests hit /dashboard from the storefront profile icon; the layout
  // renders GuestPortalPreview and does not mount {children}. The page
  // still runs — bail without requireSession so middleware public access
  // is not undone by a redirect.
  if (!session || session.accountType !== "customer") {
    return null;
  }
  const supabase = await getSupabaseServerClient();

  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const retailerRepo = new RetailerRepository(supabase);
  const appointmentRepo = new AppointmentRepository(supabase);
  const orderRepo = new OrderRepository(supabase);
  const alterationRepo = new CustomerAlterationRepository(supabase);
  const branchRepo = new RetailerBranchRepository(supabase);
  const relationships = await Promise.all(
    customers.map(async (customer) => {
      const [retailer, appointments, orders, alterations, branches] =
        await Promise.all([
          retailerRepo.findById(customer.retailerId),
          appointmentRepo.findByCustomer(customer.id),
          orderRepo.findByCustomer(customer.id),
          alterationRepo.findByCustomer(customer.id),
          branchRepo.listByRetailer(customer.retailerId),
        ]);
      const now = Date.now();
      const nextAppointment = appointments
        .filter(
          (appointment) =>
            !["completed", "canceled", "no_show"].includes(
              appointment.status,
            ) && new Date(appointment.startsAt).getTime() >= now,
        )
        .sort(
          (a, b) =>
            new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
        )[0];
      const activeOrder = orders.find(
        (order) => !TERMINAL_ORDER_STATUSES.has(order.status),
      );
      const activeAlteration = alterations.find(
        (alteration) => !TERMINAL_ALTERATION_STATUSES.has(alteration.status),
      );
      const favoriteBranch =
        branches.find((branch) => branch.isDefault) ?? branches[0] ?? null;
      return {
        customer,
        retailer,
        nextAppointment,
        activeOrder,
        activeAlteration,
        branchCount: branches.length,
        favoriteBranch,
      };
    }),
  );
  const notifications = await new NotificationRepository(supabase).findByUser(
    session.userId,
  );
  const unreadByRetailer = new Map<string, number>();
  for (const notification of notifications) {
    if (notification.readAt) continue;
    unreadByRetailer.set(
      notification.retailerId,
      (unreadByRetailer.get(notification.retailerId) ?? 0) + 1,
    );
  }
  const favoritesHouses: FavoritesHouse[] = await Promise.all(
    relationships.flatMap(({ retailer }) => {
      if (!retailer) return [];
      return [
        (async () => ({
          slug: retailer.slug,
          retailerId: retailer.id,
          variantIdByProductSlug: await buildVariantIdByProductSlug(
            supabase,
            retailer.id,
          ),
        }))(),
      ];
    }),
  );
  const aiConfigured = !!getAIProvider();
  const primary = relationships[0];
  const firstName =
    primary?.customer.fullName.trim().split(/\s+/)[0] ?? "there";
  const primaryUnread = primary
    ? (unreadByRetailer.get(primary.customer.retailerId) ?? 0)
    : 0;

  let morningRoutineHero: {
    weatherSummary?: string;
    featured: HeroPiece;
    pieces: HeroPiece[];
    selectionId: string;
  } | null = null;
  if (primary?.retailer) {
    const forDate = todayUtcDate();
    const view = await ensureTodaysMorningRoutineSelection({
      supabase,
      retailerId: asId<"RetailerId">(primary.customer.retailerId),
      customerId: asId<"CustomerId">(primary.customer.id),
      forDate,
    });
    const [firstRec, ...restRecs] = view?.recommendations ?? [];
    if (view && firstRec) {
      const variantRepo = new ProductVariantRepository(supabase);
      const toPiece = async (
        recommendation: (typeof view.recommendations)[number],
      ): Promise<HeroPiece> => {
        const owned = Boolean(recommendation.wardrobeItemId);
        let priceLabel: string | undefined;
        if (!owned && recommendation.productVariantId) {
          const variant = await variantRepo.findById(
            asId<"ProductVariantId">(recommendation.productVariantId),
          );
          if (variant) priceLabel = formatMoney(variant.price, "en-US");
        }
        const buyAction = recommendation.actions.find(
          (action) => action.kind === "buy",
        );
        const saveAction = recommendation.actions.find(
          (action) => action.kind === "save",
        );
        return {
          id: recommendation.id,
          displayName: recommendation.displayName,
          owned,
          ...(recommendation.primaryImageUrl
            ? { imageUrl: recommendation.primaryImageUrl }
            : {}),
          ...(priceLabel ? { priceLabel } : {}),
          ...(buyAction?.available && buyAction.href
            ? { buyHref: buyAction.href }
            : {}),
          ...(recommendation.productVariantId
            ? { productVariantId: String(recommendation.productVariantId) }
            : {}),
          ...(saveAction?.available && saveAction.productVariantId
            ? { saveVariantId: saveAction.productVariantId }
            : {}),
        };
      };

      morningRoutineHero = {
        ...(view.selection.provenance.weatherSummary
          ? { weatherSummary: view.selection.provenance.weatherSummary }
          : {}),
        featured: await toPiece(firstRec),
        pieces: await Promise.all(restRecs.map(toPiece)),
        selectionId: view.selection.id,
      };
    }
  }

  return (
    <div className="-mx-4 flex flex-col gap-0 sm:-mx-7 lg:-mx-10 xl:-mx-14">
      <MergeFavorites houses={favoritesHouses} />
      <HouseSwitcher
        houses={relationships.map(({ customer, retailer }) => ({
          id: customer.id,
          name: retailer?.displayName ?? "Your atelier",
        }))}
      />
      {primary ? <LocalWidgets variant="dashboard" /> : null}
      {primary && morningRoutineHero ? (
        <MorningRoutineDashboardHero
          retailerId={primary.customer.retailerId}
          retailerSlug={primary.retailer?.slug ?? "store"}
          retailerName={primary.retailer?.displayName ?? "Your atelier"}
          customerFirstName={firstName}
          selectionId={morningRoutineHero.selectionId}
          oneTapEligible={primary.customer.shippingAddresses.length > 0}
          featured={morningRoutineHero.featured}
          pieces={morningRoutineHero.pieces}
          {...(morningRoutineHero.weatherSummary
            ? { weatherSummary: morningRoutineHero.weatherSummary }
            : {})}
          {...(primary.nextAppointment
            ? {
                nextAppointmentHref: `/appointments/${primary.nextAppointment.id}`,
              }
            : {})}
        />
      ) : primary ? (
        <section className="paon-reveal relative isolate min-h-[18rem] overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-stone-900)] text-white shadow-[var(--shadow-elevated)] sm:min-h-[24rem]">
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-20 bg-cover bg-[center_35%] opacity-55"
            style={{
              backgroundImage:
                "url(https://www.nebelspiegel.com/images/smaller/6065.webp)",
            }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-gradient-to-r from-black/90 via-black/55 to-black/10"
          />
          <div className="flex min-h-[18rem] max-w-2xl flex-col justify-between p-5 sm:min-h-[24rem] sm:p-10">
            <div className="flex items-center gap-3">
              <span className="h-px w-8 bg-white/60" />
              <p className="font-accent text-[11px] uppercase tracking-[0.24em] text-white/70">
                Private client
              </p>
            </div>
            <div>
              <p className="mb-3 text-sm text-white/70">
                Good {new Date().getHours() < 12 ? "morning" : "afternoon"},{" "}
                {firstName}
              </p>
              <h1 className="font-display text-3xl leading-[0.94] sm:text-5xl lg:text-6xl">
                Your wardrobe,
                <br />
                beautifully in motion.
              </h1>
              <p className="mt-5 max-w-lg text-sm leading-6 text-white/70 sm:text-base">
                {primary.nextAppointment
                  ? `${primary.retailer?.displayName ?? "Your atelier"} is preparing for your ${APPOINTMENT_TYPE_LABELS[primary.nextAppointment.type].toLowerCase()}.`
                  : `${primary.retailer?.displayName ?? "Your atelier"} is here when you are ready for the next conversation.`}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                {primary.nextAppointment ? (
                  <Link
                    href={`/appointments/${primary.nextAppointment.id}`}
                    className={buttonVariants({
                      variant: "secondary",
                      size: "lg",
                    })}
                  >
                    View next appointment
                  </Link>
                ) : (
                  <Link
                    href={`/r/${primary.retailer?.slug ?? ""}`}
                    className={buttonVariants({
                      variant: "secondary",
                      size: "lg",
                    })}
                  >
                    Request an appointment
                  </Link>
                )}
                <Link
                  href="/messages"
                  className={buttonVariants({
                    variant: "outline",
                    size: "lg",
                    className: "border-white/35 text-white hover:bg-white/10",
                  })}
                >
                  Message your advisor
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-[var(--radius-md)] bg-[var(--color-stone-900)] p-8 text-white sm:p-12">
          <p className="font-accent text-[11px] uppercase tracking-[0.22em] text-white/60">
            Welcome to PAON
          </p>
          <h1 className="font-display mt-4 max-w-xl text-5xl leading-none">
            Your private client space begins here.
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-6 text-white/65">
            When an atelier connects your profile, appointments, orders,
            fittings and conversations will appear as one considered story.
          </p>
        </section>
      )}

      {primary ? (
        <section
          aria-label="Your current moments"
          className="paon-reveal grid overflow-hidden bg-[#e9e5dc] sm:grid-cols-3"
          style={{ animationDelay: "120ms" }}
        >
          <Link
            href={
              primary.nextAppointment
                ? `/appointments/${primary.nextAppointment.id}`
                : "/appointments"
            }
            className="bg-[#f6f3ed] p-7 transition-colors hover:bg-white sm:p-10"
          >
            <p className="text-xs uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
              Next appointment
            </p>
            <p className="font-display mt-3 text-2xl">
              {primary.nextAppointment
                ? formatDate(primary.nextAppointment.startsAt, "en-US")
                : "Whenever you’re ready"}
            </p>
            <p className="mt-1 text-sm text-[var(--color-stone-500)]">
              {primary.nextAppointment
                ? APPOINTMENT_TYPE_LABELS[primary.nextAppointment.type]
                : "Your advisor is a message away"}{" "}
              →
            </p>
          </Link>
          <Link
            href={
              primary.retailer?.slug
                ? `/r/${primary.retailer.slug}`
                : "/appointments"
            }
            className="bg-[#e9e5dc] p-7 transition-colors hover:bg-[#f0ece4] sm:p-10"
          >
            <p className="text-xs uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
              At the workroom
            </p>
            <p className="font-display mt-3 text-2xl">
              {primary.activeAlteration
                ? ALTERATION_STATUS_LABELS[primary.activeAlteration.status]
                : "Nothing away"}
            </p>
            <p className="mt-1 text-sm text-[var(--color-stone-500)]">
              {primary.activeAlteration
                ? (primary.activeAlteration.garmentType ?? "In the atelier")
                : "Visit the house when you need a fitting"}{" "}
              →
            </p>
          </Link>
          <Link
            href="/messages"
            className="bg-[#dcd6cb] p-7 transition-colors hover:bg-[#e7e1d8] sm:p-10"
          >
            <p className="text-xs uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
              Your conversation
            </p>
            <p className="font-display mt-3 text-2xl">
              {primaryUnread > 0
                ? `${primaryUnread} new note${primaryUnread === 1 ? "" : "s"}`
                : "All caught up"}
            </p>
            <p className="mt-1 text-sm text-[var(--color-stone-500)]">
              Speak with your advisor →
            </p>
          </Link>
        </section>
      ) : null}

      {primary?.retailer ? (
        <section
          aria-label="Your house"
          className="paon-reveal bg-[#f5f3ee]"
          style={{ animationDelay: "180ms" }}
        >
          <div className="grid lg:grid-cols-[minmax(18rem,0.92fr)_minmax(0,1.08fr)]">
            <div className="flex min-h-[29rem] flex-col justify-between bg-[#2b2d2a] p-7 text-[#f7f5ee] sm:p-10 lg:p-12">
              <div>
                <p className="font-accent text-[10px] uppercase tracking-[0.22em] text-[#d0c195]">
                  {primary.retailer.displayName}
                </p>
                <h2 className="font-display mt-5 max-w-sm text-4xl leading-[0.96] tracking-[-0.045em] sm:text-5xl">
                  A house built around how you wear life.
                </h2>
                <p className="mt-5 max-w-sm text-sm leading-6 text-white/60">
                  Your appointments, garments, conversations and occasions live
                  here — with the shop always one step away.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/r/${primary.retailer.slug}`}
                  className="rounded-full bg-[#f7f5ee] px-5 py-3 text-sm font-medium text-[#252724] transition hover:bg-white"
                >
                  Shop the collection
                </Link>
                <Link
                  href="/concierge"
                  className="rounded-full border border-white/25 px-5 py-3 text-sm text-white transition hover:bg-white/10"
                >
                  Ask your advisor
                </Link>
              </div>
            </div>

            <div className="grid sm:grid-cols-2">
              {(
                [
                  {
                    href: "/wardrobe",
                    label: "Wardrobe & style",
                    detail:
                      "What you own, what you have saved, and what comes next.",
                    tone: "bg-[#ddd8ce] hover:bg-[#d3cdc1]",
                  },
                  {
                    href: primary.nextAppointment
                      ? `/appointments/${primary.nextAppointment.id}`
                      : "/appointments",
                    label: "Visit the house",
                    detail: primary.nextAppointment
                      ? `${formatDate(primary.nextAppointment.startsAt, "en-US")} · ${APPOINTMENT_TYPE_LABELS[primary.nextAppointment.type]}`
                      : "Book a fitting, consultation or personal visit.",
                    tone: "bg-[#eeeae3] hover:bg-[#e5e0d7]",
                  },
                  {
                    href: primary.activeOrder
                      ? `/orders/${primary.activeOrder.id}`
                      : primary.activeAlteration
                        ? `/alterations/${primary.activeAlteration.id}`
                        : "/services",
                    label: "Care in motion",
                    detail: primary.activeOrder
                      ? ORDER_STATUS_LABELS[primary.activeOrder.status]
                      : primary.activeAlteration
                        ? ALTERATION_STATUS_LABELS[
                            primary.activeAlteration.status
                          ]
                        : "Orders, alterations and ongoing care.",
                    tone: "bg-[#c9d0c6] hover:bg-[#bdc6ba]",
                  },
                  {
                    href: "/messages",
                    label: "Your advisor",
                    detail:
                      primaryUnread > 0
                        ? `${primaryUnread} new message${primaryUnread === 1 ? "" : "s"} waiting for you.`
                        : "A direct line to the people who know your wardrobe.",
                    tone: "bg-[#e4e6df] hover:bg-[#daddd4]",
                  },
                ] as const
              ).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex min-h-[14.5rem] flex-col justify-between p-7 transition-colors sm:p-9 ${item.tone}`}
                >
                  <span className="font-accent text-[10px] uppercase tracking-[0.2em] text-[#676861]">
                    Open
                  </span>
                  <div>
                    <p className="font-display text-3xl leading-[0.98] tracking-[-0.035em] text-[#262824]">
                      {item.label}
                    </p>
                    <p className="mt-3 max-w-xs text-sm leading-6 text-[#62645e]">
                      {item.detail}
                    </p>
                    <p className="mt-5 text-sm font-medium text-[#30332e] transition-transform duration-300 group-hover:translate-x-1">
                      Open <span aria-hidden="true">→</span>
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="grid bg-[#ebe7df] px-7 py-7 sm:grid-cols-2 sm:px-10 lg:grid-cols-4 lg:px-12">
            {(
              [
                { href: "/wishlist", label: "Saved pieces" },
                { href: "/loyalty", label: "Membership & rewards" },
                { href: "/wedding-parties", label: "Wedding plans" },
                { href: "/events", label: "Private events" },
                { href: "/notifications", label: "House updates" },
                { href: "/account", label: "Profile & preferences" },
                { href: "/private-offers", label: "Private offers" },
                { href: "/for-you", label: "For you" },
              ] as const
            ).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex min-h-12 items-center justify-between py-3 text-sm text-[#4e514b] transition hover:text-[#171916]"
              >
                <span>{item.label}</span>
                <span
                  className="mr-5 opacity-0 transition group-hover:mr-0 group-hover:opacity-100"
                  aria-hidden="true"
                >
                  →
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {relationships.length > 1 ? (
        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-accent text-[11px] uppercase tracking-[0.2em] text-[var(--color-stone-500)]">
                {relationships.length > 1 ? "Your houses" : "Your house"}
              </p>
              <h2 className="font-display text-4xl">
                {relationships.length > 1 ? "Your houses." : "Your house."}
              </h2>
              <p className="mt-2 max-w-xl text-sm text-[var(--color-stone-500)]">
                {relationships.length > 1
                  ? "Each atelier you shop with keeps its own book — never mixed."
                  : "Your favorite store, if this house keeps more than one."}
              </p>
            </div>
            <Link
              href="/account"
              className={buttonVariants({ variant: "outline" })}
            >
              Your settings
            </Link>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            {relationships.map(
              (
                {
                  customer,
                  retailer,
                  nextAppointment,
                  activeOrder,
                  activeAlteration,
                  branchCount,
                  favoriteBranch,
                },
                index,
              ) => {
                const unread = unreadByRetailer.get(customer.retailerId) ?? 0;
                return (
                  <Card
                    key={customer.id}
                    id={`house-${customer.id}`}
                    className="paon-reveal scroll-mt-24 overflow-hidden rounded-[var(--radius-md)] p-0 shadow-[var(--shadow-lifted)]"
                    style={{ animationDelay: `${index * 120}ms` }}
                  >
                    <div className="flex items-start justify-between gap-4 border-b border-[var(--color-stone-100)] p-6">
                      <div>
                        <p className="font-display text-3xl">
                          {retailer?.displayName ?? "Your atelier"}
                        </p>
                        <p className="mt-1 text-sm text-[var(--color-stone-500)]">
                          Private client of this house
                        </p>
                        {branchCount > 1 && favoriteBranch ? (
                          <p className="mt-2 text-xs text-[var(--color-stone-500)]">
                            Favorite store:{" "}
                            <span className="text-[var(--color-stone-800)]">
                              {favoriteBranch.name}
                            </span>{" "}
                            ·{" "}
                            <Link
                              href={`/r/${retailer?.slug}/locations`}
                              className="underline"
                            >
                              {branchCount} locations
                            </Link>
                          </p>
                        ) : null}
                      </div>
                      {unread > 0 ? (
                        <span className="rounded-[var(--radius-md)] bg-[var(--color-stone-900)] px-3 py-1 text-xs text-white">
                          {unread} new
                        </span>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-[var(--color-stone-100)]">
                      <Link
                        href={
                          activeOrder ? `/orders/${activeOrder.id}` : "/orders"
                        }
                        className="p-5"
                      >
                        <p className="text-xs text-[var(--color-stone-500)]">
                          Order
                        </p>
                        <p className="mt-1 text-sm font-medium">
                          {activeOrder
                            ? ORDER_STATUS_LABELS[activeOrder.status]
                            : "No order in motion"}{" "}
                          →
                        </p>
                      </Link>
                      <Link
                        href={
                          retailer?.slug
                            ? `/r/${retailer.slug}`
                            : "/appointments"
                        }
                        className="p-5"
                      >
                        <p className="text-xs text-[var(--color-stone-500)]">
                          Garment
                        </p>
                        <p className="mt-1 text-sm font-medium">
                          {activeAlteration
                            ? ALTERATION_STATUS_LABELS[activeAlteration.status]
                            : "Safely with you"}{" "}
                          →
                        </p>
                      </Link>
                    </div>
                    {nextAppointment ? (
                      <Link
                        href={`/appointments/${nextAppointment.id}`}
                        className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-stone-100)] px-6 py-4 text-sm"
                      >
                        <span className="min-w-0">
                          Next: {APPOINTMENT_TYPE_LABELS[nextAppointment.type]}{" "}
                          · {formatDate(nextAppointment.startsAt, "en-US")}
                        </span>
                        <span aria-hidden="true" className="shrink-0">
                          →
                        </span>
                      </Link>
                    ) : null}
                    {aiConfigured && retailer ? (
                      <TodaysPick
                        slug={retailer.slug}
                        retailerId={retailer.id}
                        customerId={customer.id}
                        retailerName={retailer.displayName}
                        customerName={customer.fullName}
                      />
                    ) : null}
                  </Card>
                );
              },
            )}
          </div>
        </section>
      ) : null}

      {!aiConfigured && relationships.length > 1 ? (
        <p className="text-xs text-[var(--color-stone-500)]">
          Personalised editorial picks are unavailable in this demo environment;
          your live service information remains current.
        </p>
      ) : null}
    </div>
  );
}
