import { CustomerRepository, EventRepository } from "@paon/database";
import { EVENT_RSVP_STATUS_LABELS } from "@paon/domain";
import { formatDate } from "@paon/utils";
import { notFound } from "next/navigation";

import { PrintButton } from "../../../alterations/[id]/print/print-button";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * A printable door list — same shape as the appointment brief and order
 * pack print packs (deliberately outside `(dashboard)`, no sidebar
 * chrome), for stores checking guests in on paper rather than a screen.
 */
export default async function EventPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const supabase = await getSupabaseServerClient();

  const repository = new EventRepository(supabase);
  const event = await repository.findById(id as never);
  if (!event || event.retailerId !== session.retailerId) {
    notFound();
  }

  const [rsvps, customers] = await Promise.all([
    repository.findRsvps(event.id),
    new CustomerRepository(supabase).findByRetailer(session.retailerId),
  ]);
  const customerById = new Map(
    customers.map((customer) => [customer.id, customer]),
  );
  const sortedRsvps = [...rsvps].sort((a, b) =>
    (customerById.get(a.customerId)?.fullName ?? "").localeCompare(
      customerById.get(b.customerId)?.fullName ?? "",
    ),
  );

  return (
    <div className="min-h-screen bg-white text-[#1a1a1a] print:min-h-0">
      <div className="mx-auto max-w-2xl px-8 py-10 print:max-w-none print:px-0 print:py-0">
        <div className="mb-6 flex justify-end print:hidden">
          <PrintButton />
        </div>

        <header className="flex items-start justify-between border-b-2 border-[#1a1a1a] pb-4">
          <div>
            <p className="font-accent text-xs uppercase tracking-[0.24em] text-[#1a1a1a]/60">
              PAON · Guest list
            </p>
            <h1 className="font-display mt-1 text-3xl leading-none">
              {event.name}
            </h1>
          </div>
          <div className="text-right">
            <p className="text-lg font-medium">
              {formatDate(event.startsAt, "en-US")}
            </p>
            <p className="text-sm text-[#1a1a1a]/70">{event.venueName}</p>
          </div>
        </header>

        <section className="mt-6 border-t border-[#1a1a1a]/15 pt-4">
          <h2 className="text-sm font-medium uppercase tracking-[0.1em]">
            Guests ({sortedRsvps.length})
          </h2>
          <div className="mt-2 flex flex-col">
            {sortedRsvps.map((rsvp) => (
              <div
                key={rsvp.customerId}
                className="flex items-center justify-between gap-3 border-b border-[#1a1a1a]/10 py-2 text-sm"
              >
                <span>
                  {customerById.get(rsvp.customerId)?.fullName ?? "Guest"}
                </span>
                <span className="text-[#1a1a1a]/60">
                  {EVENT_RSVP_STATUS_LABELS[rsvp.status]}
                </span>
                <span className="w-24 border-b border-[#1a1a1a]/40" />
              </div>
            ))}
            {sortedRsvps.length === 0 ? (
              <p className="py-3 text-sm text-[#1a1a1a]/60">
                No responses yet.
              </p>
            ) : null}
          </div>
        </section>

        <footer className="mt-10 flex items-center justify-between border-t border-[#1a1a1a]/15 pt-4 text-xs text-[#1a1a1a]/50">
          <span>Printed {formatDate(new Date().toISOString(), "en-US")}</span>
          <span className="font-mono tracking-[0.2em]">{event.id}</span>
        </footer>
      </div>
    </div>
  );
}
