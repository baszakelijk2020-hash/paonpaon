import {
  AlterationRepository,
  AlterationWorkflowRepository,
  AppointmentRepository,
  CustomerRepository,
  NotificationRepository,
  OrderRepository,
  ProductVariantRepository,
  RetailerRepository,
  RetailerStaffRepository,
  StaffRosterRepository,
} from "@paon/database";
import {
  APPOINTMENT_TYPE_LABELS,
  RETAILER_TIER_LABELS,
  retailerRoleAtLeast,
  retailerRoleHasAlterationsPermission,
  type RetailerRole,
} from "@paon/domain";
import { buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { formatMoney } from "@paon/utils";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RetailerStatusBadge } from "../status-badge";

import { ClockWidget } from "./clock-widget";
import { GlossaryBanner } from "./glossary-banner";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const CLOSED_ORDER_STATUSES = new Set([
  "delivered",
  "completed",
  "canceled",
  "refunded",
]);
const CLOSED_ALTERATION_STATUSES = new Set(["completed", "canceled"]);

const ROLE_BRIEFS: Record<
  RetailerRole,
  { eyebrow: string; title: string; description: string }
> = {
  owner: {
    eyebrow: "Owner brief",
    title: "The atelier, at a glance.",
    description:
      "Commercial promises, client moments and decisions that need your hand.",
  },
  admin: {
    eyebrow: "Administrator brief",
    title: "Keep the house moving.",
    description:
      "People, client commitments and operational exceptions in one calm view.",
  },
  manager: {
    eyebrow: "Manager brief",
    title: "Today on the floor.",
    description:
      "Appointments, fulfilment and fitting-room work that shape the day.",
  },
  sales_associate: {
    eyebrow: "Advisor brief",
    title: "Make every client moment count.",
    description:
      "Your next conversations, appointments and relationship signals.",
  },
  production_staff: {
    eyebrow: "Operations brief",
    title: "Promises in motion.",
    description:
      "Orders and garments that need to advance before the next handoff.",
  },
  workshop_manager: {
    eyebrow: "Workshop brief",
    title: "The workroom, in motion.",
    description: "Assignments, due dates and quality decisions.",
  },
  worker: {
    eyebrow: "Workroom brief",
    title: "Your bench, clearly.",
    description: "Assigned garments and the next action for each.",
  },
  read_only: {
    eyebrow: "Atelier brief",
    title: "A clear view of today.",
    description: "Current activity and client commitments.",
  },
};

function isToday(isoDate: string): boolean {
  const target = new Date(isoDate);
  const now = new Date();
  return (
    target.getUTCFullYear() === now.getUTCFullYear() &&
    target.getUTCMonth() === now.getUTCMonth() &&
    target.getUTCDate() === now.getUTCDate()
  );
}

