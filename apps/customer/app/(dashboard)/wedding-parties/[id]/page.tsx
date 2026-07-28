import {
  CustomerRepository,
  RetailerRepository,
  WeddingPartyRepository,
} from "@paon/database";
import { Badge } from "@paon/ui/components/Badge";
import { buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { markFittingScheduled } from "../actions";

import { AmHouseHero } from "./am-house-hero";
import { AmHouseOrbit } from "./am-house-orbit";
import { InviteLink } from "./invite-link";
import { MemberPhotoUploader, PartyCoverUploader } from "./party-photos";
import { PartyScheduleForm } from "./party-schedule-form";

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
  const organizer = members.find(
    (member) => member.customerId === party.organizerCustomerId,
  );

  return (
    <div className="flex flex-col gap-6">
      <AmHouseHero
        retailerName={retailer?.displayName ?? "Your atelier"}
        eventDate={
          party.eventDate
            ? `${formatDate(party.eventDate, "en-US")}${
                party.eventTime ? ` at ${party.eventTime}` : ""
              }`
            : undefined
        }
        venueName={party.fittingLocation ?? party.venueName}
        organizerName={organizer?.name}
        note={party.notes}
        retailerSlug={retailer?.slug}
        {...(party.coverPhotoUrl ? { coverPhotoUrl: party.coverPhotoUrl } : {})}
      />

      <AmHouseOrbit
        center={{
          name: organizer?.name ?? "Organizer",
          ...(organizer?.photoUrl ? { photoUrl: organizer.photoUrl } : {}),
        }}
        orbiters={members
          .filter((member) => member.customerId !== party.organizerCustomerId)
          .map((member) => ({
            name: member.name,
            ...(member.photoUrl ? { photoUrl: member.photoUrl } : {}),
          }))}
      />

      {myCustomerIds.has(party.organizerCustomerId) && retailer ? (
        <Card className="paon-reveal">
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

      {myCustomerIds.has(party.organizerCustomerId) ? (
        <Card className="paon-reveal" style={{ animationDelay: "40ms" }}>
          <p className="mb-3 text-sm font-medium text-[var(--color-stone-900)]">
            Fitting schedule
          </p>
          <PartyScheduleForm
            partyId={party.id}
            {...(party.eventDate ? { eventDate: party.eventDate } : {})}
            {...(party.eventTime ? { eventTime: party.eventTime } : {})}
            {...(party.venueName ? { venueName: party.venueName } : {})}
            {...(party.fittingLocation
              ? { fittingLocation: party.fittingLocation }
              : {})}
            {...(party.notes ? { notes: party.notes } : {})}
          />
        </Card>
      ) : null}

      {myCustomerIds.has(party.organizerCustomerId) ? (
        <Card className="paon-reveal" style={{ animationDelay: "60ms" }}>
          <p className="mb-3 text-sm font-medium text-[var(--color-stone-900)]">
            Party cover
          </p>
          <PartyCoverUploader
            partyId={party.id}
            {...(party.coverPhotoUrl
              ? { coverPhotoUrl: party.coverPhotoUrl }
              : {})}
          />
        </Card>
      ) : null}

      <Card
        className="paon-reveal divide-y overflow-hidden rounded-[var(--radius-xl)] p-0 shadow-[var(--shadow-elevated)]"
        style={{ animationDelay: "120ms" }}
      >
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between gap-4 px-6 py-4"
          >
            <div className="flex min-w-0 items-center gap-3">
              {myCustomerIds.has(party.organizerCustomerId) ? (
                <MemberPhotoUploader
                  partyId={party.id}
                  memberId={member.id}
                  memberName={member.name}
                  {...(member.photoUrl ? { photoUrl: member.photoUrl } : {})}
                />
              ) : member.photoUrl ? (
                <Image
                  src={member.photoUrl}
                  alt=""
                  width={40}
                  height={40}
                  unoptimized
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div
                  aria-hidden
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-stone-200)] text-sm text-[var(--color-stone-600)]"
                >
                  {member.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-medium">{member.name}</p>
                <p className="text-sm capitalize text-[var(--color-stone-500)]">
                  {member.role.replaceAll("_", " ")}
                  {member.heightCm != null && member.weightKg != null
                    ? ` · ${member.heightCm} cm / ${member.weightKg} kg`
                    : ""}
                </p>
              </div>
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
