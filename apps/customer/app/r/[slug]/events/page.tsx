import { EventRepository, RetailerRepository } from "@paon/database";
import { Button, buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";
import Link from "next/link";
import { notFound } from "next/navigation";

import { rsvpToEvent } from "./actions";

import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function StorefrontEventsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = await getSupabaseServerClient();
  const retailer = await new RetailerRepository(client).findBySlug(slug);
  if (!retailer || retailer.status !== "active") notFound();
  const [events, session] = await Promise.all([
    new EventRepository(client).findPublishedByRetailer(retailer.id),
    getSession(),
  ]);
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <p className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
        {retailer.displayName}
      </p>
      <div className="mb-6 flex items-end justify-between">
        <h1 className="text-3xl font-[var(--font-display)] text-[var(--color-stone-900)]">
          Events
        </h1>
        <Link
          href={`/r/${slug}/products`}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Shop
        </Link>
      </div>
      <div className="grid gap-4">
        {events.map((event) => (
          <Card key={event.id}>
            <p className="text-sm uppercase tracking-wide text-[var(--color-stone-500)]">
              {formatDate(event.startsAt, "en-US")}
            </p>
            <h2 className="mt-1 text-xl font-medium">{event.name}</h2>
            <p className="mt-2 text-sm text-[var(--color-stone-600)]">
              {event.description}
            </p>
            <p className="mt-3 text-sm">
              {event.venueName}
              {event.venueAddress ? ` · ${event.venueAddress}` : ""}
            </p>
            {session?.accountType === "customer" ? (
              <div className="mt-5 flex gap-2">
                <form action={rsvpToEvent}>
                  <input type="hidden" name="eventId" value={event.id} />
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="status" value="attending" />
                  <Button type="submit" size="sm">
                    Attend
                  </Button>
                </form>
                <form action={rsvpToEvent}>
                  <input type="hidden" name="eventId" value={event.id} />
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="status" value="declined" />
                  <Button type="submit" size="sm" variant="ghost">
                    Decline
                  </Button>
                </form>
              </div>
            ) : (
              <Link
                href={`/login?redirectTo=/r/${slug}/events`}
                className={`${buttonVariants({ size: "sm" })} mt-5`}
              >
                Sign in to RSVP
              </Link>
            )}
          </Card>
        ))}
        {events.length === 0 ? (
          <Card>
            <p className="text-sm text-[var(--color-stone-500)]">
              No upcoming public events.
            </p>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
