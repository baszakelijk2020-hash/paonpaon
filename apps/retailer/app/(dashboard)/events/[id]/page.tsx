import { requireRetailerRole } from "@paon/auth";
import { CustomerRepository, EventRepository } from "@paon/database";
import { EVENT_VISIBILITY_LABELS } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Button, buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { formatDate, humaniseStatus } from "@paon/utils";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { checkInGuest, updateEventStatus } from "../actions";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  try {
    requireRetailerRole(session.retailerRole, "manager");
  } catch {
    redirect("/dashboard");
  }
  const { id } = await params;
  const client = await getSupabaseServerClient();
  const repository = new EventRepository(client);
  const event = await repository.findById(id as never);
  if (!event || event.retailerId !== session.retailerId) notFound();
  const [rsvps, customers] = await Promise.all([
    repository.findRsvps(event.id),
    new CustomerRepository(client).findByRetailer(session.retailerId),
  ]);
  const names = new Map(
    customers.map((customer) => [customer.id, customer.fullName]),
  );
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm uppercase tracking-wide text-[var(--color-stone-500)]">
          {humaniseStatus(event.status)}
        </p>
        <h1 className="font-display text-2xl">{event.name}</h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          {formatDate(event.startsAt, "en-US")} · {event.venueName}
        </p>
      </div>
      <Card>
        <p>{event.description}</p>
        <p className="mt-3 text-sm capitalize text-[var(--color-stone-500)]">
          {EVENT_VISIBILITY_LABELS[event.visibility]} ·{" "}
          {event.capacity ? `${event.capacity} places` : "No capacity limit"}
        </p>
        <div className="mt-5 flex gap-2">
          {event.status === "draft" ? (
            <form action={updateEventStatus}>
              <input type="hidden" name="eventId" value={event.id} />
              <input type="hidden" name="status" value="published" />
              <Button type="submit">Publish</Button>
            </form>
          ) : null}
          {event.status === "published" ? (
            <form action={updateEventStatus}>
              <input type="hidden" name="eventId" value={event.id} />
              <input type="hidden" name="status" value="cancelled" />
              <Button type="submit" variant="destructive">
                Cancel event
              </Button>
            </form>
          ) : null}
        </div>
      </Card>
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium">
            Guests ({rsvps.filter((item) => item.status === "attending").length}{" "}
            attending)
          </h2>
          <Link
            href={`/events/${event.id}/print`}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Print guest list
          </Link>
        </div>
        {rsvps.map((rsvp) => (
          <div
            key={rsvp.customerId}
            className="flex items-center justify-between gap-3 border-t py-3"
          >
            <span>{names.get(rsvp.customerId) ?? "Customer"}</span>
            <div className="flex items-center gap-2">
              <Badge tone={rsvp.status === "attended" ? "success" : "neutral"}>
                {humaniseStatus(rsvp.status)}
              </Badge>
              {rsvp.status !== "attended" ? (
                <form action={checkInGuest}>
                  <input type="hidden" name="eventId" value={event.id} />
                  <input
                    type="hidden"
                    name="customerId"
                    value={rsvp.customerId}
                  />
                  <Button type="submit" variant="outline" size="sm">
                    Check in
                  </Button>
                </form>
              ) : null}
            </div>
          </div>
        ))}
        {rsvps.length === 0 ? (
          <p className="text-sm text-[var(--color-stone-500)]">
            No responses yet.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