function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function DashboardPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  const retailer = await new RetailerRepository(supabase).findById(
    session.retailerId,
  );
  if (!retailer) notFound();

  const canApprovePrice = retailerRoleHasAlterationsPermission(
    session.retailerRole,
    "approve_pricing",
  );
  const [
    staff,
    myStaffRow,
    pendingProposals,
    appointments,
    notifications,
    orders,
    alterations,
    lowStockCount,
  ] = await Promise.all([
    new RetailerStaffRepository(supabase).findByRetailer(session.retailerId),
    new RetailerStaffRepository(supabase).findByUserId(session.userId),
    canApprovePrice
      ? new AlterationWorkflowRepository(
          supabase,
        ).findPendingProposalsByRetailer(session.retailerId)
      : Promise.resolve([]),
    new AppointmentRepository(supabase).findByRetailer(session.retailerId),
    new NotificationRepository(supabase).findByUser(session.userId),
    new OrderRepository(supabase).findByRetailer(session.retailerId),
    new AlterationRepository(supabase).findByRetailer(session.retailerId),
    retailerRoleAtLeast(session.retailerRole, "manager")
      ? new ProductVariantRepository(supabase).countLowStockForRetailer(
          session.retailerId,
          5,
        )
      : Promise.resolve(0),
  ]);

  const openEntry = myStaffRow
    ? await new StaffRosterRepository(supabase).findOpenTimeEntry(myStaffRow.id)
    : null;
  const todaysAppointments = appointments
    .filter(
      (appointment) =>
        isToday(appointment.startsAt) &&
        !["completed", "canceled", "no_show"].includes(appointment.status),
    )
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );
  const unreadCount = notifications.filter((item) => !item.readAt).length;
  const activeOrders = orders.filter(
    (order) => !CLOSED_ORDER_STATUSES.has(order.status),
  );
  const openAlterations = alterations.filter(
    (alteration) => !CLOSED_ALTERATION_STATUSES.has(alteration.status),
  );
  const activeStaffCount = staff.filter((member) => member.acceptedAt).length;
  const brief = ROLE_BRIEFS[session.retailerRole];

  const customerRepo = new CustomerRepository(supabase);
  const appointmentCustomers = await Promise.all(
    todaysAppointments.map((appointment) =>
      customerRepo.findById(appointment.customerId),
    ),
  );
  const hasAttentionItems =
    pendingProposals.length > 0 ||
    todaysAppointments.length > 0 ||
    unreadCount > 0 ||
    lowStockCount > 0;
  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const attentionCount =
    pendingProposals.length + todaysAppointments.length + unreadCount;

  return (
    <div className="flex flex-col gap-8">
      <GlossaryBanner />
      <section className="paon-reveal relative isolate overflow-hidden rounded-[var(--radius-md)] bg-[#111110] px-6 py-8 text-[var(--color-stone-100)] shadow-[var(--shadow-elevated)] sm:px-10 sm:py-11">
        <div
          aria-hidden="true"
          className="absolute inset-y-0 right-0 -z-10 w-2/5 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1),transparent_68%)]"
        />
        <div className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-white/10 pb-5">
          <div className="flex items-center gap-2 text-xs text-white/50">
            <span>{todayLabel}</span>
          </div>
          <p className="font-accent text-sm uppercase tracking-[0.28em] text-white/85 sm:mx-auto">
            {retailer.displayName}
          </p>
          <div className="ml-auto flex items-center gap-4">
            <Link
              href="/appointments"
              aria-label="Calendar"
              className="text-white/60 hover:text-white"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M3 10h18M8 3v4M16 3v4" />
              </svg>
            </Link>
            <Link
              href="/messages"
              aria-label="Messages"
              className="relative text-white/60 hover:text-white"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M4 6h16v12H4z" />
                <path d="M4 7l8 6 8-6" />
              </svg>
              {unreadCount > 0 ? (
                <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-[8px] font-medium text-[#111110]">
                  {unreadCount}
                </span>
              ) : null}
            </Link>
          </div>
        </div>
        <div className="flex max-w-3xl flex-col gap-5">
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-accent text-[11px] uppercase tracking-[0.22em] text-white/60">
              {brief.eyebrow}
            </p>
            <RetailerStatusBadge status={retailer.status} />
          </div>
          <div>
            <h1 className="font-display max-w-2xl text-4xl leading-[0.98] sm:text-5xl">
              {brief.title}
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/65 sm:text-base">
              {brief.description}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={
                session.retailerRole === "production_staff"
                  ? "/orders"
                  : "/appointments"
              }
              className={buttonVariants({
                variant: "secondary",
                size: "lg",
              })}
            >
              {session.retailerRole === "production_staff"
                ? "Open production queue"
                : "Open appointments"}
            </Link>
            {session.retailerRole !== "production_staff" ? (
              <Link
                href="/customers"
                className={buttonVariants({
                  variant: "outline",
                  size: "lg",
                  className: "border-white/30 text-white hover:bg-white/10",
                })}
              >
                Find a client
              </Link>
            ) : null}
            <a
              href="#attention"
              className="ml-auto rounded-[var(--radius-md)] bg-white/10 px-5 py-2.5 text-xs uppercase tracking-[0.14em] text-white/80 backdrop-blur hover:bg-white/15"
            >
              Attention{attentionCount > 0 ? ` · ${attentionCount}` : ""}
            </a>
          </div>
        </div>
      </section>

      <section
        aria-label="Today at a glance"
        className="paon-reveal grid grid-cols-2 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white shadow-[var(--shadow-lifted)] lg:grid-cols-4"
        style={{ animationDelay: "120ms" }}
      >
        {[
          {
            value: todaysAppointments.length,
            label: "Client moments today",
            href: "/appointments",
            hide: ["workshop_manager", "worker"].includes(session.retailerRole),
          },
          {
            value: activeOrders.length,
            label: "Orders in motion",
            href: "/orders",
            hide: ["workshop_manager", "worker"].includes(session.retailerRole),
          },
          {
            value: openAlterations.length,
            label: "Open garments",
            href: "/alterations",
            hide: false,
          },
          {
            value: unreadCount,
            label: "Unread updates",
            href: "/notifications",
            hide: false,
          },
        ]
          .filter((metric) => !metric.hide)
          .map((metric) => (
            <Link
              key={metric.label}
              href={metric.href}
              className="group border-b border-r border-[var(--color-stone-200)] px-5 py-5 last:border-r-0 sm:px-6"
            >
              <p className="font-display text-4xl text-[var(--color-stone-900)]">
                {metric.value}
              </p>
              <p className="mt-1 text-xs text-[var(--color-stone-500)] group-hover:text-[var(--color-stone-900)]">
                {metric.label} →
              </p>
            </Link>
          ))}
      </section>

      <section
        aria-label="Operate the house"
        className="paon-reveal"
        style={{ animationDelay: "160ms" }}
      >
        <div className="mb-5">
          <p className="font-accent text-[11px] uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
            Mission Control
          </p>
          <h2 className="font-display text-3xl">Every surface, one landing.</h2>
          <p className="mt-2 max-w-xl text-sm text-[var(--color-stone-500)]">
            Open the work that matters for your role — without walking the
            sidebar first.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              {
                href: "/alterations",
                label: "Alterations",
                detail: `${openAlterations.length} open`,
                show: true,
              },
              {
                href: "/appointments",
                label: "Appointments",
                detail: `${todaysAppointments.length} today`,
                show: !["workshop_manager", "worker"].includes(
                  session.retailerRole,
                ),
              },
              {
                href: "/orders",
                label: "Orders",
                detail: `${activeOrders.length} in motion`,
                show: !["workshop_manager", "worker"].includes(
                  session.retailerRole,
                ),
              },
              {
                href: "/customers",
                label: "Clients",
                detail: "Profiles and next actions",
                show: retailerRoleAtLeast(
                  session.retailerRole,
                  "sales_associate",
                ),
              },
              {
                href: "/messages",
                label: "Messages",
                detail:
                  unreadCount > 0
                    ? `${unreadCount} waiting`
                    : "Client messages",
                show: !["workshop_manager", "worker"].includes(
                  session.retailerRole,
                ),
              },
              {
                href: "/wedding-parties",
                label: "Wedding parties",
                detail: "Group fittings",
                show: retailerRoleAtLeast(
                  session.retailerRole,
                  "sales_associate",
                ),
              },
              {
                href: "/products",
                label: "Products",
                detail:
                  lowStockCount > 0
                    ? `${lowStockCount} low stock`
                    : "Imagery and availability",
                show: retailerRoleAtLeast(session.retailerRole, "manager"),
              },
              {
                href: "/collections",
                label: "Collections",
                detail: "Group products for storefront",
                show: retailerRoleAtLeast(session.retailerRole, "manager"),
              },
              {
                href: "/loyalty",
                label: "Loyalty",
                detail: "Status and rewards",
                show: retailerRoleAtLeast(session.retailerRole, "manager"),
              },
              {
                href: "/events",
                label: "Events",
                detail: "Previews and RSVPs",
                show: retailerRoleAtLeast(session.retailerRole, "manager"),
              },
              {
                href: "/analytics",
                label: "Performance",
                detail: "Commercial signals",
                show: retailerRoleAtLeast(session.retailerRole, "manager"),
              },
              {
                href: "/staff",
                label: "Team",
                detail: `${activeStaffCount} active`,
                show: retailerRoleAtLeast(session.retailerRole, "admin"),
              },
              {
                href: "/settings",
                label: "Settings",
                detail: "Brand, billing, payments",
                show: retailerRoleAtLeast(session.retailerRole, "admin"),
              },
              {
                href: "/notifications",
                label: "Updates",
                detail: "House activity",
                show: true,
              },
              {
                href: `/r/${retailer.slug}`,
                label: "Live storefront",
                detail: "See what clients see",
                show: true,
                external: true,
              },
            ] as const
          )
            .filter((item) => item.show)
            .map((item) => (
              <Link
                key={item.href}
                href={
                  "external" in item && item.external
                    ? `${process.env["NEXT_PUBLIC_CUSTOMER_APP_URL"]?.replace(/\/$/, "") ?? "http://localhost:3002"}${item.href}`
                    : item.href
                }
                {...("external" in item && item.external
                  ? { target: "_blank", rel: "noreferrer" }
                  : {})}
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

      {myStaffRow ? (
        <ClockWidget
          {...(openEntry ? { clockedInAt: openEntry.clockInAt } : {})}
        />
      ) : null}

      <div
        id="attention"
        className="grid scroll-mt-8 gap-8 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)]"
      >
        <section className="paon-reveal" style={{ animationDelay: "240ms" }}>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="font-accent text-[11px] uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
                Brief
              </p>
              <h2 className="font-display text-3xl text-[var(--color-stone-900)]">
                Needs your attention
              </h2>
            </div>
            <span className="rounded-[var(--radius-md)] bg-[var(--color-stone-900)] px-3 py-1 text-xs text-white">
              {pendingProposals.length +
                todaysAppointments.length +
                unreadCount +
                (lowStockCount > 0 ? 1 : 0)}
            </span>
          </div>
          {hasAttentionItems ? (
            <div className="flex flex-col gap-3">
              {pendingProposals.map((proposal) => (
                <Link
                  key={proposal.id}
                  href={`/alterations/${proposal.alterationId}#pricing`}
                  className="group"
                >
                  <Card className="flex items-center justify-between gap-4 border-l-4 border-l-[var(--color-warning-500)] transition-transform duration-[var(--duration-quiet)] ease-[var(--ease-out-quiet)] group-hover:-translate-y-0.5 group-hover:shadow-[var(--shadow-lifted)]">
                    <div>
                      <p className="font-medium text-[var(--color-stone-900)]">
                        Price approval needed · {proposal.workOrderNumber}
                      </p>
                      <p className="mt-1 text-sm text-[var(--color-stone-500)]">
                        {formatMoney(proposal.originalAmount, "en-US")} →{" "}
                        {formatMoney(proposal.proposedAmount, "en-US")}
                      </p>
                    </div>
                    <span aria-hidden="true" className="text-xl">
                      ↗
                    </span>
                  </Card>
                </Link>
              ))}
              {todaysAppointments.map((appointment, index) => {
                const startsMs = new Date(appointment.startsAt).getTime();
                const nowMs = Date.now();
                const dueSoon =
                  startsMs >= nowMs && startsMs - nowMs <= 30 * 60 * 1000;
                const isNext =
                  index === 0 &&
                  startsMs >= nowMs &&
                  !["completed", "canceled", "no_show"].includes(
                    appointment.status,
                  );
                return (
                  <Link
                    key={appointment.id}
                    href={`/appointments/${appointment.id}`}
                    className="group"
                  >
                    <Card
                      className={`grid grid-cols-[4.5rem_1fr_auto] items-center gap-4 transition-transform duration-[var(--duration-quiet)] ease-[var(--ease-out-quiet)] group-hover:-translate-y-0.5 group-hover:shadow-[var(--shadow-lifted)] ${
                        isNext || dueSoon
                          ? "border-l-4 border-l-[var(--color-stone-900)] bg-[var(--color-stone-50)]"
                          : ""
                      }`}
                    >
                      <p className="font-display text-2xl">
                        {formatTime(appointment.startsAt)}
                      </p>
                      <div>
                        <p className="font-medium">
                          {appointmentCustomers[index]?.fullName ?? "Customer"}
                          {dueSoon ? (
                            <span className="ml-2 text-xs font-normal uppercase tracking-wide text-[var(--color-warning-500)]">
                              Due soon
                            </span>
                          ) : isNext ? (
                            <span className="ml-2 text-xs font-normal uppercase tracking-wide text-[var(--color-stone-500)]">
                              Next
                            </span>
                          ) : null}
                        </p>
                        <p className="text-sm text-[var(--color-stone-500)]">
                          {APPOINTMENT_TYPE_LABELS[appointment.type]}
                        </p>
                      </div>
                      <span aria-hidden="true">→</span>
                    </Card>
                  </Link>
                );
              })}
              {unreadCount > 0 ? (
                <Link href="/messages" className="group">
                  <Card className="flex items-center justify-between gap-3 transition-transform duration-[var(--duration-quiet)] ease-[var(--ease-out-quiet)] group-hover:-translate-y-0.5 group-hover:shadow-[var(--shadow-lifted)]">
                    <div>
                      <p className="font-medium">
                        {unreadCount === 1
                          ? "1 conversation waiting"
                          : `${unreadCount} conversations waiting`}
                      </p>
                      <p className="text-sm text-[var(--color-stone-500)]">
                        Reply while the client’s context is fresh.
                      </p>
                    </div>
                    <span aria-hidden="true">→</span>
                  </Card>
                </Link>
              ) : null}
              {lowStockCount > 0 ? (
                <Link href="/products" className="group">
                  <Card className="flex items-center justify-between gap-3 border-l-4 border-l-[var(--color-warning-500)] transition-transform duration-[var(--duration-quiet)] ease-[var(--ease-out-quiet)] group-hover:-translate-y-0.5 group-hover:shadow-[var(--shadow-lifted)]">
                    <div>
                      <p className="font-medium">
                        {lowStockCount === 1
                          ? "1 variant at or below 5 units"
                          : `${lowStockCount} variants at or below 5 units`}
                      </p>
                      <p className="text-sm text-[var(--color-stone-500)]">
                        Review Products before a client asks for what’s gone.
                      </p>
                    </div>
                    <span aria-hidden="true">→</span>
                  </Card>
                </Link>
              ) : null}
            </div>
          ) : (
            <Card className="border-dashed py-12 text-center">
              <p className="font-display text-2xl">The atelier is in rhythm.</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--color-stone-500)]">
                There are no approvals, appointments or unread messages waiting.
                Use the quiet moment to prepare a client follow-up.
              </p>
              <Link
                href="/customers"
                className={buttonVariants({
                  variant: "outline",
                  className: "mt-5",
                })}
              >
                Open Clients
              </Link>
            </Card>
          )}
        </section>

        <aside className="paon-reveal" style={{ animationDelay: "360ms" }}>
          <p className="font-accent text-[11px] uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
            House pulse
          </p>
          <h2 className="font-display text-3xl">This atelier</h2>
          <Card className="mt-4 overflow-hidden p-0">
            <div className="border-b border-[var(--color-stone-100)] px-6 py-5">
              <p className="font-display text-2xl">{retailer.displayName}</p>
              <p className="mt-1 text-sm text-[var(--color-stone-500)]">
                {retailer.legalName}
              </p>
            </div>
            <dl className="grid grid-cols-2">
              <div className="border-b border-r border-[var(--color-stone-100)] p-5">
                <dt className="text-xs text-[var(--color-stone-500)]">Team</dt>
                <dd className="mt-1 text-lg">{activeStaffCount} active</dd>
              </div>
              <div className="border-b border-[var(--color-stone-100)] p-5">
                <dt className="text-xs text-[var(--color-stone-500)]">
                  Membership
                </dt>
                <dd className="mt-1 text-lg">
                  {RETAILER_TIER_LABELS[retailer.tier]}
                </dd>
              </div>
              <div className="border-r border-[var(--color-stone-100)] p-5">
                <dt className="text-xs text-[var(--color-stone-500)]">
                  Currency
                </dt>
                <dd className="mt-1 text-lg">{retailer.defaultCurrency}</dd>
              </div>
              <div className="p-5">
                <dt className="text-xs text-[var(--color-stone-500)]">
                  Locale
                </dt>
                <dd className="mt-1 text-lg">{retailer.defaultLocale}</dd>
              </div>
            </dl>
          </Card>
        </aside>
      </div>
    </div>
  );
}
