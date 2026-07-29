import type {
  ConciergeEntitlement,
  ConciergePlanDefinition,
  ConciergeServiceBooking,
  ConciergeServiceEnrollment,
} from "@paon/domain";
import {
  bookingStatusLabel,
  CONCIERGE_SERVICE_KIND_LABELS,
} from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";

import { enrollConciergeCustomer } from "../../settings/services/actions";

export function CustomerConciergeCard({
  customerId,
  staffId,
  plans,
  enrollments,
  bookings,
  entitlementsByEnrollment,
}: {
  customerId: string;
  staffId: string;
  plans: ConciergePlanDefinition[];
  enrollments: ConciergeServiceEnrollment[];
  bookings: ConciergeServiceBooking[];
  entitlementsByEnrollment: Map<string, ConciergeEntitlement[]>;
}) {
  const activePlans = plans.filter((plan) => plan.active);
  const openBookings = bookings.filter(
    (booking) =>
      booking.status !== "completed" && booking.status !== "canceled",
  );

  return (
    <Card>
      <div className="mb-4">
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Concierge services
        </h2>
        <p className="text-sm text-[var(--color-stone-500)]">
          Preferred Tailoring planning and HighMaintenance care with advisor
          ownership.
        </p>
      </div>

      {enrollments.length === 0 ? (
        <div>
          <p className="text-sm text-[var(--color-stone-500)]">
            No concierge enrollment yet.
          </p>
          {activePlans.length > 0 ? (
            <form
              action={enrollConciergeCustomer}
              className="mt-3 grid gap-2 md:grid-cols-2"
            >
              <input type="hidden" name="customerId" value={customerId} />
              <input type="hidden" name="advisorStaffId" value={staffId} />
              <label className="text-sm">
                Enroll in
                <select
                  name="planDefinitionId"
                  required
                  className="mt-1 w-full rounded border border-[var(--color-stone-200)] px-3 py-2"
                >
                  {activePlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Commitment note
                <input
                  name="commitmentNote"
                  placeholder="Season plan, travel rhythm, care expectations"
                  className="mt-1 w-full rounded border border-[var(--color-stone-200)] px-3 py-2"
                />
              </label>
              <div className="md:col-span-2">
                <Button type="submit" size="sm">
                  Enroll client
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {enrollments.map((enrollment) => {
            const entitlements =
              entitlementsByEnrollment.get(enrollment.id) ?? [];
            return (
              <li
                key={enrollment.id}
                className="rounded border border-[var(--color-stone-100)] px-3 py-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[var(--color-stone-900)]">
                    {CONCIERGE_SERVICE_KIND_LABELS[enrollment.serviceKind]}
                  </p>
                  <Badge tone="neutral">{enrollment.status}</Badge>
                </div>
                {enrollment.commitmentNote ? (
                  <p className="mt-1 text-xs text-[var(--color-stone-500)]">
                    {enrollment.commitmentNote}
                  </p>
                ) : null}
                {entitlements.length > 0 ? (
                  <ul className="mt-2 text-xs text-[var(--color-stone-500)]">
                    {entitlements.map((ent) => (
                      <li key={ent.id}>
                        {ent.label}: {ent.allowance - ent.consumed}/
                        {ent.allowance} remaining
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {openBookings.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-[var(--color-stone-900)]">
            Open bookings
          </h3>
          <ul className="mt-2 flex flex-col gap-2">
            {openBookings.slice(0, 5).map((booking) => (
              <li
                key={booking.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span>{booking.title}</span>
                <span className="text-xs text-[var(--color-stone-500)]">
                  {bookingStatusLabel(booking.status)}
                  {booking.scheduledAt
                    ? ` · ${formatDate(booking.scheduledAt, "en-US")}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
