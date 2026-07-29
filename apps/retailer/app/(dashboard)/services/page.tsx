import {
  AppointmentRepository,
  CustomerRepository,
  ServicePlanRepository,
} from "@paon/database";
import {
  BOOKING_KINDS_BY_SERVICE,
  SERVICE_BOOKING_KIND_LABELS,
  SERVICE_BOOKING_STATUS_LABELS,
  SERVICE_CARE_KIND_LABELS,
  SERVICE_CARE_KINDS,
  SERVICE_ENTITLEMENT_KIND_LABELS,
  SERVICE_ENTITLEMENT_KINDS,
  SERVICE_FULFILMENT_METHOD_LABELS,
  SERVICE_FULFILMENT_METHODS,
  SERVICE_KIND_LABELS,
  SERVICE_KINDS,
  canTransitionServiceBooking,
  recommendedAppointmentType,
  retailerRoleAtLeast,
  type ServiceBookingStatus,
  type ServiceKind,
} from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Button } from "@paon/ui/components/Button";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  enrollServiceMembership,
  grantEntitlement,
  linkAppointment,
  recordCare,
  recordCost,
  recordFulfilment,
  requestBooking,
  setMembershipStatus,
  setServicePlanStatus,
  transitionBooking,
  upsertServicePlan,
} from "./actions";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const NEXT_STATUSES: ServiceBookingStatus[] = [
  "confirmed",
  "in_progress",
  "fulfilled",
  "canceled",
];

