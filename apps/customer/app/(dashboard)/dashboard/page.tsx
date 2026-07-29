import {
  AppointmentRepository,
  CustomerAlterationRepository,
  CustomerRepository,
  NotificationRepository,
  OrderRepository,
  RetailerRepository,
} from "@paon/database";
import { APPOINTMENT_TYPE_LABELS, ORDER_STATUS_LABELS } from "@paon/domain";
import { buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { formatDate, humaniseStatus } from "@paon/utils";
import Link from "next/link";

import { buildVariantIdByProductSlug } from "../wishlist/favorites-map";
import {
  MergeFavorites,
  type FavoritesHouse,
} from "../wishlist/merge-favorites";

import { HouseSwitcher } from "./house-switcher";
import { TodaysPick } from "./todays-pick";

import { getAIProvider } from "@/lib/ai";
import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

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
  const relationships = await Promise.all(
    customers.map(async (customer) => {
      const [retailer, appointments, orders, alterations] = await Promise.all([
        retailerRepo.findById(customer.retailerId),
        appointmentRepo.findByCustomer(customer.id),
        orderRepo.findByCustomer(customer.id),
        alterationRepo.findByCustomer(customer.id),
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
      return {
        customer,
        retailer,
        nextAppointment,
        activeOrder,
        activeAlteration,
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

  return (
    <div className="flex flex-col gap-8">
      <MergeFavorites houses={favoritesHouses} />
      <HouseSwitcher
        houses={relationships.map(({ customer, retailer }) => ({
          id: customer.id,
          name: retailer?.displayName ?? "Your atelier",
        }))}
      />
      {primary ? (
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
          className="paon-reveal grid overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white shadow-[var(--shadow-lifted)] sm:grid-cols-3"
          style={{ animationDelay: "120ms" }}
        >
          <Link
            href={
              primary.nextAppointment
                ? `/appointments/${primary.nextAppointment.id}`
                : "/appointments"
            }
            className="border-b border-[var(--color-stone-200)] p-6 sm:border-b-0 sm:border-r"
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
            className="border-b border-[var(--color-stone-200)] p-6 sm:border-b-0 sm:border-r"
          >
            <p className="text-xs uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
              At the workroom
            </p>
            <p className="font-display mt-3 text-2xl capitalize">
              {primary.activeAlteration
                ? humaniseStatus(primary.activeAlteration.status)
                : "Nothing away"}
            </p>
            <p className="mt-1 text-sm text-[var(--color-stone-500)]">
              {primary.activeAlteration
                ? (primary.activeAlteration.garmentType ?? "In the atelier")
                : "Visit the house when you need a fitting"}{" "}
              →
            </p>
          </Link>
          <Link href="/messages" className="p-6">
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
          aria-label="Everything in your house"
          className="paon-reveal"
          style={{ animationDelay: "180ms" }}
        >
          <div className="mb-5">
            <p className="font-accent text-[11px] uppercase tracking-[0.2em] text-[var(--color-stone-500)]">
              The house
            </p>
            <h2 className="font-display text-4xl">Everything in one place.</h2>
            <p className="mt-2 max-w-xl text-sm text-[var(--color-stone-500)]">
              Shop, book, follow garments, and speak with your advisor — without
              hunting through menus.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                {
                  href: `/r/${primary.retailer.slug}`,
                  label: "Shop the collection",
                  detail: primary.retailer.displayName,
                },
                {
                  href: "/appointments",
                  label: "Appointments",
                  detail: "Fittings and consultations",
                },
                {
                  href: "/orders",
                  label: "Orders",
                  detail: primary.activeOrder
                    ? ORDER_STATUS_LABELS[primary.activeOrder.status]
                    : "Purchases and delivery",
                },
                {
                  href: "/wishlist",
                  label: "Saved",
                  detail: "Your considered selection",
                },
                {
                  href: "/loyalty",
                  label: "Loyalty",
                  detail: "Status, points and rewards",
                },
                {
                  href: "/loyalty#referrals",
                  label: "Referrals",
                  detail: "Invite someone you trust",
                },
                {
                  href: "/messages",
                  label: "Messages",
                  detail:
                    primaryUnread > 0
                      ? `${primaryUnread} waiting`
                      : "Private conversations",
                },
                {
                  href: "/wedding-parties",
                  label: "Wedding parties",
                  detail: "Group fittings and plans",
                },
                {
                  href: "/events",
                  label: "Events",
                  detail: "Private previews and invitations",
                },
                {
                  href: "/notifications",
                  label: "Updates",
                  detail: "Everything worth knowing",
                },
                {
                  href: "/account",
                  label: "Settings",
                  detail: "Contact, delivery and privacy",
                },
              ] as const
            ).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white px-5 py-5 shadow-[var(--shadow-lifted)] transition-transform duration-[var(--duration-quiet)] hover:-translate-y-0.5"
              >
                <p className="font-display text-xl text-[var(--color-stone-900)]">
                  {item.label}
                </p>
                <p className="mt-1 text-sm text-[var(--color-stone-500)] group-hover:text-[var(--color-stone-800)]">
                  {item.detail} →
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {relationships.length > 0 ? (
        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-accent text-[11px] uppercase tracking-[0.2em] text-[var(--color-stone-500)]">
                Your houses
              </p>
              <h2 className="font-display text-4xl">Your houses.</h2>
              <p className="mt-2 max-w-xl text-sm text-[var(--color-stone-500)]">
                Each atelier you shop with keeps its own book — never mixed.
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
                        <p className="mt-1 text-sm font-medium capitalize">
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
                        <p className="mt-1 text-sm font-medium capitalize">
                          {activeAlteration
                            ? humaniseStatus(activeAlteration.status)
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

      {!aiConfigured && relationships.length > 0 ? (
        <p className="text-xs text-[var(--color-stone-500)]">
          Personalised editorial picks are unavailable in this demo environment;
          your live service information remains current.
        </p>
      ) : null}
    </div>
  );
}
