import {
  CustomerRepository,
  RetailerRepository,
  WeddingPartyRepository,
} from "@paon/database";
import {
  WEDDING_PARTY_MEMBER_FITTING_STATUS_LABELS,
  WEDDING_PARTY_MEMBER_ROLE_LABELS,
  nextAnniversary,
  nextYearlyOccurrence,
} from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { formatDate, formatMoney } from "@paon/utils";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  completeAftercarePlan,
  markFittingScheduled,
  redeemGuestVoucher,
} from "../actions";

import { AmHouseHero } from "./am-house-hero";
import { AmHouseOrbit } from "./am-house-orbit";
import { DateCandidatesPanel } from "./date-candidates-panel";
import { DesignChoiceForm } from "./design-choice-form";
import { InspirationItemForm } from "./inspiration-item-form";
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

  const [
    members,
    retailer,
    myCustomers,
    aftercarePlans,
    groupFittings,
    inspirationItems,
    designChoices,
    dateCandidates,
    guestVouchers,
  ] = await Promise.all([
    partyRepo.findMembers(party.id),
    new RetailerRepository(supabase).findById(party.retailerId),
    new CustomerRepository(supabase).findByUserId(session.userId),
    partyRepo.findAftercarePlans(party.id),
    partyRepo.findGroupFittings(party.id),
    partyRepo.findInspirationItems(party.id),
    partyRepo.findDesignChoices(party.id),
    partyRepo.findDateCandidates(party.id),
    partyRepo.findGuestVouchers(party.id),
  ]);
  const dateVotes = await partyRepo.findDateVotes(
    dateCandidates.map((candidate) => candidate.id),
  );
  const myCustomerIds = new Set(myCustomers.map((c) => c.id));
  const organizer = members.find(
    (member) => member.customerId === party.organizerCustomerId,
  );
  const myMember = members.find((member) =>
    myCustomerIds.has(member.customerId),
  );
  const isOrganizer = myCustomerIds.has(party.organizerCustomerId);

  /* Injects the existing nextYearlyOccurrence rather than reimplementing
   * it — a second date-recurrence function is how two parts of a system
   * start disagreeing about what a leap-year date means. */
  const anniversary = party.eventDate
    ? nextAnniversary({
        eventDate: party.eventDate,
        asOf: new Date().toISOString().slice(0, 10),
        nextYearlyOccurrence,
      })
    : null;
  const completedMembers = members.filter(
    (member) =>
      member.fittingStatus === "completed" || member.fittingStatus === "fitted",
  ).length;
  const partyProgress = members.length
    ? Math.round((completedMembers / members.length) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-8">
      <section className="relative overflow-hidden rounded-[2rem] bg-[#171714] px-5 py-7 text-white shadow-[0_24px_70px_rgba(35,31,24,0.16)] sm:px-8">
        <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[#cbb894]/15 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-[0.22em] text-[#cbb894]">
              Wedding party / {partyProgress}% ready
            </p>
            <h1 className="font-display text-3xl tracking-[-0.03em] sm:text-5xl">
              {party.venueName ?? "Wedding party"}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/60">
              One shared room for fittings, outfit decisions, and the final
              run-up to the day.
            </p>
          </div>
          <Link
            href="/messages"
            className="rounded-full border border-white/20 px-4 py-2 text-xs text-white/80 transition hover:bg-white/10"
          >
            Open atelier chat <span aria-hidden>↗</span>
          </Link>
        </div>
      </section>
      <div id="planning" className="grid gap-4 sm:grid-cols-3">
        {[
          [
            "01",
            "Invite the party",
            members.length ? `${members.length} joined` : "Waiting for guests",
          ],
          [
            "02",
            "Choose the date",
            dateCandidates.length
              ? `${dateCandidates.length} options`
              : "Add an option",
          ],
          [
            "03",
            "Complete fittings",
            `${completedMembers}/${members.length || 0} ready`,
          ],
        ].map(([step, title, detail]) => (
          <div
            key={step}
            className="rounded-2xl border border-[var(--color-stone-200)] bg-white px-5 py-4 shadow-[var(--shadow-soft)]"
          >
            <span className="text-[10px] tracking-[0.18em] text-[var(--color-stone-400)]">
              {step}
            </span>
            <p className="mt-2 text-sm font-medium">{title}</p>
            <p className="mt-1 text-xs text-[var(--color-stone-500)]">
              {detail}
            </p>
          </div>
        ))}
      </div>
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-stretch">
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
          {...(party.coverPhotoUrl
            ? { coverPhotoUrl: party.coverPhotoUrl }
            : {})}
        />

        <div className="rounded-[2rem] border border-[var(--color-stone-200)] bg-white px-5 py-6 shadow-[var(--shadow-soft)] lg:flex lg:flex-col lg:justify-center">
          <p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-[var(--color-stone-400)]">
            The party room
          </p>
          <AmHouseOrbit
            center={{
              name: organizer?.name ?? "Organizer",
              ...(organizer?.photoUrl ? { photoUrl: organizer.photoUrl } : {}),
            }}
            orbiters={members
              .filter(
                (member) => member.customerId !== party.organizerCustomerId,
              )
              .map((member) => ({
                name: member.name,
                ...(member.photoUrl ? { photoUrl: member.photoUrl } : {}),
              }))}
          />
          <p className="mt-3 text-center text-xs leading-5 text-[var(--color-stone-500)]">
            The circle moves with the people in the room; plans and fittings
            remain below.
          </p>
        </div>
      </section>

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

      {anniversary ? (
        <Card className="paon-reveal" style={{ animationDelay: "45ms" }}>
          <p className="mb-1 text-sm font-medium text-[var(--color-stone-900)]">
            Next anniversary
          </p>
          <p className="text-sm text-[var(--color-stone-500)]">
            {formatDate(anniversary.occursOn, "en-US")}
            {anniversary.yearsSince > 0
              ? ` · ${anniversary.yearsSince} year${anniversary.yearsSince === 1 ? "" : "s"} married`
              : " · your wedding day"}
          </p>
        </Card>
      ) : null}

      {isOrganizer || myMember ? (
        <Card className="paon-reveal" style={{ animationDelay: "50ms" }}>
          <p className="mb-3 text-sm font-medium text-[var(--color-stone-900)]">
            Agree on a date
          </p>
          <DateCandidatesPanel
            weddingPartyId={party.id}
            candidates={dateCandidates}
            votes={dateVotes}
            isOrganizer={isOrganizer}
            {...(myMember ? { myMemberId: myMember.id } : {})}
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
        className="paon-reveal divide-y overflow-hidden rounded-[var(--radius-md)] p-0 shadow-[var(--shadow-elevated)]"
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
                <p className="text-sm text-[var(--color-stone-500)]">
                  {WEDDING_PARTY_MEMBER_ROLE_LABELS[member.role]}
                  {member.heightCm != null && member.weightKg != null
                    ? ` · ${member.heightCm} cm / ${member.weightKg} kg`
                    : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge tone={FITTING_TONE[member.fittingStatus]}>
                {
                  WEDDING_PARTY_MEMBER_FITTING_STATUS_LABELS[
                    member.fittingStatus
                  ]
                }
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

      {aftercarePlans.length > 0 ? (
        <Card className="paon-reveal" style={{ animationDelay: "160ms" }}>
          <p className="mb-3 text-sm font-medium text-[var(--color-stone-900)]">
            Delivery &amp; pickup readiness
          </p>
          <ul className="flex flex-col gap-2">
            {aftercarePlans.map((plan) => {
              const assignedMember = members.find(
                (candidate) => candidate.id === plan.weddingPartyMemberId,
              );
              const canComplete =
                !plan.completedAt &&
                (isOrganizer ||
                  (plan.weddingPartyMemberId
                    ? myMember?.id === plan.weddingPartyMemberId
                    : !!myMember));
              return (
                <li
                  key={plan.id}
                  className="flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p>{plan.instruction}</p>
                    <p className="text-xs text-[var(--color-stone-500)]">
                      {assignedMember ? assignedMember.name : "Whole party"}
                      {plan.dueOn
                        ? ` · due ${formatDate(plan.dueOn, "en-US")}`
                        : ""}
                    </p>
                  </div>
                  {plan.completedAt ? (
                    <Badge tone="success">Done</Badge>
                  ) : canComplete ? (
                    <form action={completeAftercarePlan}>
                      <input type="hidden" name="planId" value={plan.id} />
                      <input
                        type="hidden"
                        name="weddingPartyId"
                        value={party.id}
                      />
                      <button
                        type="submit"
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                        })}
                      >
                        Mark done
                      </button>
                    </form>
                  ) : (
                    <Badge tone="neutral">Pending</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      {groupFittings.length > 0 ? (
        <Card className="paon-reveal" style={{ animationDelay: "200ms" }}>
          <p className="mb-3 text-sm font-medium text-[var(--color-stone-900)]">
            Group fittings
          </p>
          <ul className="flex flex-col gap-2">
            {groupFittings.map((fitting) => (
              <li
                key={fitting.id}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2 text-sm"
              >
                <span>
                  {new Date(fitting.scheduledAt).toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
                <span className="text-xs text-[var(--color-stone-500)]">
                  Capacity {fitting.capacity}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {guestVouchers.length > 0 ? (
        <Card className="paon-reveal" style={{ animationDelay: "210ms" }}>
          <p className="mb-3 text-sm font-medium text-[var(--color-stone-900)]">
            Guest vouchers
          </p>
          <ul className="flex flex-col gap-2">
            {guestVouchers.map((voucher) => (
              <li
                key={voucher.id}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p>{voucher.guestLabel}</p>
                  <p className="text-xs text-[var(--color-stone-500)]">
                    {formatMoney(voucher.value, "en-US")} · expires{" "}
                    {formatDate(voucher.expiresOn, "en-US")}
                  </p>
                </div>
                {voucher.redeemedAt ? (
                  <Badge tone="success">Redeemed</Badge>
                ) : isOrganizer || myMember ? (
                  <form action={redeemGuestVoucher}>
                    <input type="hidden" name="voucherId" value={voucher.id} />
                    <input
                      type="hidden"
                      name="weddingPartyId"
                      value={party.id}
                    />
                    <button
                      type="submit"
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      Redeem
                    </button>
                  </form>
                ) : (
                  <Badge tone="neutral">Active</Badge>
                )}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {inspirationItems.length > 0 || isOrganizer || myMember ? (
        <Card className="paon-reveal" style={{ animationDelay: "220ms" }}>
          <p className="mb-3 text-sm font-medium text-[var(--color-stone-900)]">
            Inspiration
          </p>
          {inspirationItems.length > 0 ? (
            <ul className="mb-3 flex flex-col gap-2">
              {inspirationItems.map((item) => (
                <li
                  key={item.id}
                  className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2 text-sm"
                >
                  {item.imageRef ? (
                    <a
                      href={item.imageRef}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-4"
                    >
                      {item.imageRef}
                    </a>
                  ) : null}
                  {item.note ? <p>{item.note}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-3 text-sm text-[var(--color-stone-500)]">
              Nothing pinned yet.
            </p>
          )}
          {isOrganizer || myMember ? (
            <InspirationItemForm weddingPartyId={party.id} />
          ) : null}
        </Card>
      ) : null}

      {designChoices.length > 0 || isOrganizer || myMember ? (
        <Card className="paon-reveal" style={{ animationDelay: "230ms" }}>
          <p className="mb-3 text-sm font-medium text-[var(--color-stone-900)]">
            Outfit choices
          </p>
          {designChoices.length > 0 ? (
            <ul className="mb-3 flex flex-col gap-2">
              {designChoices.map((choice) => {
                const chosenBy = members.find(
                  (candidate) => candidate.id === choice.weddingPartyMemberId,
                );
                return (
                  <li
                    key={choice.id}
                    className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2 text-sm"
                  >
                    <span>
                      {choice.slotKey}: {choice.valueKey}
                    </span>
                    <span className="text-xs text-[var(--color-stone-500)]">
                      {chosenBy ? chosenBy.name : "Whole party"}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mb-3 text-sm text-[var(--color-stone-500)]">
              No choices set yet.
            </p>
          )}
          {isOrganizer || myMember ? (
            <DesignChoiceForm
              weddingPartyId={party.id}
              isOrganizer={isOrganizer}
              {...(myMember ? { myMemberId: myMember.id } : {})}
            />
          ) : null}
        </Card>
      ) : null}

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
