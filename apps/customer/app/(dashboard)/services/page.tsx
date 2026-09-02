import {
  CustomerRepository,
  RetailerRepository,
  ServicePartnerRepository,
  ServicePlanRepository,
} from "@paon/database";
import {
  BOOKING_KINDS_BY_SERVICE,
  SERVICE_BOOKING_KIND_LABELS,
  SERVICE_BOOKING_STATUS_LABELS,
  SERVICE_CARE_KIND_LABELS,
  SERVICE_ENTITLEMENT_KIND_LABELS,
  SERVICE_KIND_LABELS,
  SERVICE_WEEKLY_PLAN_DAY_LABELS,
  SERVICE_WEEKLY_PLAN_OCCASION_TAG_LABELS,
  SERVICE_WEEKLY_PLAN_STATUS_LABELS,
  canDecideServiceWeeklyPlan,
  recommendedAppointmentType,
  type ServiceBooking,
  type ServiceBookingKind,
  type ServiceCareRecord,
  type ServiceEntitlement,
  type ServiceKind,
  type ServiceMembership,
  type ServicePlan,
  type ServiceWeeklyPlan,
  type ServiceWeeklyPlanDay,
} from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Button } from "@paon/ui/components/Button";
import { DateTimePicker } from "@paon/ui/components/DateTimePicker";
import { FormField } from "@paon/ui/components/FormField";
import Link from "next/link";

import { decideWeeklyPlan, requestConciergeBooking } from "./actions";
import { PreferredTailoringMonthGrid } from "./preferred-tailoring-month-grid";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const STATUS_TONE = {
  active: "success",
  paused: "warning",
  ended: "neutral",
  requested: "neutral",
  confirmed: "success",
  in_progress: "warning",
  fulfilled: "success",
  canceled: "neutral",
} as const;

