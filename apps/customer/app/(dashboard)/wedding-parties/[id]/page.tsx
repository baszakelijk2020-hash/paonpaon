import {
  CustomerRepository,
  RetailerRepository,
  WeddingPartyRepository,
} from "@paon/database";
import { Badge } from "@paon/ui/components/Badge";
import { buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";
import Link from "next/link";
import { notFound } from "next/navigation";

import { markFittingScheduled } from "../actions";

import { InviteLink } from "./invite-link";

import { env } from "@/lib/env";
import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const FITTING_TONE = {
  invited: "neutral",
  scheduled: "warning",
  fitted: "success",
  completed: "success",
} as const;

export default async function WeddingPartyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const supabase = await getSupabaseServerClient();
  const partyRepo = new WeddingPartyRepository(supabase);

  const party = await partyRepo.findById(id as never);
  if (!party) notFound();

  const [members, retailer, myCustomers] = await Promise.all([
    partyRepo.findMembers(party.id),
    new RetailerRepository(supabase).findById(party.retailerId),
    new CustomerRepository(supabase).findByUserId(session.userId),
  ]);
  const myCustomerIds = new Set(myCustomers.map((c) => c.id));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-[var(--font-accent)] font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
          {retailer?.displayName}
        </p>
        <h1 className="text-3xl font-[var(--font-display)] text-[var(--color-stone-900)]">
          Wedding party
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          {party.eventDate
            ? formatDate(party.eventDate, "en-US")
            : "No date set"}
          {party.venueName ? ` · ${party.venueName}` : ""}
        </p>
      </div>

      {myCustomerIds.has(party.organizerCustomerId) && retailer ? (
        <Card>
          <p className="mb-2 text-sm font-medium text-[var(--color-stone-900)]">
            Invite your party
          </p>
          <p className="mb-3 text-sm text-[var(--color-stone-500)]">
            Send this link to your best men and groomsmen — anyone who opens it
            can add themselves, no account needed up front.
          </p>
          <InviteLink
            url={`${env.appUrl}/r/${retailer.slug}/wedding-parties/join/${party.inviteToken}`}
          />
        </Card>
      ) : null}

      <Card className="divide-y overflow-hidden rounded-[var(--radius-xl)] p-0 shadow-[var(--shadow-elevated)]">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between px-6 py-4"
          >
            <div>
              <p className="font-medium">{member.name}</p>
              <p className="text-sm capitalize text-[var(--color-stone-500)]">
                {member.role.replaceAll("_", " ")}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge tone={FITTING_TONE[member.fittingStatus]}>
                {member.fittingStatus}
              </Badge>
              {myCustomerIds.has(member.customerId) && retailer ? (
                <div className="flex items-center gap-2">
                  <Link
                    href={`/r/${retailer.slug}/swipe`}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    Pick your look
                  </Link>
                  {member.fittingStatus === "invited" ? (
                    <form action={markFittingScheduled}>
                      <input type="hidden" name="memberId" value={member.id} />
                      <input
                        type="hidden"
                        name="weddingPartyId"
                        value={party.id}
                      />
                      <button
                        type="submit"
                        className={buttonVariants({ size: "sm" })}
                      >
                        I&rsquo;ve booked my fitting
                      </button>
                    </form>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {members.length === 0 ? (
          <p className="p-6 text-sm text-[var(--color-stone-500)]">
            No members added yet.
          </p>
        ) : null}
      </Card>

      {retailer ? (
        <p className="text-sm text-[var(--color-stone-600)]">
          Need to book or change a fitting?{" "}
          <Link
            href={`/r/${retailer.slug}/appointments`}
            className="underline underline-offset-4"
          >
            Book an appointment
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
