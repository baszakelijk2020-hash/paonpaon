import {
  CustomerRepository,
  EventRepository,
  RetailerRepository,
} from "@paon/database";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function MyEventsPage() {
  const session = await requireSession();
  const client = await getSupabaseServerClient();
  const customers = await new CustomerRepository(client).findByUserId(
    session.userId,
  );
  const eventRepository = new EventRepository(client);
  const retailerRepository = new RetailerRepository(client);
  const rows = (
    await Promise.all(
      customers.map(async (customer) => {
        const [rsvps, retailer] = await Promise.all([
          eventRepository.findByCustomer(customer.id),
          retailerRepository.findById(customer.retailerId),
        ]);
        return Promise.all(
          rsvps.map(async (rsvp) => ({
            rsvp,
            event: await eventRepository.findById(rsvp.eventId),
            retailer,
          })),
        );
      }),
    )
  ).flat();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
          Invitations
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Events you have been invited to, and your responses.
        </p>
      </div>
      {rows.map(({ rsvp, event, retailer }) =>
        event ? (
          <Card key={`${rsvp.eventId}-${rsvp.customerId}`}>
            <p className="text-sm text-[var(--color-stone-500)]">
              {retailer?.displayName} · {formatDate(event.startsAt, "en-US")}
            </p>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="min-w-0 text-lg font-medium">{event.name}</h2>
              <span className="shrink-0 capitalize">{rsvp.status}</span>
            </div>
            <p className="mt-2 text-sm">{event.venueName}</p>
          </Card>
        ) : null,
      )}
      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--color-stone-500)]">
            No event responses yet.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
