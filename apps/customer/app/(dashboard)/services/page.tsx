import {
  ConciergeServiceRepository,
  CustomerRepository,
  RetailerRepository,
} from "@paon/database";
import {
  asId,
  bookingStatusLabel,
  CONCIERGE_SERVICE_KIND_LABELS,
  operationsForServiceKind,
  type ConciergeEntitlement,
  type ConciergeServiceEnrollment,
  money,
  type CurrencyCode,
} from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Button } from "@paon/ui/components/Button";
import { formatDate, formatMoney } from "@paon/utils";

import {
  cancelConciergeBooking,
  completeConciergeBooking,
  requestConciergeBooking,
} from "./actions";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

function entitlementSummary(entitlements: ConciergeEntitlement[]): string {
  if (entitlements.length === 0) return "No entitlements configured.";
  return entitlements
    .map(
      (ent) =>
        `${ent.label}: ${ent.allowance - ent.consumed} of ${ent.allowance} remaining`,
    )
    .join(" · ");
}

export default async function ServicesPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const repo = new ConciergeServiceRepository(supabase);
  const retailerRepo = new RetailerRepository(supabase);

  const groups = await Promise.all(
    customers.map(async (customer) => {
      const customerId = asId<"CustomerId">(customer.id);
      const [retailer, enrollments, bookings] = await Promise.all([
        retailerRepo.findById(customer.retailerId),
        repo.listEnrollmentsByCustomer(customer.id),
        repo.listBookingsByCustomer(customer.id),
      ]);
      const activeEnrollments = enrollments.filter(
        (enrollment) => enrollment.status === "active",
      );
      const entitlementsByEnrollment = await Promise.all(
        activeEnrollments.map(async (enrollment) => ({
          enrollment,
          entitlements: await repo.listEntitlementsForEnrollment(enrollment.id),
        })),
      );
      const bookingsWithDetails = await Promise.all(
        bookings.map(async (booking) => ({
          booking,
          items: await repo.listBookingItems(booking.id),
          history: await repo.listStatusHistory(booking.id),
          costs: await repo.listCostRecords(booking.id),
        })),
      );
      return {
        retailer,
        customerId,
        entitlementsByEnrollment,
        bookingsWithDetails,
      };
    }),
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
          Concierge services
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Preferred Tailoring wardrobe planning and HighMaintenance care —
          bookings, commitments, and service history without leaving your house
          relationship.
        </p>
      </div>

      {groups.length === 0 ? (
        <p role="status" className="text-sm text-[var(--color-stone-500)]">
          Link a retailer relationship to access concierge services.
        </p>
      ) : (
        groups.map(
          ({
            retailer,
            customerId,
            entitlementsByEnrollment,
            bookingsWithDetails,
          }) => (
            <section
              key={customerId}
              className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white px-5 py-4"
            >
              <h2 className="font-display text-xl text-[var(--color-stone-900)]">
                {retailer?.displayName ?? "Your house"}
              </h2>

              {entitlementsByEnrollment.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--color-stone-500)]">
                  No active concierge plan yet. Your advisor can enroll you in
                  Preferred Tailoring or HighMaintenance.
                </p>
              ) : (
                entitlementsByEnrollment.map(({ enrollment, entitlements }) => (
                  <EnrollmentPanel
                    key={enrollment.id}
                    enrollment={enrollment}
                    entitlements={entitlements}
                  />
                ))
              )}

              <div className="mt-6">
                <h3 className="text-sm font-medium text-[var(--color-stone-900)]">
                  Service history
                </h3>
                {bookingsWithDetails.length === 0 ? (
                  <p className="mt-2 text-sm text-[var(--color-stone-500)]">
                    No bookings yet.
                  </p>
                ) : (
                  <ul className="mt-3 flex flex-col gap-3">
                    {bookingsWithDetails.map(
                      ({ booking, items, history, costs }) => (
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
                                {
                                  CONCIERGE_SERVICE_KIND_LABELS[
                                    booking.serviceKind
                                  ]
                                }
                                {booking.scheduledAt
                                  ? ` · ${formatDate(booking.scheduledAt, "en-US")}`
                                  : ""}
                              </p>
                            </div>
                            <Badge tone="neutral">
                              {bookingStatusLabel(booking.status)}
                            </Badge>
                          </div>
                          {items.length > 0 ? (
                            <ul className="mt-2 text-sm text-[var(--color-stone-600)]">
                              {items.map((item) => (
                                <li key={item.id}>{item.label}</li>
                              ))}
                            </ul>
                          ) : null}
                          {costs.length > 0 ? (
                            <ul className="mt-2 text-xs text-[var(--color-stone-500)]">
                              {costs.map((cost) => (
                                <li key={cost.id}>
                                  Recorded cost:{" "}
                                  {formatMoney(
                                    money(
                                      cost.amountMinor,
                                      cost.currency as CurrencyCode,
                                    ),
                                    "en-US",
                                  )}{" "}
                                  — {cost.description}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          {history.length > 0 ? (
                            <p className="mt-2 text-xs text-[var(--color-stone-400)]">
                              Last update:{" "}
                              {bookingStatusLabel(
                                history[history.length - 1]?.toStatus ??
                                  booking.status,
                              )}{" "}
                              ·{" "}
                              {formatDate(
                                history[history.length - 1]?.recordedAt ??
                                  booking.updatedAt,
                                "en-US",
                              )}
                            </p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {booking.status === "fulfilled" ? (
                              <form action={completeConciergeBooking}>
                                <input
                                  type="hidden"
                                  name="bookingId"
                                  value={booking.id}
                                />
                                <Button type="submit" size="sm">
                                  Acknowledge complete
                                </Button>
                              </form>
                            ) : null}
                            {booking.status === "requested" ||
                            booking.status === "scheduled" ? (
                              <form action={cancelConciergeBooking}>
                                <input
                                  type="hidden"
                                  name="bookingId"
                                  value={booking.id}
                                />
                                <Button type="submit" size="sm" variant="ghost">
                                  Cancel request
                                </Button>
                              </form>
                            ) : null}
                          </div>
                        </li>
                      ),
                    )}
                  </ul>
                )}
              </div>
            </section>
          ),
        )
      )}
    </div>
  );
}

function EnrollmentPanel({
  enrollment,
  entitlements,
}: {
  enrollment: ConciergeServiceEnrollment;
  entitlements: ConciergeEntitlement[];
}) {
  const operations = operationsForServiceKind(enrollment.serviceKind);
  const defaultOp = operations[0];
  const operationsJson = JSON.stringify([
    {
      operationKind: defaultOp,
    },
  ]);

  return (
    <div className="mt-4 rounded border border-[var(--color-stone-100)] px-4 py-3">
      <p className="font-medium text-[var(--color-stone-900)]">
        {CONCIERGE_SERVICE_KIND_LABELS[enrollment.serviceKind]}
      </p>
      <p className="mt-1 text-sm text-[var(--color-stone-500)]">
        {entitlementSummary(entitlements)}
      </p>
      {enrollment.commitmentNote ? (
        <p className="mt-2 text-sm text-[var(--color-stone-600)]">
          {enrollment.commitmentNote}
        </p>
      ) : null}
      <form
        action={requestConciergeBooking}
        className="mt-3 grid gap-2 md:grid-cols-2"
      >
        <input type="hidden" name="enrollmentId" value={enrollment.id} />
        <input type="hidden" name="operations" value={operationsJson} />
        <label className="text-sm">
          Request
          <input
            name="title"
            required
            defaultValue={
              enrollment.serviceKind === "preferred_tailoring"
                ? "Planning session"
                : "Care visit"
            }
            className="mt-1 w-full rounded border border-[var(--color-stone-200)] px-3 py-2"
          />
        </label>
        <label className="text-sm">
          Notes (optional)
          <input
            name="notes"
            className="mt-1 w-full rounded border border-[var(--color-stone-200)] px-3 py-2"
          />
        </label>
        <div className="md:col-span-2">
          <Button type="submit" size="sm">
            Request service
          </Button>
        </div>
      </form>
    </div>
  );
}
