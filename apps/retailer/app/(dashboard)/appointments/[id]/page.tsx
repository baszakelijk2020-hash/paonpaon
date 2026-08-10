import {
  AdvisorBriefRepository,
  AlterationRepository,
  AppointmentCloseoutRepository,
  AppointmentRepository,
  ClientelingRepository,
  CoachingRepository,
  CustomerRepository,
  MetadataRepository,
  OrderRepository,
  PhysicalGarmentRepository,
  ProductRepository,
  ProductVariantRepository,
  RetailerBranchRepository,
  RetailerStaffRepository,
  WishlistRepository,
} from "@paon/database";
import {
  asId,
  APPOINTMENT_TYPE_LABELS,
  computePriceComfortSummary,
  computeWishlistOwnershipGaps,
  retailerRoleAtLeast,
} from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { formatDate, formatMoney } from "@paon/utils";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdvisorPreparationBriefCard } from "../../customers/[id]/advisor-preparation-brief";
import { LifecycleBadge } from "../../customers/lifecycle-badge";
import { AppointmentStatusBadge } from "../status-badge";

import { AppointmentActionsForm } from "./appointment-actions-form";
import { AppointmentCloseoutCapture } from "./appointment-closeout-capture";
import { SensitiveInfoToggle } from "./sensitive-info-toggle";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const supabase = await getSupabaseServerClient();

  const appointment = await new AppointmentRepository(supabase).findById(
    asId<"AppointmentId">(id),
  );
  if (!appointment) {
    notFound();
  }

  const [customer, staff, branches, closeout, rectangleConcepts] =
    await Promise.all([
      new CustomerRepository(supabase).findById(appointment.customerId),
      new RetailerStaffRepository(supabase).findByRetailer(session.retailerId),
      new RetailerBranchRepository(supabase).listByRetailer(session.retailerId),
      new AppointmentCloseoutRepository(supabase).findByAppointment(
        session.retailerId,
        appointment.id,
      ),
      new MetadataRepository(supabase).findVisibleConcepts(session.retailerId),
    ]);
  const [notes, orders, garments, advisorBrief, wishlist, alterations] =
    customer
      ? await Promise.all([
          new ClientelingRepository(supabase).findByCustomer(customer.id),
          new OrderRepository(supabase).findByCustomer(customer.id),
          new PhysicalGarmentRepository(supabase).findByCustomer(customer.id),
          new AdvisorBriefRepository(supabase).projectForCustomer({
            retailerId: session.retailerId,
            customerId: customer.id,
            advisorRetailerId: session.retailerId,
            ...(appointment.notes
              ? { appointmentNotes: appointment.notes }
              : {}),
          }),
          new WishlistRepository(supabase).findByCustomer(customer.id),
          new AlterationRepository(supabase).findByCustomer(customer.id),
        ])
      : [[], [], [], null, null, []];
  // Same open/terminal split the alterations detail page uses: only
  // "completed" and "canceled" are terminal, everything else is open work.
  const hasOpenAlteration = alterations.some(
    (alteration) =>
      alteration.status !== "completed" && alteration.status !== "canceled",
  );
  // The appointment type IS the ceremony key: one published ceremony per
  // type covers every appointment of that kind, and a manager who hasn't
  // published one yet for a given type simply sees no card below rather
  // than an empty-state message on every appointment.
  const ceremonyPrompts = customer
    ? await new CoachingRepository(supabase).promptsForContext({
        retailerId: session.retailerId,
        ceremonyKey: appointment.type,
        context: {
          appointmentKind: appointment.type,
          // "First visit" here means no purchase history at this retailer,
          // not literally the customer's first physical visit — the page
          // has no visit-count signal, only orders.
          customerIsFirstVisit: orders.length === 0,
          hasOpenAlteration,
        },
      })
    : [];
  const pinnedNote = notes.find((note) => note.pinned);
  const assignedAdvisor = staff.find(
    (member) => member.id === appointment.staffId,
  );
  const branch = branches.find((item) => item.id === appointment.branchId);

  // PHASE 17.3: price comfort band from real order totals, and
  // favourited-vs-owned gaps matched against real order-line purchases —
  // both plain published formulas, never a hidden score.
  const orderRepo = new OrderRepository(supabase);
  const orderLines = await Promise.all(
    orders.map((order) => orderRepo.findLinesByOrder(order.id)),
  );
  const purchasedProductVariantIds = new Set(
    orderLines.flat().map((line) => line.productVariantId),
  );
  const priceComfortSummary = computePriceComfortSummary(
    orders.map((order) => order.total),
  );
  const wishlistItems = wishlist
    ? await new WishlistRepository(supabase).findItems(wishlist.id)
    : [];
  const wishlistGaps = computeWishlistOwnershipGaps({
    wishlistProductVariantIds: wishlistItems.map(
      (item) => item.productVariantId,
    ),
    purchasedProductVariantIds,
  });
  const wishlistGapDetails = (
    await Promise.all(
      wishlistGaps.map(async (gap) => {
        const variant = await new ProductVariantRepository(supabase).findById(
          asId<"ProductVariantId">(gap.productVariantId),
        );
        if (!variant) return null;
        const product = await new ProductRepository(supabase).findById(
          variant.productId,
        );
        if (!product) return null;
        return { variant, product };
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);

  const canManage = retailerRoleAtLeast(
    session.retailerRole,
    "sales_associate",
  );

  return (
    <div className="flex flex-col gap-8">
      <section className="relative isolate overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-stone-900)] p-7 text-white shadow-[var(--shadow-elevated)] sm:p-10">
        <div
          aria-hidden="true"
          className="font-display absolute right-8 top-0 -z-10 text-[12rem] leading-none text-white/[0.035]"
        >
          {new Date(appointment.startsAt).getDate()}
        </div>
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="font-accent text-[11px] uppercase tracking-[0.22em] text-white/60">
                Appointment brief
              </p>
              <AppointmentStatusBadge status={appointment.status} />
            </div>
            <h1 className="font-display mt-4 text-3xl leading-none sm:text-4xl">
              {customer?.fullName ?? "Unknown customer"}
            </h1>
            <p className="mt-4 text-sm text-white/65">
              {APPOINTMENT_TYPE_LABELS[appointment.type]} ·{" "}
              {formatDate(appointment.startsAt, "en-US")} ·{" "}
              {new Date(appointment.startsAt).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                ...(branch
                  ? { timeZone: branch.timezone, timeZoneName: "short" }
                  : {}),
              })}
              {branch ? ` · ${branch.name}` : ""}
            </p>
          </div>
          {customer && canManage ? (
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/customers/${customer.id}`}
                className={buttonVariants({
                  variant: "secondary",
                  size: "lg",
                })}
              >
                Open relationship
              </Link>
              <Link
                href={`/alterations/new?customerId=${customer.id}&appointmentId=${appointment.id}`}
                className={buttonVariants({
                  variant: "outline",
                  size: "lg",
                  className: "border-white/30 text-white hover:bg-white/10",
                })}
              >
                Begin garment intake
              </Link>
              <Link
                href={`/appointments/${appointment.id}/print`}
                className={buttonVariants({
                  variant: "ghost",
                  size: "lg",
                  className: "text-white hover:bg-white/10",
                })}
              >
                Print
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="flex flex-col gap-6">
          <Card className="rounded-[var(--radius-md)]">
            <p className="font-accent text-[11px] uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
              Prepare the moment
            </p>
            <h2 className="font-display mt-3 text-3xl">
              What should the advisor know?
            </h2>
            {pinnedNote ? (
              <div className="mt-5">
                <SensitiveInfoToggle label="Team preference (private)">
                  <blockquote className="border-l-2 border-[var(--color-stone-900)] pl-5 text-lg leading-7">
                    {pinnedNote.body}
                  </blockquote>
                </SensitiveInfoToggle>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-[var(--color-stone-500)]">
                No team preference is pinned yet. Open the relationship after
                the appointment and save the detail worth remembering.
              </p>
            )}
            {appointment.notes ? (
              <div className="mt-6 rounded-[var(--radius-md)] bg-[var(--color-stone-50)] p-5">
                <p className="text-xs uppercase tracking-wide text-[var(--color-stone-500)]">
                  Appointment request
                </p>
                <p className="mt-2 text-sm leading-6">{appointment.notes}</p>
              </div>
            ) : null}
          </Card>

          {ceremonyPrompts.length > 0 ? (
            <Card className="rounded-[var(--radius-md)]">
              <p className="font-accent text-[11px] uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
                Service ceremony
              </p>
              <h2 className="font-display mt-2 text-2xl">
                What this moment calls for.
              </h2>
              <ul id="ceremony-prompts" className="mt-4 flex flex-col gap-3">
                {ceremonyPrompts.map((step) => (
                  <li key={step.key} className="text-sm leading-6">
                    <strong>{step.title}</strong>
                    <p className="text-[var(--color-stone-500)]">
                      {step.guidance}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {advisorBrief ? (
            <AdvisorPreparationBriefCard
              brief={advisorBrief}
              conversationHref={
                advisorBrief.conversation
                  ? `/messages?c=${advisorBrief.conversation.conversationId}`
                  : "/messages"
              }
            />
          ) : null}

          {customer ? (
            <Card className="rounded-[var(--radius-md)]">
              <p className="font-accent text-[11px] uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
                Purchase and fit intelligence
              </p>
              <h2 className="font-display mt-2 text-2xl">
                What they buy, and what they haven&rsquo;t yet.
              </h2>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                {priceComfortSummary ? (
                  <>
                    <Badge tone="neutral">
                      {priceComfortSummary.band} comfort
                    </Badge>
                    <p className="text-sm text-[var(--color-stone-500)]">
                      Average order{" "}
                      {formatMoney(
                        priceComfortSummary.averageOrderValue,
                        "en-US",
                      )}{" "}
                      across {priceComfortSummary.orderCount} order
                      {priceComfortSummary.orderCount === 1 ? "" : "s"}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-[var(--color-stone-500)]">
                    No orders yet — no price comfort band to show.
                  </p>
                )}
              </div>

              {orders.length > 0 ? (
                <ul className="mt-4 flex flex-col divide-y divide-[var(--color-stone-100)]">
                  {orders
                    .slice()
                    .sort(
                      (a, b) =>
                        Date.parse(b.placedAt ?? b.createdAt) -
                        Date.parse(a.placedAt ?? a.createdAt),
                    )
                    .slice(0, 5)
                    .map((order) => (
                      <li
                        key={order.id}
                        className="flex items-center justify-between gap-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium text-[var(--color-stone-900)]">
                            {order.orderNumber}
                          </p>
                          <p className="text-xs text-[var(--color-stone-500)]">
                            {formatDate(
                              order.placedAt ?? order.createdAt,
                              "en-US",
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">
                            {formatMoney(order.total, "en-US")}
                          </p>
                          <p className="text-xs text-[var(--color-stone-500)]">
                            {order.status.replaceAll("_", " ")}
                          </p>
                        </div>
                      </li>
                    ))}
                </ul>
              ) : null}

              <div className="mt-6">
                <p className="text-xs uppercase tracking-wide text-[var(--color-stone-500)]">
                  Favourited, never bought
                </p>
                {wishlistGapDetails.length === 0 ? (
                  <p className="mt-2 text-sm text-[var(--color-stone-500)]">
                    Nothing wishlisted is still unowned.
                  </p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-2">
                    {wishlistGapDetails.map(({ variant, product }) => (
                      <li key={variant.id}>
                        <Link
                          href={`/products/${product.id}`}
                          className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2 text-sm hover:bg-[var(--color-stone-50)]"
                        >
                          <span>
                            {product.name}
                            {variant.size || variant.color
                              ? ` — ${[variant.size, variant.color].filter(Boolean).join(" / ")}`
                              : ""}
                          </span>
                          <span>{formatMoney(variant.price, "en-US")}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          ) : null}

          {canManage ? (
            <Card className="rounded-[var(--radius-md)]">
              <div className="mb-5">
                <p className="font-accent text-[11px] uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
                  Run the appointment
                </p>
                <h2 className="font-display mt-2 text-3xl">
                  Ownership and progress
                </h2>
              </div>
              <AppointmentActionsForm
                appointmentId={appointment.id}
                currentStatus={appointment.status}
                {...(appointment.staffId
                  ? { currentStaffId: appointment.staffId }
                  : {})}
                staff={staff}
              />
            </Card>
          ) : null}

          {canManage && customer ? (
            <AppointmentCloseoutCapture
              appointmentId={appointment.id}
              customerId={customer.id}
              concepts={rectangleConcepts}
              alreadyClosedOut={Boolean(closeout)}
            />
          ) : null}
        </div>

        <aside className="flex flex-col gap-6">
          <Card className="rounded-[var(--radius-md)] p-0">
            <div className="border-b border-[var(--color-stone-100)] p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-3xl">
                    {customer?.fullName ?? "Customer unavailable"}
                  </p>
                  {customer ? (
                    <div className="mt-2">
                      <SensitiveInfoToggle label="Contact">
                        <p className="text-sm text-[var(--color-stone-500)]">
                          {customer.email}
                          {customer.phone ? ` · ${customer.phone}` : ""}
                        </p>
                      </SensitiveInfoToggle>
                    </div>
                  ) : null}
                </div>
                {customer ? (
                  <LifecycleBadge stage={customer.lifecycleStage} />
                ) : null}
              </div>
            </div>
            <dl className="grid grid-cols-2">
              <div className="border-b border-r border-[var(--color-stone-100)] p-5">
                <dt className="text-xs text-[var(--color-stone-500)]">
                  Advisor
                </dt>
                <dd className="mt-1 text-sm">
                  {assignedAdvisor?.fullName ?? "Unassigned"}
                </dd>
              </div>
              <div className="border-b border-[var(--color-stone-100)] p-5">
                <dt className="text-xs text-[var(--color-stone-500)]">
                  Wardrobe
                </dt>
                <dd className="mt-1 text-sm">{garments.length} garments</dd>
              </div>
              <div className="border-r border-[var(--color-stone-100)] p-5">
                <dt className="text-xs text-[var(--color-stone-500)]">
                  Orders
                </dt>
                <dd className="mt-1 text-sm">{orders.length} recorded</dd>
              </div>
              <div className="p-5">
                <dt className="text-xs text-[var(--color-stone-500)]">
                  Contact
                </dt>
                <dd className="mt-1 text-sm">
                  {customer?.phone ? "Phone ready" : "Email only"}
                </dd>
              </div>
            </dl>
          </Card>

          <Card className="rounded-[var(--radius-md)]">
            <p className="font-accent text-[11px] uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
              After this visit
            </p>
            <h2 className="font-display mt-2 text-2xl">Preserve continuity.</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--color-stone-500)]">
              Complete the status, record the preference in the relationship
              workspace, and start garment intake only when a physical garment
              is present.
            </p>
            {customer ? (
              <Link
                href={`/customers/${customer.id}#clienteling-notes`}
                className="mt-4 inline-flex text-sm underline underline-offset-4"
              >
                Add a private follow-up note →
              </Link>
            ) : null}
          </Card>
        </aside>
      </div>
    </div>
  );
}