export default async function CustomerServicesPage() {
  const session = await requireSession();
  const client = await getSupabaseServerClient();
  const customers = await new CustomerRepository(client).findByUserId(
    session.userId,
  );
  const services = new ServicePlanRepository(client);
  const retailers = new RetailerRepository(client);
  const [careStatus, groups] = await Promise.all([
    new ServicePartnerRepository(client).listMyCustomerCareStatus(),
    Promise.all(
      customers.map(async (customer) => {
        const [retailer, memberships, bookings, history] = await Promise.all([
          retailers.findById(customer.retailerId),
          services.listMembershipsForCustomer(customer.id),
          services.listBookingsForCustomer(customer.id),
          services.listHistoryForCustomer(customer.id),
        ]);
        const plansById = new Map<string, ServicePlan>();
        for (const membership of memberships) {
          const plan = await services.findPlanById(membership.planId);
          if (plan) plansById.set(plan.id, plan);
        }
        const [entitlements, care, weeklyPlans] = await Promise.all([
          Promise.all(
            memberships.map(async (membership) => ({
              membershipId: membership.id,
              items: await services.listEntitlementsForMembership(
                membership.id,
              ),
            })),
          ),
          Promise.all(
            memberships.map((membership) =>
              services.listCareForMembership(membership.id),
            ),
          ),
          Promise.all(
            memberships.map(async (membership) => ({
              membershipId: membership.id,
              items: await services.listWeeklyPlansForMembership(membership.id),
            })),
          ),
        ]);
        const weeklyPlanDays = await Promise.all(
          weeklyPlans
            .flatMap((entry) => entry.items)
            .map(async (plan) => ({
              planId: plan.id,
              items: await services.listWeeklyPlanDays(plan.id),
            })),
        );
        return {
          customer,
          retailer,
          memberships,
          plansById,
          bookings,
          history,
          care: care.flat(),
          entitlementsByMembership: new Map(
            entitlements.map((entry) => [entry.membershipId, entry.items]),
          ),
          weeklyPlansByMembership: new Map(
            weeklyPlans.map((entry) => [entry.membershipId, entry.items]),
          ),
          weeklyPlanDaysByPlan: new Map(
            weeklyPlanDays.map((entry) => [entry.planId, entry.items]),
          ),
        };
      }),
    ),
  ]);

  const careRecords = groups.flatMap((group) => group.care);

  return (
    <div className="customer-page flex flex-col gap-8">
      <header className="customer-page-header flex-col items-start gap-2">
        <p className="customer-kicker">Private client services</p>
        <h1 className="font-display text-4xl text-[var(--customer-ink)] sm:text-5xl">
          Preferred Tailoring &amp; High Maintenance
        </h1>
        <p className="max-w-2xl text-[15px] leading-7 text-[var(--color-stone-600)]">
          Advisor-led wardrobe planning and ongoing care, pressing, repair, and
          collection — without payment on this surface.
        </p>
      </header>

      <PreferredTailoringMonthGrid
        bookings={groups.flatMap((group) => group.bookings)}
        now={new Date()}
      />

      <div id="care-journey">
        <CareJourney careStatus={careStatus} careRecords={careRecords} />
      </div>

      {groups.every((group) => group.memberships.length === 0) ? (
        <div className="customer-panel flex flex-col gap-2 p-6">
          <p className="text-sm text-[var(--color-stone-700)]">
            No concierge memberships yet. Your house advisor can open Preferred
            Tailoring or High Maintenance for you.
          </p>
          <p className="text-sm text-[var(--color-stone-500)]">
            You can still book fittings from{" "}
            <Link className="underline" href="/appointments">
              Appointments
            </Link>
            .
          </p>
        </div>
      ) : null}

      {groups.map(
        (
          {
            customer,
            retailer,
            memberships,
            plansById,
            bookings,
            history,
            entitlementsByMembership,
            weeklyPlansByMembership,
            weeklyPlanDaysByPlan,
          },
          index,
        ) =>
          memberships.length === 0 ? null : (
            <section
              key={customer.id}
              className="customer-panel paon-reveal flex flex-col gap-6 p-6"
              style={{ animationDelay: `${index * 120}ms` }}
            >
              <div>
                <p className="customer-kicker">
                  {retailer?.displayName ?? "Retailer"}
                </p>
              </div>

              {memberships.map((membership) => {
                const plan = plansById.get(membership.planId);
                if (!plan) return null;
                return (
                  <MembershipPanel
                    key={membership.id}
                    membership={membership}
                    plan={plan}
                    entitlements={
                      entitlementsByMembership.get(membership.id) ?? []
                    }
                    bookings={bookings.filter(
                      (booking) => booking.membershipId === membership.id,
                    )}
                    weeklyPlans={
                      weeklyPlansByMembership.get(membership.id) ?? []
                    }
                    weeklyPlanDaysByPlan={weeklyPlanDaysByPlan}
                  />
                );
              })}

              {history.length > 0 ? (
                <section aria-label="Service history">
                  <h2 className="font-display text-lg text-[var(--color-stone-900)]">
                    Service history
                  </h2>
                  <ul className="mt-2 flex flex-col gap-2">
                    {history.slice(0, 12).map((event) => (
                      <li
                        key={event.id}
                        className="border-b border-[var(--color-stone-100)] pb-2 text-sm text-[var(--color-stone-700)]"
                      >
                        <span className="text-[var(--color-stone-500)]">
                          {new Date(event.createdAt).toLocaleString()}
                        </span>
                        {" — "}
                        {event.summary}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </section>
          ),
      )}
    </div>
  );
}

const CARE_STATE_COPY = {
  with_retailer: {
    label: "Preparing collection",
    detail: "Your garment is with your house while collection is arranged.",
    step: 0,
  },
  in_transit_to_partner: {
    label: "On its way for care",
    detail: "Your garment is moving through a recorded handoff.",
    step: 1,
  },
  with_partner: {
    label: "In care",
    detail:
      "Care is underway. We will update this journey at the next handoff.",
    step: 2,
  },
  in_transit_to_retailer: {
    label: "Returning to your house",
    detail:
      "Care is complete and your garment is on its way back to your house.",
    step: 3,
  },
  returned_to_retailer: {
    label: "Back with your house",
    detail: "Your house has received your garment and is preparing its return.",
    step: 4,
  },
  released_to_customer: {
    label: "Returned to you",
    detail:
      "Your garment has completed its care journey and is back in your wardrobe.",
    step: 5,
  },
} as const;

const CARE_STEPS = [
  "Collection arranged",
  "Handed into care",
  "Care in progress",
  "Returned to your house",
  "Ready for your wardrobe",
] as const;

function CareJourney({
  careStatus,
  careRecords,
}: {
  careStatus: Awaited<
    ReturnType<ServicePartnerRepository["listMyCustomerCareStatus"]>
  >;
  careRecords: readonly ServiceCareRecord[];
}) {
  if (careStatus.length === 0) {
    return (
      <>
        <section
          className="customer-panel-dark paon-reveal overflow-hidden"
          aria-labelledby="highmaintenance-heading"
        >
          <div className="grid min-h-72 items-end bg-[linear-gradient(135deg,#dbe2d8_0%,#cbd3c5_54%,#aebcaf_100%)] p-6 text-[var(--customer-ink)] sm:p-9">
            <div className="max-w-xl">
              <p className="customer-kicker text-[var(--customer-ink)]">
                High Maintenance
              </p>
              <h2
                id="highmaintenance-heading"
                className="font-display mt-3 text-3xl text-[var(--customer-ink)] sm:text-4xl"
              >
                Care keeps your wardrobe ready.
              </h2>
              <p className="text-[var(--customer-ink)]/75 mt-3 max-w-lg text-sm leading-6">
                When your house arranges care for a booking-linked garment, its
                handoffs and return will appear here — without exposing the
                operational notes behind the service.
              </p>
            </div>
          </div>
        </section>
        <CareOutcomeHistory careRecords={careRecords} />
      </>
    );
  }

  return (
    <section aria-labelledby="highmaintenance-heading" className="space-y-4">
      <div className="px-1">
        <p className="customer-kicker">High Maintenance</p>
        <h2
          id="highmaintenance-heading"
          className="font-display mt-2 text-3xl text-[var(--color-stone-900)] sm:text-4xl"
        >
          Care, held in view.
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-stone-600)]">
          A considered garment deserves a considered return. Follow each
          recorded handoff from collection through care and back to your
          wardrobe.
        </p>
      </div>

      <div className="space-y-5">
        {careStatus.map((care, index) => {
          const state = CARE_STATE_COPY[care.custodyState];
          const completedSteps = state.step === 5 ? 5 : state.step;
          return (
            <article
              key={care.bookingId}
              className="customer-panel-dark paon-reveal overflow-hidden"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="grid min-h-64 gap-6 bg-[linear-gradient(120deg,#272a25_0%,#4c564b_58%,#71806e_100%)] p-6 text-white sm:grid-cols-[1.1fr_0.9fr] sm:p-9">
                <div className="flex flex-col justify-end">
                  <p className="font-accent text-[11px] uppercase tracking-[0.18em] text-white/70">
                    {care.capability.replaceAll("_", " ")}
                  </p>
                  <h3 className="font-display mt-2 text-3xl sm:text-4xl">
                    {care.garmentDisplayName}
                  </h3>
                  <p className="mt-3 max-w-md text-sm leading-6 text-white/80">
                    {state.detail}
                  </p>
                </div>
                <div
                  className="relative min-h-40 overflow-hidden rounded-sm border border-white/20 bg-[radial-gradient(ellipse_at_50%_30%,#d9c8b2_0%,#867666_36%,#26211d_76%)]"
                  aria-hidden="true"
                >
                  <div className="absolute inset-x-[24%] bottom-0 h-[78%] rounded-t-[48%] border border-white/25 bg-black/20 shadow-2xl" />
                  <div className="absolute left-1/2 top-[12%] h-8 w-8 -translate-x-1/2 rotate-45 border-l border-t border-white/40" />
                </div>
              </div>

              <div className="bg-[var(--customer-paper)] p-6 text-[var(--customer-ink)] sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="customer-kicker">Current care state</p>
                    <p className="font-display mt-1 text-2xl text-[var(--customer-ink)]">
                      {state.label}
                    </p>
                  </div>
                  <p className="text-sm text-[var(--color-stone-600)]">
                    Due{" "}
                    {new Date(`${care.dueOn}T00:00:00`).toLocaleDateString()}
                  </p>
                </div>

                <ol
                  className="mt-7 grid gap-3 sm:grid-cols-5"
                  aria-label="Care journey"
                >
                  {CARE_STEPS.map((step, stepIndex) => {
                    const complete = stepIndex < completedSteps;
                    const current =
                      stepIndex ===
                        Math.min(completedSteps, CARE_STEPS.length - 1) &&
                      care.custodyState !== "released_to_customer";
                    return (
                      <li key={step} className="flex gap-2 text-sm sm:flex-col">
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${
                            complete
                              ? "border-[var(--color-stone-900)] bg-[var(--color-stone-900)] text-white"
                              : current
                                ? "border-[var(--color-stone-900)] text-[var(--color-stone-900)]"
                                : "border-[var(--color-stone-200)] text-[var(--color-stone-400)]"
                          }`}
                        >
                          {complete ? "✓" : stepIndex + 1}
                        </span>
                        <span
                          className={
                            complete || current
                              ? "text-[var(--color-stone-900)]"
                              : "text-[var(--color-stone-500)]"
                          }
                        >
                          {step}
                        </span>
                      </li>
                    );
                  })}
                </ol>

                {care.returnedOn ? (
                  <p className="mt-6 border-t border-[var(--color-stone-100)] pt-4 text-sm text-[var(--color-stone-600)]">
                    Returned to your house on{" "}
                    {new Date(
                      `${care.returnedOn}T00:00:00`,
                    ).toLocaleDateString()}
                    .
                  </p>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
      <CareOutcomeHistory careRecords={careRecords} />
    </section>
  );
}

function CareOutcomeHistory({
  careRecords,
}: {
  careRecords: readonly ServiceCareRecord[];
}) {
  if (careRecords.length === 0) return null;

  const recentRecords = [...careRecords]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 8);

  return (
    <section
      className="customer-panel px-5 py-5"
      aria-labelledby="care-outcomes-heading"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="customer-kicker">High Maintenance</p>
          <h3
            id="care-outcomes-heading"
            className="font-display mt-1 text-xl text-[var(--color-stone-900)]"
          >
            Care outcomes
          </h3>
        </div>
        <p className="text-sm text-[var(--color-stone-500)]">
          Your house&apos;s completed care notes
        </p>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {recentRecords.map((record) => (
          <li
            key={record.id}
            className="border-b border-[var(--color-stone-100)] pb-2 text-sm last:border-0 last:pb-0"
          >
            <p className="font-medium text-[var(--color-stone-900)]">
              {SERVICE_CARE_KIND_LABELS[record.careKind]}
            </p>
            <p className="mt-0.5 text-[var(--color-stone-700)]">
              {record.summary}
            </p>
            <p className="mt-1 text-xs text-[var(--color-stone-500)]">
              Recorded {new Date(record.createdAt).toLocaleDateString()}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MembershipPanel({
  membership,
  plan,
  entitlements,
  bookings,
  weeklyPlans,
  weeklyPlanDaysByPlan,
}: {
  membership: ServiceMembership;
  plan: ServicePlan;
  entitlements: readonly ServiceEntitlement[];
  bookings: readonly ServiceBooking[];
  weeklyPlans: readonly ServiceWeeklyPlan[];
  weeklyPlanDaysByPlan: ReadonlyMap<string, readonly ServiceWeeklyPlanDay[]>;
}) {
  const bookingKinds = BOOKING_KINDS_BY_SERVICE[plan.kind as ServiceKind];
  return (
    <section
      className="customer-panel flex flex-col gap-5 p-5"
      aria-label={`${SERVICE_KIND_LABELS[plan.kind]} membership`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-[var(--customer-ink)]">
            {SERVICE_KIND_LABELS[plan.kind]}
          </h2>
          <p className="text-sm text-[var(--color-stone-500)]">
            {plan.summary}
          </p>
        </div>
        <Badge tone={STATUS_TONE[membership.status]}>{membership.status}</Badge>
      </div>

      {membership.commitmentNotes ? (
        <p className="text-sm text-[var(--color-stone-700)]">
          Commitment: {membership.commitmentNotes}
        </p>
      ) : null}

      <div>
        <h3 className="text-sm font-medium text-[var(--color-stone-900)]">
          Remaining credits
        </h3>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {entitlements.map((entitlement) => (
            <li
              key={entitlement.id}
              className="customer-list-row rounded-[var(--customer-radius)] px-3 py-3 text-sm"
            >
              {SERVICE_ENTITLEMENT_KIND_LABELS[entitlement.kind]}
              <span className="ml-2 font-medium">
                {entitlement.remainingQuantity}
              </span>
            </li>
          ))}
          {entitlements.length === 0 ? (
            <li className="text-sm text-[var(--color-stone-500)]">
              No credits yet.
            </li>
          ) : null}
        </ul>
      </div>

      {plan.kind === "preferred_tailoring" && weeklyPlans.length > 0 ? (
        <div>
          <h3 className="text-sm font-medium text-[var(--color-stone-900)]">
            Weekly wardrobe plan
          </h3>
          <ul className="mt-2 flex flex-col gap-3">
            {weeklyPlans.map((weeklyPlan) => (
              <li
                key={weeklyPlan.id}
                className="customer-list-row rounded-[var(--customer-radius)] px-3 py-3 text-sm"
                aria-label={`Weekly plan for ${weeklyPlan.weekStartDate}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    Week of {weeklyPlan.weekStartDate}
                  </span>
                  <Badge
                    tone={
                      weeklyPlan.status === "customer_accepted"
                        ? "success"
                        : weeklyPlan.status === "customer_declined"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {SERVICE_WEEKLY_PLAN_STATUS_LABELS[weeklyPlan.status]}
                  </Badge>
                </div>
                {weeklyPlan.advisorNotes ? (
                  <p className="mt-1 text-[var(--color-stone-600)]">
                    {weeklyPlan.advisorNotes}
                  </p>
                ) : null}
                <ul className="mt-2 space-y-1 text-[var(--color-stone-700)]">
                  {(weeklyPlanDaysByPlan.get(weeklyPlan.id) ?? []).map(
                    (day) => (
                      <li key={day.id}>
                        <span className="font-medium">
                          {SERVICE_WEEKLY_PLAN_DAY_LABELS[day.dayOfWeek]}
                        </span>{" "}
                        ·{" "}
                        {
                          SERVICE_WEEKLY_PLAN_OCCASION_TAG_LABELS[
                            day.occasionTag
                          ]
                        }{" "}
                        — {day.outfitNotes}
                      </li>
                    ),
                  )}
                </ul>
                {canDecideServiceWeeklyPlan(weeklyPlan.status) ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <form action={decideWeeklyPlan}>
                      <input
                        type="hidden"
                        name="planId"
                        value={weeklyPlan.id}
                      />
                      <input type="hidden" name="decision" value="accepted" />
                      <Button type="submit" className="customer-button">
                        Accept this week
                      </Button>
                    </form>
                    <form
                      action={decideWeeklyPlan}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="hidden"
                        name="planId"
                        value={weeklyPlan.id}
                      />
                      <input type="hidden" name="decision" value="declined" />
                      <input
                        name="declineReason"
                        placeholder="Optional reason"
                        maxLength={1000}
                        className="h-11 rounded-[var(--customer-radius)] border border-[var(--customer-border)] bg-white/70 px-3 text-sm"
                      />
                      <Button
                        type="submit"
                        variant="secondary"
                        className="customer-button"
                      >
                        Decline
                      </Button>
                    </form>
                  </div>
                ) : weeklyPlan.declineReason ? (
                  <p className="mt-2 text-[var(--color-stone-600)]">
                    You declined: {weeklyPlan.declineReason}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {membership.status === "active" ? (
        <form
          action={requestConciergeBooking}
          className="paon-reveal grid gap-3 md:grid-cols-[1fr_auto] md:items-end"
        >
          <input type="hidden" name="membershipId" value={membership.id} />
          <input
            type="hidden"
            name="idempotencyKey"
            value={`customer-${membership.id}-${Date.now()}`}
          />
          <label className="flex flex-col gap-1 text-sm">
            Request a visit
            <select
              name="kind"
              required
              className="h-12 rounded-[var(--customer-radius)] border border-[var(--customer-border)] bg-white/70 px-3"
              aria-label="Service booking kind"
            >
              {bookingKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {SERVICE_BOOKING_KIND_LABELS[kind as ServiceBookingKind]}
                  {recommendedAppointmentType(kind as ServiceBookingKind)
                    ? " (may link to appointment)"
                    : ""}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" className="customer-button">
            Request booking
          </Button>
          <div className="md:col-span-2">
            <FormField
              label="Preferred date & time (optional)"
              htmlFor="requestedFor"
              labelledGroup
            >
              <DateTimePicker
                name="requestedFor"
                label="Preferred date & time"
              />
            </FormField>
          </div>
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            Notes
            <textarea
              name="notes"
              maxLength={1000}
              rows={2}
              className="min-h-16 rounded-[var(--customer-radius)] border border-[var(--customer-border)] bg-white/70 px-3 py-3"
            />
          </label>
        </form>
      ) : null}

      <div>
        <h3 className="text-sm font-medium text-[var(--color-stone-900)]">
          Bookings
        </h3>
        <ul className="mt-2 flex flex-col gap-2">
          {bookings.map((booking) => (
            <li
              key={booking.id}
              className="customer-list-row flex flex-wrap items-center justify-between gap-2 rounded-[var(--customer-radius)] px-3 py-3 text-sm"
            >
              <span>
                {SERVICE_BOOKING_KIND_LABELS[booking.kind]}
                {booking.appointmentId ? (
                  <>
                    {" · "}
                    <Link
                      className="underline"
                      href={`/appointments/${booking.appointmentId}`}
                    >
                      Appointment linked
                    </Link>
                  </>
                ) : null}
              </span>
              <Badge tone={STATUS_TONE[booking.status]}>
                {SERVICE_BOOKING_STATUS_LABELS[booking.status]}
              </Badge>
            </li>
          ))}
          {bookings.length === 0 ? (
            <li className="text-sm text-[var(--color-stone-500)]">
              No bookings yet.
            </li>
          ) : null}
        </ul>
      </div>
    </section>
  );
}
