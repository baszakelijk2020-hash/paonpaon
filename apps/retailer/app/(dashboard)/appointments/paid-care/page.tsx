import { CustomerRepository, PaidCareBookingRepository } from "@paon/database";
import {
  PAID_CARE_BOOKING_STATUSES,
  PAID_CARE_FULFILMENT_METHOD_LABELS,
  PAID_CARE_SERVICE_KIND_LABELS,
} from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";

import { updatePaidCareStatus } from "./actions";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const WHEN = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function money(minorUnits?: number, currency?: string): string | null {
  if (minorUnits === undefined) return null;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency ?? "EUR",
  }).format(minorUnits / 100);
}

/**
 * Paid care — dry cleaning, repairs, alterations a customer books from their
 * own appointments tab.
 *
 * These live in `paid_care_bookings`, not `appointments`, and nothing in this
 * app read that table: a customer could book and pay for a repair and no
 * member of staff would ever see it. The staff RLS policies were already in
 * place; this is the screen that uses them.
 */
export default async function PaidCarePage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  const bookings = await new PaidCareBookingRepository(supabase).findByRetailer(
    session.retailerId,
  );

  const customerRepo = new CustomerRepository(supabase);
  const customers = await Promise.all(
    [...new Set(bookings.map((booking) => booking.customerId))].map((id) =>
      customerRepo.findById(id),
    ),
  );
  const customerNameById = new Map(
    customers
      .filter((customer): customer is NonNullable<typeof customer> =>
        Boolean(customer),
      )
      .map((customer) => [customer.id as string, customer.fullName]),
  );

  const open = bookings.filter(
    (booking) => !["fulfilled", "canceled"].includes(booking.status),
  );
  const closed = bookings.filter((booking) =>
    ["fulfilled", "canceled"].includes(booking.status),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Paid care
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Cleaning, repairs and alterations customers booked themselves ·{" "}
          {open.length} open
        </p>
      </div>

      {bookings.length === 0 ? (
        <Card className="p-6">
          <p className="text-sm text-[var(--color-stone-500)]">
            No paid-care bookings yet.
          </p>
        </Card>
      ) : (
        <Card className="p-6">
          <ul className="flex flex-col divide-y divide-[var(--color-stone-100)]">
            {[...open, ...closed].map((booking) => {
              const total = money(
                booking.totalAmountMinorUnits,
                booking.currency,
              );
              return (
                <li key={booking.id} className="flex flex-col gap-2 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-[var(--color-stone-900)]">
                      {PAID_CARE_SERVICE_KIND_LABELS[booking.serviceKind]}
                      {booking.quantity > 1
                        ? ` ×${booking.quantity}`
                        : ""} ·{" "}
                      {customerNameById.get(booking.customerId as string) ??
                        "Customer"}
                    </p>
                    <p className="text-xs text-[var(--color-stone-500)]">
                      {WHEN.format(new Date(booking.createdAt))}
                      {total ? ` · ${total}` : ""} · {booking.paymentStatus}
                    </p>
                  </div>

                  <p className="text-sm text-[var(--color-stone-600)]">
                    {booking.garmentDescription}
                  </p>

                  <p className="text-xs text-[var(--color-stone-500)]">
                    Pickup{" "}
                    {PAID_CARE_FULFILMENT_METHOD_LABELS[booking.pickupMethod]} ·
                    Return{" "}
                    {PAID_CARE_FULFILMENT_METHOD_LABELS[booking.returnMethod]}
                    {booking.preferredWindow
                      ? ` · Prefers ${booking.preferredWindow}`
                      : ""}
                  </p>
                  {booking.notes ? (
                    <p className="text-xs text-[var(--color-stone-500)]">
                      {booking.notes}
                    </p>
                  ) : null}

                  <form
                    action={updatePaidCareStatus}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <input
                      type="hidden"
                      name="bookingId"
                      value={booking.id as string}
                    />
                    <select
                      name="status"
                      defaultValue={booking.status}
                      className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-2 py-1 text-xs"
                    >
                      {PAID_CARE_BOOKING_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                    <Button type="submit" variant="ghost" size="sm">
                      Update
                    </Button>
                  </form>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
