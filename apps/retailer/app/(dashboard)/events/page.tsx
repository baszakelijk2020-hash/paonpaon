import { requireRetailerRole } from "@paon/auth";
import { EventRepository } from "@paon/database";
import { EVENT_STATUS_LABELS } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { Input } from "@paon/ui/components/Input";
import { formatDate } from "@paon/utils";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createEvent } from "./actions";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function EventsPage() {
  const session = await requireSession();
  try {
    requireRetailerRole(session.retailerRole, "manager");
  } catch {
    redirect("/dashboard");
  }
  const events = await new EventRepository(
    await getSupabaseServerClient(),
  ).findByRetailer(session.retailerId);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Events</h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Trunk shows, launches and private client events.
        </p>
      </div>
      <Card>
        <h2 className="mb-4 text-lg font-medium">Create event</h2>
        <form action={createEvent} className="grid gap-4 sm:grid-cols-2">
          <Input name="name" placeholder="Spring trunk show" required />
          <Input name="venueName" placeholder="Venue" required />
          <Input name="startsAt" type="datetime-local" required />
          <Input name="endsAt" type="datetime-local" required />
          <Input name="venueAddress" placeholder="Address (optional)" />
          <Input
            name="capacity"
            type="number"
            min="1"
            placeholder="Capacity (optional)"
          />
          <select
            name="visibility"
            className="h-10 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3"
          >
            <option value="public">Public</option>
            <option value="invite_only">Invite only</option>
            <option value="vip_tier">Gold & platinum members</option>
          </select>
          <textarea
            name="description"
            className="min-h-24 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-3 sm:col-span-2"
            placeholder="Event description"
            required
          />
          <Button type="submit">Create draft</Button>
        </form>
      </Card>
      <Card className="divide-y overflow-hidden rounded-[var(--radius-md)] p-0 shadow-[var(--shadow-elevated)]">
        {events.map((event) => (
          <Link
            key={event.id}
            href={`/events/${event.id}`}
            className="flex flex-wrap items-start justify-between gap-3 px-6 py-4 hover:bg-[var(--color-stone-50)]"
          >
            <div className="min-w-0">
              <p className="font-medium">{event.name}</p>
              <p className="text-sm text-[var(--color-stone-500)]">
                {formatDate(event.startsAt, "en-US")} · {event.venueName}
              </p>
            </div>
            <span className="shrink-0 text-sm">
              {EVENT_STATUS_LABELS[event.status]}
            </span>
          </Link>
        ))}
        {events.length === 0 ? (
          <p className="p-6 text-sm text-[var(--color-stone-500)]">
            No events yet.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