export default async function RetailerServicesPage() {
  const session = await requireSession();
  if (!retailerRoleAtLeast(session.retailerRole, "sales_associate")) {
    notFound();
  }
  const canManage = retailerRoleAtLeast(session.retailerRole, "manager");
  const client = await getSupabaseServerClient();
  const services = new ServicePlanRepository(client);
  const [plans, memberships, bookings, customers] = await Promise.all([
    services.listPlansByRetailer(session.retailerId),
    services.listMembershipsByRetailer(session.retailerId),
    services.listBookingsByRetailer(session.retailerId),
    new CustomerRepository(client).findByRetailer(session.retailerId as never),
  ]);
  const appointments = await new AppointmentRepository(client).findByRetailer(
    session.retailerId as never,
  );
  const openAppointments = appointments.filter(
    (appointment) =>
      appointment.status === "requested" || appointment.status === "confirmed",
  );

  const membershipDetails = await Promise.all(
    memberships.slice(0, 40).map(async (membership) => ({
      membership,
      plan: plans.find((plan) => plan.id === membership.planId),
      entitlements: await services.listEntitlementsForMembership(membership.id),
      care: await services.listCareForMembership(membership.id),
      costs: await services.listCostsForMembership(membership.id),
      history: await services.listHistoryForMembership(membership.id),
    })),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
          Preferred Tailoring &amp; HighMaintenance
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Concierge plans, non-monetary credits, bookings, fulfilment, care, and
          operational cost recording. Compose appointments and alterations —
          payment stays behind ADR-062.
        </p>
      </div>

      {canManage ? (
        <section className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white px-5 py-4">
          <h2 className="font-display text-lg text-[var(--color-stone-900)]">
            Create service plan
          </h2>
          <form
            action={upsertServicePlan}
            className="mt-4 grid gap-3 md:grid-cols-2"
          >
            <label className="flex flex-col gap-1 text-sm">
              Kind
              <select
                name="kind"
                required
                className="rounded border border-[var(--color-stone-200)] px-3 py-2"
              >
                {SERVICE_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {SERVICE_KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Status
              <select
                name="status"
                defaultValue="draft"
                className="rounded border border-[var(--color-stone-200)] px-3 py-2"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              Title
              <input
                name="title"
                required
                maxLength={120}
                className="rounded border border-[var(--color-stone-200)] px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              Summary
              <textarea
                name="summary"
                required
                maxLength={500}
                rows={2}
                className="rounded border border-[var(--color-stone-200)] px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              Explanation
              <textarea
                name="explanation"
                required
                maxLength={500}
                rows={2}
                className="rounded border border-[var(--color-stone-200)] px-3 py-2"
              />
            </label>
            <Button type="submit" className="md:col-span-2">
              Save plan
            </Button>
          </form>
        </section>
      ) : null}

      <section className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white px-5 py-4">
        <h2 className="font-display text-lg text-[var(--color-stone-900)]">
          Plans
        </h2>
        <ul className="mt-3 flex flex-col gap-3">
          {plans.map((plan) => (
            <li
              key={plan.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-stone-100)] pb-3"
            >
              <div>
                <p className="font-medium text-[var(--color-stone-900)]">
                  {SERVICE_KIND_LABELS[plan.kind]} · {plan.title}
                </p>
                <p className="text-sm text-[var(--color-stone-500)]">
                  {plan.summary}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={plan.status === "active" ? "success" : "neutral"}>
                  {plan.status}
                </Badge>
                {canManage && plan.status !== "active" ? (
                  <form action={setServicePlanStatus}>
                    <input type="hidden" name="planId" value={plan.id} />
                    <input type="hidden" name="status" value="active" />
                    <Button type="submit" variant="secondary">
                      Activate
                    </Button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
          {plans.length === 0 ? (
            <li className="text-sm text-[var(--color-stone-500)]">
              No service plans yet.
            </li>
          ) : null}
        </ul>
      </section>

      <section className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white px-5 py-4">
        <h2 className="font-display text-lg text-[var(--color-stone-900)]">
          Enroll client
        </h2>
        <form
          action={enrollServiceMembership}
          className="mt-4 grid gap-3 md:grid-cols-2"
        >
          <label className="flex flex-col gap-1 text-sm">
            Plan
            <select
              name="planId"
              required
              className="rounded border border-[var(--color-stone-200)] px-3 py-2"
            >
              {plans
                .filter((plan) => plan.status === "active")
                .map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {SERVICE_KIND_LABELS[plan.kind]} · {plan.title}
                  </option>
                ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Client
            <select
              name="customerId"
              required
              className="rounded border border-[var(--color-stone-200)] px-3 py-2"
            >
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.fullName}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            Commitment notes
            <textarea
              name="commitmentNotes"
              maxLength={1000}
              rows={2}
              className="rounded border border-[var(--color-stone-200)] px-3 py-2"
              placeholder="Agenda, travel, dress codes, collection cadence…"
            />
          </label>
          <Button type="submit" className="md:col-span-2">
            Open membership with default credits
          </Button>
        </form>
      </section>

      <section className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white px-5 py-4">
        <h2 className="font-display text-lg text-[var(--color-stone-900)]">
          Open bookings
        </h2>
        <ul className="mt-3 flex flex-col gap-4">
          {bookings.map((booking) => {
            const next = NEXT_STATUSES.filter((status) =>
              canTransitionServiceBooking(booking.status, status),
            );
            const suggested = recommendedAppointmentType(booking.kind);
            const linkable = openAppointments.filter(
              (appointment) =>
                appointment.customerId === booking.customerId &&
                (!suggested || appointment.type === suggested),
            );
            return (
              <li
                key={booking.id}
                className="rounded border border-[var(--color-stone-100)] px-3 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {SERVICE_BOOKING_KIND_LABELS[booking.kind]}
                  </p>
                  <Badge
                    tone={
                      booking.status === "fulfilled" ? "success" : "neutral"
                    }
                  >
                    {SERVICE_BOOKING_STATUS_LABELS[booking.status]}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {next.map((status) => (
                    <form key={status} action={transitionBooking}>
                      <input
                        type="hidden"
                        name="bookingId"
                        value={booking.id}
                      />
                      <input type="hidden" name="status" value={status} />
                      <Button type="submit" variant="secondary">
                        Mark {SERVICE_BOOKING_STATUS_LABELS[status]}
                      </Button>
                    </form>
                  ))}
                </div>
                {booking.appointmentId ? (
                  <p className="mt-2 text-sm text-[var(--color-stone-500)]">
                    Linked appointment{" "}
                    <Link
                      className="underline"
                      href={`/appointments/${booking.appointmentId}`}
                    >
                      {booking.appointmentId.slice(0, 8)}
                    </Link>
                  </p>
                ) : linkable.length > 0 ? (
                  <form
                    action={linkAppointment}
                    className="mt-2 flex flex-wrap items-end gap-2"
                  >
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <label className="flex flex-col gap-1 text-sm">
                      Link appointment
                      <select
                        name="appointmentId"
                        required
                        className="rounded border border-[var(--color-stone-200)] px-3 py-2"
                      >
                        {linkable.map((appointment) => (
                          <option key={appointment.id} value={appointment.id}>
                            {appointment.type} ·{" "}
                            {new Date(appointment.startsAt).toLocaleString()}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Button type="submit" variant="secondary">
                      Link
                    </Button>
                  </form>
                ) : null}
                {(booking.kind === "collection" ||
                  booking.kind === "delivery" ||
                  booking.kind === "pressing" ||
                  booking.kind === "cleaning") && (
                  <form
                    action={recordFulfilment}
                    className="mt-2 flex flex-wrap items-end gap-2"
                  >
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <label className="flex flex-col gap-1 text-sm">
                      Fulfilment
                      <select
                        name="method"
                        required
                        className="rounded border border-[var(--color-stone-200)] px-3 py-2"
                      >
                        {SERVICE_FULFILMENT_METHODS.map((method) => (
                          <option key={method} value={method}>
                            {SERVICE_FULFILMENT_METHOD_LABELS[method]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <input type="hidden" name="status" value="scheduled" />
                    <Button type="submit" variant="secondary">
                      Record fulfilment
                    </Button>
                  </form>
                )}
              </li>
            );
          })}
          {bookings.length === 0 ? (
            <li className="text-sm text-[var(--color-stone-500)]">
              No bookings yet.
            </li>
          ) : null}
        </ul>
      </section>

      {membershipDetails.map(
        ({ membership, plan, entitlements, care, costs, history }) => {
          if (!plan) return null;
          const bookingKinds =
            BOOKING_KINDS_BY_SERVICE[plan.kind as ServiceKind];
          return (
            <section
              key={membership.id}
              className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white px-5 py-4"
              aria-label={`${SERVICE_KIND_LABELS[plan.kind]} membership`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg text-[var(--color-stone-900)]">
                    {SERVICE_KIND_LABELS[plan.kind]}
                  </h2>
                  <p className="text-sm text-[var(--color-stone-500)]">
                    Client {membership.customerId.slice(0, 8)} · plan{" "}
                    {plan.title}
                  </p>
                </div>
                <form action={setMembershipStatus} className="flex gap-2">
                  <input
                    type="hidden"
                    name="membershipId"
                    value={membership.id}
                  />
                  <select
                    name="status"
                    defaultValue={membership.status}
                    className="rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm"
                  >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="ended">Ended</option>
                  </select>
                  <Button type="submit" variant="secondary">
                    Update
                  </Button>
                </form>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div>
                  <h3 className="text-sm font-medium">Credits</h3>
                  <ul className="mt-2 space-y-1 text-sm">
                    {entitlements.map((item) => (
                      <li key={item.id}>
                        {SERVICE_ENTITLEMENT_KIND_LABELS[item.kind]}:{" "}
                        {item.remainingQuantity}
                      </li>
                    ))}
                  </ul>
                  <form action={grantEntitlement} className="mt-3 grid gap-2">
                    <input
                      type="hidden"
                      name="membershipId"
                      value={membership.id}
                    />
                    <select
                      name="kind"
                      className="rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm"
                    >
                      {SERVICE_ENTITLEMENT_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {SERVICE_ENTITLEMENT_KIND_LABELS[kind]}
                        </option>
                      ))}
                    </select>
                    <input
                      name="quantity"
                      type="number"
                      min={1}
                      max={100}
                      defaultValue={1}
                      className="rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm"
                    />
                    <Button type="submit" variant="secondary">
                      Grant credit
                    </Button>
                  </form>
                </div>

                <div>
                  <h3 className="text-sm font-medium">Book for client</h3>
                  <form action={requestBooking} className="mt-2 grid gap-2">
                    <input
                      type="hidden"
                      name="membershipId"
                      value={membership.id}
                    />
                    <select
                      name="kind"
                      className="rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm"
                    >
                      {bookingKinds.map((kind) => (
                        <option key={kind} value={kind}>
                          {SERVICE_BOOKING_KIND_LABELS[kind]}
                        </option>
                      ))}
                    </select>
                    <Button type="submit" variant="secondary">
                      Request booking
                    </Button>
                  </form>
                </div>

                <div>
                  <h3 className="text-sm font-medium">Care / repair</h3>
                  <form action={recordCare} className="mt-2 grid gap-2">
                    <input
                      type="hidden"
                      name="membershipId"
                      value={membership.id}
                    />
                    <select
                      name="careKind"
                      className="rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm"
                    >
                      {SERVICE_CARE_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {SERVICE_CARE_KIND_LABELS[kind]}
                        </option>
                      ))}
                    </select>
                    <input
                      name="summary"
                      required
                      maxLength={500}
                      placeholder="What was done"
                      className="rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm"
                    />
                    <input
                      name="alterationId"
                      placeholder="Optional alteration work order UUID"
                      className="rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm"
                    />
                    <Button type="submit" variant="secondary">
                      Record care
                    </Button>
                  </form>
                  <ul className="mt-2 space-y-1 text-sm text-[var(--color-stone-600)]">
                    {care.slice(0, 5).map((record) => (
                      <li key={record.id}>
                        {SERVICE_CARE_KIND_LABELS[record.careKind]}:{" "}
                        {record.summary}
                        {record.alterationId ? (
                          <>
                            {" · "}
                            <Link
                              className="underline"
                              href={`/alterations/${record.alterationId}`}
                            >
                              alteration
                            </Link>
                          </>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-medium">
                    Operational cost (not payment)
                  </h3>
                  <form action={recordCost} className="mt-2 grid gap-2">
                    <input
                      type="hidden"
                      name="membershipId"
                      value={membership.id}
                    />
                    <input
                      name="label"
                      required
                      maxLength={120}
                      placeholder="Pressing labour"
                      className="rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm"
                    />
                    <input
                      name="amountMinorUnits"
                      type="number"
                      min={0}
                      required
                      placeholder="Cents"
                      className="rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm"
                    />
                    <select
                      name="currency"
                      defaultValue="EUR"
                      className="rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm"
                    >
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="USD">USD</option>
                    </select>
                    <Button type="submit" variant="secondary">
                      Record cost
                    </Button>
                  </form>
                  <ul className="mt-2 space-y-1 text-sm text-[var(--color-stone-600)]">
                    {costs.slice(0, 5).map((record) => (
                      <li key={record.id}>
                        {record.label}:{" "}
                        {(record.amountMinorUnits / 100).toFixed(2)}{" "}
                        {record.currency}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {history.length > 0 ? (
                <div className="mt-4">
                  <h3 className="text-sm font-medium">Audit history</h3>
                  <ul className="mt-2 space-y-1 text-sm text-[var(--color-stone-600)]">
                    {history.slice(0, 8).map((event) => (
                      <li key={event.id}>
                        {new Date(event.createdAt).toLocaleString()} —{" "}
                        {event.summary}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          );
        },
      )}
    </div>
  );
}
