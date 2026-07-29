import { ConciergeServiceRepository } from "@paon/database";
import {
  bookingStatusLabel,
  CONCIERGE_SERVICE_KIND_LABELS,
  retailerRoleAtLeast,
} from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Button } from "@paon/ui/components/Button";
import { formatDate } from "@paon/utils";
import { notFound } from "next/navigation";

import {
  recordConciergeCost,
  transitionConciergeBooking,
  upsertConciergePlan,
} from "./actions";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function ConciergeServicesSettingsPage() {
  const session = await requireSession();
  if (!retailerRoleAtLeast(session.retailerRole, "manager")) {
    notFound();
  }

  const supabase = await getSupabaseServerClient();
  const repo = new ConciergeServiceRepository(supabase);
  await repo.ensurePlanDefinitions(session.retailerId);
  const [plans, bookings] = await Promise.all([
    repo.listPlanDefinitions(session.retailerId),
    repo.listBookingsByRetailer(session.retailerId),
  ]);

  const openBookings = bookings.filter(
    (booking) =>
      booking.status !== "completed" && booking.status !== "canceled",
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
          Concierge services
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Preferred Tailoring and HighMaintenance plans, operational bookings,
          and recorded costs. Billing is recorded only — no payment collection
          in this slice.
        </p>
      </div>

      <section className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white px-5 py-4">
        <h2 className="font-display text-lg text-[var(--color-stone-900)]">
          Service plans
        </h2>
        <ul className="mt-4 divide-y divide-[var(--color-stone-100)]">
          {plans.map((plan) => (
            <li key={plan.id} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-[var(--color-stone-900)]">
                    {plan.label}
                  </p>
                  <p className="text-sm text-[var(--color-stone-500)]">
                    {CONCIERGE_SERVICE_KIND_LABELS[plan.serviceKind]} ·{" "}
                    {plan.active ? "Active" : "Inactive"}
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-stone-600)]">
                    {plan.summary}
                  </p>
                </div>
                <form action={upsertConciergePlan} className="grid gap-2">
                  <input
                    type="hidden"
                    name="planDefinitionId"
                    value={plan.id}
                  />
                  <input
                    type="hidden"
                    name="serviceKind"
                    value={plan.serviceKind}
                  />
                  <input type="hidden" name="label" value={plan.label} />
                  <input type="hidden" name="summary" value={plan.summary} />
                  <input
                    type="hidden"
                    name="active"
                    value={plan.active ? "false" : "true"}
                  />
                  <Button type="submit" size="sm" variant="outline">
                    {plan.active ? "Deactivate" : "Activate"}
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white px-5 py-4">
        <h2 className="font-display text-lg text-[var(--color-stone-900)]">
          Open bookings
        </h2>
        {openBookings.length === 0 ? (
          <p
            role="status"
            className="mt-4 text-sm text-[var(--color-stone-500)]"
          >
            No open concierge bookings.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-4">
            {openBookings.map((booking) => (
              <li
                key={booking.id}
                className="rounded border border-[var(--color-stone-100)] px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-[var(--color-stone-900)]">
                      {booking.title}
                    </p>
                    <p className="text-xs text-[var(--color-stone-500)]">
                      {CONCIERGE_SERVICE_KIND_LABELS[booking.serviceKind]} ·{" "}
                      {booking.scheduledAt
                        ? formatDate(booking.scheduledAt, "en-US")
                        : "Not scheduled"}
                    </p>
                  </div>
                  <Badge tone="neutral">
                    {bookingStatusLabel(booking.status)}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {booking.status === "requested" ? (
                    <form
                      action={transitionConciergeBooking}
                      className="flex flex-wrap items-end gap-2"
                    >
                      <input
                        type="hidden"
                        name="bookingId"
                        value={booking.id}
                      />
                      <input type="hidden" name="transition" value="schedule" />
                      <label className="text-xs text-[var(--color-stone-600)]">
                        Schedule at
                        <input
                          type="datetime-local"
                          name="scheduledAt"
                          required
                          className="ml-2 rounded border border-[var(--color-stone-200)] px-2 py-1"
                        />
                      </label>
                      <Button type="submit" size="sm">
                        Schedule
                      </Button>
                    </form>
                  ) : null}
                  {booking.status === "scheduled" ? (
                    <form action={transitionConciergeBooking}>
                      <input
                        type="hidden"
                        name="bookingId"
                        value={booking.id}
                      />
                      <input type="hidden" name="transition" value="start" />
                      <Button type="submit" size="sm" variant="outline">
                        Start
                      </Button>
                    </form>
                  ) : null}
                  {booking.status === "in_progress" ? (
                    <form action={transitionConciergeBooking}>
                      <input
                        type="hidden"
                        name="bookingId"
                        value={booking.id}
                      />
                      <input type="hidden" name="transition" value="fulfill" />
                      <Button type="submit" size="sm" variant="outline">
                        Mark fulfilled
                      </Button>
                    </form>
                  ) : null}
                  {booking.status === "fulfilled" ? (
                    <form action={transitionConciergeBooking}>
                      <input
                        type="hidden"
                        name="bookingId"
                        value={booking.id}
                      />
                      <input type="hidden" name="transition" value="complete" />
                      <Button type="submit" size="sm">
                        Complete
                      </Button>
                    </form>
                  ) : null}
                </div>
                <form
                  action={recordConciergeCost}
                  className="mt-3 grid gap-2 md:grid-cols-4"
                >
                  <input type="hidden" name="bookingId" value={booking.id} />
                  <input
                    name="amountMinor"
                    type="number"
                    min={0}
                    placeholder="Cost (minor units)"
                    className="rounded border border-[var(--color-stone-200)] px-2 py-1 text-sm"
                  />
                  <input
                    name="currency"
                    defaultValue="EUR"
                    maxLength={3}
                    className="rounded border border-[var(--color-stone-200)] px-2 py-1 text-sm"
                  />
                  <input
                    name="description"
                    placeholder="Operational cost note"
                    className="rounded border border-[var(--color-stone-200)] px-2 py-1 text-sm md:col-span-2"
                  />
                  <Button type="submit" size="sm" variant="ghost">
                    Record cost
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
