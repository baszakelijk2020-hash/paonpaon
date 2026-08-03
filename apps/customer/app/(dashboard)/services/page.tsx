import {
  CustomerRepository,
  RetailerRepository,
  ServicePlanRepository,
} from "@paon/database";
import {
  BOOKING_KINDS_BY_SERVICE,
  SERVICE_BOOKING_KIND_LABELS,
  SERVICE_BOOKING_STATUS_LABELS,
  SERVICE_ENTITLEMENT_KIND_LABELS,
  SERVICE_KIND_LABELS,
  recommendedAppointmentType,
  type ServiceBooking,
  type ServiceBookingKind,
  type ServiceEntitlement,
  type ServiceKind,
  type ServiceMembership,
  type ServicePlan,
} from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { DateTimePicker } from "@paon/ui/components/DateTimePicker";
import { FormField } from "@paon/ui/components/FormField";
import Link from "next/link";

import { requestConciergeBooking } from "./actions";

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

  const groups = await Promise.all(
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
      const entitlements = await Promise.all(
        memberships.map(async (membership) => ({
          membershipId: membership.id,
          items: await services.listEntitlementsForMembership(membership.id),
        })),
      );
      return {
        customer,
        retailer,
        memberships,
        plansById,
        bookings,
        history,
        entitlementsByMembership: new Map(
          entitlements.map((entry) => [entry.membershipId, entry.items]),
        ),
      };
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
          Preferred Tailoring &amp; HighMaintenance
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Advisor-led wardrobe planning and ongoing care, pressing, repair, and
          collection — without payment on this surface.
        </p>
      </div>

      {groups.every((group) => group.memberships.length === 0) ? (
        <Card className="flex flex-col gap-2">
          <p className="text-sm text-[var(--color-stone-700)]">
            No concierge memberships yet. Your house advisor can open Preferred
            Tailoring or HighMaintenance for you.
          </p>
          <p className="text-sm text-[var(--color-stone-500)]">
            You can still book fittings from{" "}
            <Link className="underline" href="/appointments">
              Appointments
            </Link>
            .
          </p>
        </Card>
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
          },
          index,
        ) =>
          memberships.length === 0 ? null : (
            <Card
              key={customer.id}
              className="paon-reveal flex flex-col gap-5"
              style={{ animationDelay: `${index * 120}ms` }}
            >
              <div>
                <p className="font-accent text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
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
            </Card>
          ),
      )}
    </div>
  );
}

function MembershipPanel({
  membership,
  plan,
  entitlements,
  bookings,
}: {
  membership: ServiceMembership;
  plan: ServicePlan;
  entitlements: readonly ServiceEntitlement[];
  bookings: readonly ServiceBooking[];
}) {
  const bookingKinds = BOOKING_KINDS_BY_SERVICE[plan.kind as ServiceKind];
  return (
    <section
      className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-4 py-3"
      aria-label={`${SERVICE_KIND_LABELS[plan.kind]} membership`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-[var(--color-stone-900)]">
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
              className="rounded border border-[var(--color-stone-100)] px-3 py-2 text-sm"
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
              className="rounded border border-[var(--color-stone-200)] px-3 py-2"
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
          <Button type="submit">Request booking</Button>
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
              className="rounded border border-[var(--color-stone-200)] px-3 py-2"
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
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-[var(--color-stone-100)] px-3 py-2 text-sm"
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
