import {
  AlterationRepository,
  CustomerRepository,
  ProductRepository,
  ProductVariantRepository,
  WeddingPartyRepository,
  WishlistRepository,
} from "@paon/database";
import {
  WEDDING_PARTY_MEMBER_FITTING_STATUSES,
  WEDDING_PARTY_MEMBER_FITTING_STATUS_LABELS,
  WEDDING_PARTY_MEMBER_ROLE_LABELS,
  WEDDING_PARTY_STATUSES,
  WEDDING_PARTY_STATUS_LABELS,
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

import { startConversation } from "../../messages/actions";
import {
  markGuestVoucherRedeemed,
  updateMemberFittingStatus,
  updateWeddingPartyStatus,
} from "../actions";

import { AddMemberForm } from "./add-member-form";
import { AftercarePlanForm } from "./aftercare-plan-form";
import { GroupFittingForm } from "./group-fitting-form";
import { GuestVoucherForm } from "./guest-voucher-form";
import { PartyScheduleForm } from "./party-schedule-form";

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
  const repo = new WeddingPartyRepository(supabase);

  const party = await repo.findById(id as never);
  if (!party || party.retailerId !== session.retailerId) notFound();

  const [members, organizer, aftercarePlans, groupFittings, guestVouchers] =
    await Promise.all([
      repo.findMembers(party.id),
      new CustomerRepository(supabase).findById(party.organizerCustomerId),
      repo.findAftercarePlans(party.id),
      repo.findGroupFittings(party.id),
      repo.findGuestVouchers(party.id),
    ]);

  const wishlistRepo = new WishlistRepository(supabase);
  const variantRepo = new ProductVariantRepository(supabase);
  const productRepo = new ProductRepository(supabase);
  const alterationRepo = new AlterationRepository(supabase);

  const memberDetails = await Promise.all(
    members.map(async (member) => {
      const [wishlist, alterations] = await Promise.all([
        wishlistRepo.findByCustomer(member.customerId),
        alterationRepo.findByCustomer(member.customerId),
      ]);
      const stylePicks = wishlist
        ? (
            await Promise.all(
              (await wishlistRepo.findItems(wishlist.id)).map(async (item) => {
                const variant = await variantRepo.findById(
                  item.productVariantId,
                );
                const product = variant
                  ? await productRepo.findById(variant.productId)
                  : null;
                return variant && product ? { variant, product } : null;
              }),
            )
          ).filter((entry): entry is NonNullable<typeof entry> => !!entry)
        : [];
      return { member, stylePicks, alteration: alterations[0] };
    }),
  );

  const membersNeedingFitting = members.filter(
    (member) =>
      member.fittingStatus === "invited" ||
      member.fittingStatus === "scheduled",
  );
  /* `wedding_group_fittings` records dated, finite fitting sessions. It does
   * not provide a recurring fittings-per-day rate, so it cannot honestly
   * satisfy checkGroupFittingCapacity's per-day contract. Project the real
   * canonical sessions instead of inventing a daily capacity model. */
  const fittingCapacityProjection = party.eventDate
    ? (() => {
        const scheduledCapacity = groupFittings
          .filter(
            (fitting) => fitting.scheduledAt.slice(0, 10) <= party.eventDate!,
          )
          .reduce((total, fitting) => total + fitting.capacity, 0);
        return {
          scheduledCapacity,
          adequate: scheduledCapacity >= membersNeedingFitting.length,
        };
      })()
    : null;

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
            {organizer?.fullName ?? "Wedding party"}
          </h1>
          <p className="text-sm text-[var(--color-stone-500)]">
            {party.eventDate
              ? formatDate(party.eventDate, "en-US")
              : "No date set"}
            {party.eventTime ? ` · ${party.eventTime}` : ""}
            {party.fittingLocation
              ? ` · Fitting at ${party.fittingLocation}`
              : party.venueName
                ? ` · ${party.venueName}`
                : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <form action={startConversation}>
            <input
              type="hidden"
              name="customerId"
              value={party.organizerCustomerId}
            />
            <button
              type="submit"
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              Message the party
            </button>
          </form>
          <form
            action={updateWeddingPartyStatus}
            className="flex items-center gap-2"
          >
            <input type="hidden" name="weddingPartyId" value={party.id} />
            <select
              name="status"
              aria-label="Party status"
              defaultValue={party.status}
              className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-2 py-1 text-sm"
            >
              {WEDDING_PARTY_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {WEDDING_PARTY_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Update
            </button>
          </form>
        </div>
      </div>

      {party.notes ? (
        <Card className="paon-reveal">
          <p className="text-sm text-[var(--color-stone-700)]">{party.notes}</p>
        </Card>
      ) : null}

      <Card className="paon-reveal" style={{ animationDelay: "60ms" }}>
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

      {anniversary ? (
        <Card className="paon-reveal" style={{ animationDelay: "90ms" }}>
          <p className="mb-1 text-sm font-medium text-[var(--color-stone-900)]">
            Next anniversary
          </p>
          <p className="text-sm text-[var(--color-stone-700)]">
            {formatDate(anniversary.occursOn, "en-US")}
            {anniversary.yearsSince > 0
              ? ` · ${anniversary.yearsSince} year${anniversary.yearsSince === 1 ? "" : "s"} since the wedding`
              : " · their wedding day"}
          </p>
        </Card>
      ) : null}

      <div>
        <h2 className="mb-3 text-lg font-medium text-[var(--color-stone-900)]">
          Party members
        </h2>
        <Card
          className="paon-reveal divide-y overflow-hidden rounded-[var(--radius-md)] p-0 shadow-[var(--shadow-elevated)]"
          style={{ animationDelay: "120ms" }}
        >
          {memberDetails.map(({ member, stylePicks, alteration }) => (
            <div key={member.id} className="flex flex-col gap-3 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  {member.photoUrl ? (
                    <Image
                      src={member.photoUrl}
                      alt=""
                      width={40}
                      height={40}
                      unoptimized
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : null}
                  <div>
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
                  <form
                    action={updateMemberFittingStatus}
                    className="flex items-center gap-2"
                  >
                    <input type="hidden" name="memberId" value={member.id} />
                    <input
                      type="hidden"
                      name="weddingPartyId"
                      value={party.id}
                    />
                    <select
                      name="status"
                      aria-label={`${member.name}'s fitting status`}
                      defaultValue={member.fittingStatus}
                      className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-2 py-1 text-xs"
                    >
                      {WEDDING_PARTY_MEMBER_FITTING_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {WEDDING_PARTY_MEMBER_FITTING_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      Update
                    </button>
                  </form>
                </div>
              </div>

              {stylePicks.length > 0 ? (
                <div>
                  <p className="text-xs uppercase text-[var(--color-stone-500)]">
                    Style picks
                  </p>
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {stylePicks.map(({ variant, product }) => (
                      <li
                        key={variant.id}
                        className="text-sm text-[var(--color-stone-700)]"
                      >
                        {product.name}
                        {[variant.size, variant.color].filter(Boolean).length
                          ? ` (${[variant.size, variant.color].filter(Boolean).join(" · ")})`
                          : ""}{" "}
                        · {formatMoney(variant.price, "en-US")}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {alteration ? (
                <Link
                  href={`/alterations/${alteration.id}`}
                  className="text-sm text-[var(--color-stone-600)] underline underline-offset-4"
                >
                  View fitting & fit tools
                </Link>
              ) : null}
            </div>
          ))}
          {memberDetails.length === 0 ? (
            <p className="p-6 text-sm text-[var(--color-stone-500)]">
              No members added yet.
            </p>
          ) : null}
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium text-[var(--color-stone-900)]">
          Add a member
        </h2>
        <Card className="paon-reveal" style={{ animationDelay: "240ms" }}>
          <AddMemberForm weddingPartyId={party.id} />
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium text-[var(--color-stone-900)]">
          Delivery &amp; pickup readiness
        </h2>
        <Card
          className="paon-reveal flex flex-col gap-4"
          style={{ animationDelay: "260ms" }}
        >
          {aftercarePlans.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {aftercarePlans.map((plan) => {
                const member = members.find(
                  (candidate) => candidate.id === plan.weddingPartyMemberId,
                );
                return (
                  <li
                    key={plan.id}
                    className="flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p>{plan.instruction}</p>
                      <p className="text-xs text-[var(--color-stone-500)]">
                        {member ? member.name : "Whole party"}
                        {plan.dueOn
                          ? ` · due ${formatDate(plan.dueOn, "en-US")}`
                          : ""}
                      </p>
                    </div>
                    <Badge tone={plan.completedAt ? "success" : "neutral"}>
                      {plan.completedAt ? "Done" : "Pending"}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-[var(--color-stone-500)]">
              No instructions yet.
            </p>
          )}
          <AftercarePlanForm weddingPartyId={party.id} members={members} />
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium text-[var(--color-stone-900)]">
          Group fittings
        </h2>
        <Card
          className="paon-reveal flex flex-col gap-4"
          style={{ animationDelay: "280ms" }}
        >
          <div
            data-testid="group-fitting-capacity-summary"
            className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-3 text-sm"
          >
            {fittingCapacityProjection?.adequate ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-[var(--color-stone-900)]">
                    Fitting capacity is adequate
                  </p>
                  <p className="text-xs text-[var(--color-stone-500)]">
                    {membersNeedingFitting.length}{" "}
                    {membersNeedingFitting.length === 1 ? "member" : "members"}{" "}
                    needing fitting have{" "}
                    {fittingCapacityProjection.scheduledCapacity} scheduled{" "}
                    {fittingCapacityProjection.scheduledCapacity === 1
                      ? "place"
                      : "places"}{" "}
                    before the event.
                  </p>
                </div>
                <Badge tone="success">Adequate</Badge>
              </div>
            ) : fittingCapacityProjection ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-[var(--color-stone-900)]">
                    Fitting capacity exception
                  </p>
                  <Badge tone="warning">Action needed</Badge>
                </div>
                <p className="text-xs text-[var(--color-stone-500)]">
                  {fittingCapacityProjection.scheduledCapacity === 0
                    ? "No group fitting capacity is scheduled before the event."
                    : `Only ${fittingCapacityProjection.scheduledCapacity} scheduled ${fittingCapacityProjection.scheduledCapacity === 1 ? "place is" : "places are"} available before the event.`}
                </p>
                {membersNeedingFitting.length > 0 ? (
                  <p className="text-xs text-[var(--color-stone-500)]">
                    {membersNeedingFitting.length}{" "}
                    {membersNeedingFitting.length === 1
                      ? "member needs"
                      : "members need"}{" "}
                    fitting:{" "}
                    {membersNeedingFitting
                      .map((member) => member.name)
                      .join(", ")}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-[var(--color-stone-500)]">
                  Set the event date to assess group fitting capacity.
                </p>
                <Badge tone="warning">Date needed</Badge>
              </div>
            )}
          </div>
          {groupFittings.length > 0 ? (
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
          ) : (
            <p className="text-sm text-[var(--color-stone-500)]">
              No group fittings scheduled yet.
            </p>
          )}
          <GroupFittingForm weddingPartyId={party.id} />
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium text-[var(--color-stone-900)]">
          Guest vouchers
        </h2>
        <Card
          className="paon-reveal flex flex-col gap-4"
          style={{ animationDelay: "300ms" }}
        >
          {guestVouchers.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {guestVouchers.map((voucher) => (
                <li
                  key={voucher.id}
                  className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p>{voucher.guestLabel}</p>
                    <p className="text-xs text-[var(--color-stone-500)]">
                      {formatMoney(voucher.value, "en-US")} ·{" "}
                      {voucher.fundingSource} · expires{" "}
                      {formatDate(voucher.expiresOn, "en-US")}
                    </p>
                  </div>
                  {voucher.redeemedAt ? (
                    <Badge tone="success">Redeemed</Badge>
                  ) : (
                    <form action={markGuestVoucherRedeemed}>
                      <input
                        type="hidden"
                        name="voucherId"
                        value={voucher.id}
                      />
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
                        Mark redeemed
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--color-stone-500)]">
              No guest vouchers issued yet.
            </p>
          )}
          <GuestVoucherForm weddingPartyId={party.id} />
        </Card>
      </div>
    </div>
  );
}
