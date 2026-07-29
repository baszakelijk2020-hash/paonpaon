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
  WEDDING_PARTY_STATUSES,
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
  updateMemberFittingStatus,
  updateWeddingPartyStatus,
} from "../actions";

import { AddMemberForm } from "./add-member-form";
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

  const [members, organizer] = await Promise.all([
    repo.findMembers(party.id),
    new CustomerRepository(supabase).findById(party.organizerCustomerId),
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
              className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-2 py-1 text-sm capitalize"
            >
              {WEDDING_PARTY_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
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
                      className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-2 py-1 text-xs capitalize"
                    >
                      {WEDDING_PARTY_MEMBER_FITTING_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
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
    </div>
  );
}
