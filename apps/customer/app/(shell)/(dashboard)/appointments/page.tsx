import {
  AlterationCatalogueRepository,
  AppointmentRepository,
  PaidCareServicePriceRepository,
  RetailerBranchRepository,
  WardrobeRepository,
  WardrobeRoadmapRepository,
  WeddingPartyRepository,
} from "@paon/database";
import type { PaidCareServiceKind } from "@paon/domain";
import { z } from "zod";

import { AppointmentIdeaCarousel } from "./appointment-idea-carousel";
import { AppointmentMonthCarousel } from "./appointment-month-carousel";
import { BookAppointmentLauncher } from "./book-appointment-launcher";
import type { BookableBranch } from "./booking-flow";
import { APPOINTMENT_REASONS } from "./booking-reasons";
import type { PricedOperation } from "./paid-care-flow";
import { PaidCareLauncher } from "./paid-care-launcher";
import { QuickBookBar } from "./quick-book-bar";
import {
  TailoringPartyInvitee,
  type TailoringPartyInvite,
} from "./tailoring-party-invitee";
import {
  TailoringPartyPlanner,
  type TailoringPartyBooking,
  type TailoringPartyMember,
} from "./tailoring-party-planner";

import { getCustomersForUser } from "@/lib/customer-context";
import { getGuestRetailerId } from "@/lib/guest-house";
import { getViewerSession } from "@/lib/session";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const prefillParamsSchema = z.object({
  prefillReason: z.enum(
    APPOINTMENT_REASONS.map((r) => r.value) as [string, ...string[]],
  ),
  prefillWardrobeItemId: z.string().uuid().optional(),
  prefillRoadmapGapId: z.string().uuid().optional(),
});

interface ResolvedBookingPrefill {
  readonly initialReason: (typeof APPOINTMENT_REASONS)[number]["value"];
  readonly purpose: string;
  readonly wardrobeItemId?: string;
  readonly roadmapGapId?: string;
}

/**
 * DeepSeek remediation Cards 1-2: Wardrobe's "Request a fit-check in
 * store" / "Proceed in store" actions link here with typed, allowlisted
 * query params for the garment/context they're about. Anything that
 * doesn't resolve to real data this customer actually owns — bad reason,
 * missing/retired/cross-tenant garment or roadmap gap, malformed ids —
 * fails closed to `null`: the page renders the normal, un-prefilled
 * booking flow exactly as if no query params were present at all.
 */
async function resolveBookingPrefill(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  customerId: string,
  searchParams: Record<string, string | string[] | undefined>,
): Promise<ResolvedBookingPrefill | null> {
  const firstOf = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const parsed = prefillParamsSchema.safeParse({
    prefillReason: firstOf(searchParams["prefillReason"]),
    prefillWardrobeItemId: firstOf(searchParams["prefillWardrobeItemId"]),
    prefillRoadmapGapId: firstOf(searchParams["prefillRoadmapGapId"]),
  });
  if (!parsed.success) return null;
  const initialReason = parsed.data
    .prefillReason as ResolvedBookingPrefill["initialReason"];

  if (parsed.data.prefillWardrobeItemId) {
    const item = await new WardrobeRepository(supabase).findById(
      parsed.data.prefillWardrobeItemId as never,
    );
    if (!item || item.customerId !== customerId || item.retiredAt) {
      return null;
    }
    return {
      initialReason,
      purpose: `Fit-check: ${item.displayName}`,
      wardrobeItemId: parsed.data.prefillWardrobeItemId,
    };
  }

  if (parsed.data.prefillRoadmapGapId) {
    const roadmaps = await new WardrobeRoadmapRepository(
      supabase,
    ).findByCustomer(customerId as never, { customerVisibleOnly: true });
    const gap = roadmaps
      .flatMap((roadmap) => roadmap.gaps)
      .find((candidate) => candidate.id === parsed.data.prefillRoadmapGapId);
    if (!gap) return null;
    return {
      initialReason,
      purpose: `In-store: ${gap.title}`,
      roadmapGapId: parsed.data.prefillRoadmapGapId,
    };
  }

  return null;
}

const MONTHLY_APPOINTMENT_THEMES = [
  {
    title: "Retail Therapy Session",
    copy: "Refresh your wardrobe for the new year.",
    accent: "#8f877b",
  },
  {
    title: "Spring/Summer Tailoring",
    copy: "Prepare lighter pieces for the season.",
    accent: "#a79a86",
  },
  {
    title: "Wedding & Event",
    copy: "Plan formal looks for special occasions.",
    accent: "#b7aa84",
  },
  {
    title: "",
    copy: "",
    accent: "#ffffff00",
  },
  {
    title: "Summer Holiday",
    copy: "Summer knits, linen shirts, loafers.",
    accent: "#829192",
  },
  {
    title: "Private Cloth Preview",
    copy: "Invitation-only first look at limited cloth and next autumn book.",
    accent: "#aeb7a0",
  },
  {
    title: "Private Archive Appointment",
    copy: "One-off cloth, house favourites, mid-year fit review.",
    accent: "#a79691",
  },
  {
    title: "Back to the Office Refresh",
    copy: "Update your work wardrobe for the season.",
    accent: "#c0ad87",
  },
  {
    title: "",
    copy: "",
    accent: "#ffffff00",
  },
  {
    title: "Fall/Winter Wardrobe",
    copy: "Plan cloth, coats and the colder season's essentials.",
    accent: "#8d765e",
  },
  {
    title: "Holiday Season Outfit",
    copy: "Prepare polished looks for festive celebrations.",
    accent: "#76544d",
  },
  {
    title: "Purchase customised gift vouchers for loved ones or staff",
    copy: "Share the gift of choice with your network.",
    accent: "#786f82",
  },
] as const;

const APPOINTMENT_LANDSCAPE_IMAGES = [
  "https://www.nebelspiegel.com/images/chats222.png",
  "https://www.nebelspiegel.com/images/chatpic02.png",
  "https://www.nebelspiegel.com/images/chatpic03.png",
  "https://www.nebelspiegel.com/images/chatpic04.png",
] as const;

interface AppointmentYearMonth {
  readonly id: string;
  readonly month: string;
  readonly monthName: string;
  readonly monthNumber: string;
  readonly year: number;
  readonly title: string;
  readonly copy: string;
  readonly accent: string;
  readonly imageUrl: (typeof APPOINTMENT_LANDSCAPE_IMAGES)[number];
  readonly isPast: boolean;
  readonly isCurrent: boolean;
}

/** The timeline opens on the launch month: no month before it is shown. */
const TIMELINE_LAUNCH = new Date(2026, 9, 1);

function buildAppointmentYear(from: Date): AppointmentYearMonth[] {
  const currentMonth = from.getMonth();
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(from.getFullYear(), currentMonth + index, 1);
    const theme = MONTHLY_APPOINTMENT_THEMES[date.getMonth()]!;
    return {
      ...theme,
      id: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      monthName: new Intl.DateTimeFormat("en-US", { month: "long" }).format(
        date,
      ),
      monthNumber: String(date.getMonth() + 1).padStart(2, "0"),
      year: date.getFullYear(),
      imageUrl:
        APPOINTMENT_LANDSCAPE_IMAGES[
          index % APPOINTMENT_LANDSCAPE_IMAGES.length
        ]!,
      isPast: false,
      isCurrent:
        date.getFullYear() === from.getFullYear() &&
        date.getMonth() === currentMonth,
    };
  });
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getViewerSession();
  const supabase = await getSupabaseServerClient();
  const resolvedSearchParams = await searchParams;

  const customers = await getCustomersForUser(session.userId);
  const branchRepo = new RetailerBranchRepository(supabase);

  const primaryCustomer = customers[0];
  // A guest browses as a client of the demo house: its branches and price
  // lists are public, and booking itself still asks them to sign in.
  const retailerId =
    primaryCustomer?.retailerId ??
    (session.isGuest ? await getGuestRetailerId() : null);
  // Some of the house's tables are readable to clients only; a guest simply
  // sees those sections without their prices rather than an error.
  const guestSafe = <T,>(read: Promise<T>, fallback: T): Promise<T> =>
    session.isGuest ? read.catch(() => fallback) : read;
  const bookingPrefill = primaryCustomer
    ? await resolveBookingPrefill(
        supabase,
        primaryCustomer.id,
        resolvedSearchParams,
      )
    : null;
  // A guest cannot list every branch, but may read the published ones, so
  // the location pill works signed in or not.
  const listedBranches = retailerId
    ? await guestSafe(branchRepo.listByRetailer(retailerId), [])
    : [];
  const bookableBranches: readonly BookableBranch[] = (
    listedBranches.length > 0 || !retailerId
      ? listedBranches
      : await branchRepo
          .findPublishedByRetailer(retailerId)
          .catch(() => [] as typeof listedBranches)
  ).map((branch) => ({
    id: branch.id,
    name: branch.name,
    openingHours: branch.openingHours,
    timezone: branch.timezone,
    ...(branch.addressLine1 ? { address: branch.addressLine1 } : {}),
    ...(branch.latitude !== null ? { latitude: branch.latitude } : {}),
    ...(branch.longitude !== null ? { longitude: branch.longitude } : {}),
  }));

  let operationsByService: Record<
    PaidCareServiceKind,
    readonly PricedOperation[]
  > = { dry_cleaning: [], shoe_repair: [], alteration: [] };
  if (retailerId) {
    // A guest cannot read price lists under RLS (they are for the house's
    // clients and staff), but the booker needs them to show what things
    // cost before sign-in. For a guest, and only for the guest house, the
    // server reads the published labels and prices with the service client;
    // nothing else from those tables reaches the page.
    const priceClient = session.isGuest ? getSupabaseAdminClient() : supabase;
    const priceRepo = new PaidCareServicePriceRepository(priceClient);
    const [dryCleaning, shoeRepair, catalogue] = await Promise.all([
      guestSafe(priceRepo.findForRetailer(retailerId, "dry_cleaning"), []),
      guestSafe(priceRepo.findForRetailer(retailerId, "shoe_repair"), []),
      guestSafe<Awaited<
        ReturnType<AlterationCatalogueRepository["findForRetailer"]>
      > | null>(
        new AlterationCatalogueRepository(priceClient).findForRetailer(
          retailerId,
        ),
        null,
      ),
    ]);
    operationsByService = {
      dry_cleaning: dryCleaning.map((price) => ({
        code: price.operationCode,
        label: price.label,
        amountMinorUnits: price.amountMinorUnits,
        currency: price.currency,
      })),
      shoe_repair: shoeRepair.map((price) => ({
        code: price.operationCode,
        label: price.label,
        amountMinorUnits: price.amountMinorUnits,
        currency: price.currency,
      })),
      alteration: (catalogue?.operations ?? [])
        .filter((op) => op.enabled && op.effectivePrice)
        .map((op) => ({
          code: op.code,
          label: op.name,
          amountMinorUnits: op.effectivePrice!.amountMinorUnits,
          currency: op.effectivePrice!.currency,
        })),
    };
  }
  const appointmentYear = buildAppointmentYear(
    new Date(Math.max(Date.now(), TIMELINE_LAUNCH.getTime())),
  );

  const weddingPartyRepo = new WeddingPartyRepository(supabase);
  const tailoringParties = primaryCustomer
    ? await weddingPartyRepo.findByCustomer(primaryCustomer.id)
    : [];
  // Only a party this client organizes opens the organizer's controls; one
  // they merely belong to is reached through its invite link instead.
  const tailoringParty =
    tailoringParties.find(
      (party) => party.organizerCustomerId === primaryCustomer?.id,
    ) ?? null;
  const tailoringPartyMembers = tailoringParty
    ? await weddingPartyRepo.findMembers(tailoringParty.id)
    : [];
  // A guest is "You"; a signed-in client is shown by name.
  // A guest is "You"; a signed-in client is shown by name.
  const tailoringPartyCenterName = primaryCustomer?.fullName ?? "You";
  // The organizer's booked party fitting: their next live appointment whose
  // notes lead with the party marker the planner writes.
  const tailoringPartyBooking: TailoringPartyBooking | null = primaryCustomer
    ? await new AppointmentRepository(supabase)
        .findByCustomer(primaryCustomer.id)
        .then((appointments) => {
          const found = appointments
            .filter(
              (appointment) =>
                !["completed", "canceled", "no_show"].includes(
                  appointment.status,
                ) &&
                Date.parse(appointment.startsAt) >= Date.now() &&
                (appointment.notes ?? "").includes("Tailoring party"),
            )
            .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0];
          return found
            ? {
                appointmentId: found.id,
                startsAt: found.startsAt,
                ...(found.branchId ? { branchId: found.branchId } : {}),
                ...(found.notes ? { notes: found.notes } : {}),
              }
            : null;
        })
        .catch(() => null)
    : null;

  // Arriving from a party invite (/appointments?party=<token>): the party as
  // its organizer set it up, read through the public preview function.
  const partyToken =
    typeof resolvedSearchParams.party === "string"
      ? resolvedSearchParams.party
      : null;
  const tailoringPartyInvite: TailoringPartyInvite | null = partyToken
    ? await weddingPartyRepo
        .previewInvite(partyToken)
        .then((preview) => ({
          token: partyToken,
          retailerName: preview.retailerName,
          ...(preview.eventDate ? { eventDate: preview.eventDate } : {}),
          ...(preview.eventTime ? { eventTime: preview.eventTime } : {}),
          ...(preview.venueName ? { venueName: preview.venueName } : {}),
          ...(preview.fittingLocation
            ? { fittingLocation: preview.fittingLocation }
            : {}),
        }))
        .catch(() => null)
    : null;

  // The organizer is the centre of the orbit, never one of their own guests.
  const tailoringPartyMemberSlots: TailoringPartyMember[] =
    tailoringPartyMembers
      .filter((member) => member.customerId !== primaryCustomer?.id)
      .map((member) => ({
        name: member.name,
        status: member.fittingStatus,
        ...(member.attendance === "declined" || member.attendance === "rebooked"
          ? { attendance: member.attendance }
          : {}),
        ...(member.photoUrl ? { photoUrl: member.photoUrl } : {}),
      }));
  return (
    <div className="customer-page appointment-fit flex flex-col gap-6 bg-black text-white">
      {primaryCustomer && bookingPrefill ? (
        <BookAppointmentLauncher
          retailerId={primaryCustomer.retailerId}
          branches={bookableBranches}
          autoOpen
          initialReason={bookingPrefill.initialReason}
          purpose={bookingPrefill.purpose}
          {...(bookingPrefill.wardrobeItemId
            ? { wardrobeItemId: bookingPrefill.wardrobeItemId }
            : {})}
          {...(bookingPrefill.roadmapGapId
            ? { roadmapGapId: bookingPrefill.roadmapGapId }
            : {})}
          className="appointment-prefill-launcher"
        />
      ) : null}

      {retailerId ? (
        <section
          className="appointment-quick-book"
          aria-label="Quick book"
          // 12px page padding + 42 + the section's 6px puts the bar's top on
          // the Store / Wardrobe switch's top, 60px down.
          style={{ marginTop: "42px" }}
        >
          <QuickBookBar retailerId={retailerId} branches={bookableBranches} />
        </section>
      ) : null}

      {tailoringPartyInvite ? (
        <TailoringPartyInvitee
          invite={tailoringPartyInvite}
          isGuest={session.isGuest}
        />
      ) : null}

      {retailerId ? (
        <section
          className="appointment-care-actions"
          aria-label="Garment care services"
        >
          <h2
            className="appointment-care-heading"
            style={{
              margin: "0 0 9px",
              color: "rgba(244, 242, 236, 0.5)",
              fontFamily: "GTBold3, Arial, sans-serif",
              fontSize: 7,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            High Maintenance
          </h2>
          <PaidCareLauncher
            retailerId={retailerId}
            operationsByService={operationsByService}
            isGuest={session.isGuest}
          />
        </section>
      ) : null}

      {retailerId ? (
        <section
          className="appointment-idea-carousel-section"
          aria-label="Appointment ideas"
        >
          <AppointmentIdeaCarousel
            retailerId={retailerId}
            branches={bookableBranches}
          />
        </section>
      ) : null}

      {retailerId ? (
        /* The timeline inside this section is pinned to the bottom of
           whatever height is left, so its cards end on the Visit in-store
           button's line — the wedding party entry point below it sits
           outside that pinned layout, as its own block. */
        <section className="appointment-timeline-section">
          <AppointmentMonthCarousel
            retailerId={retailerId}
            branches={bookableBranches}
            months={appointmentYear}
          />
        </section>
      ) : null}

      {retailerId && !tailoringPartyInvite ? (
        <section
          className="appointment-tailoring-party-section"
          aria-label="Tailoring party planning"
        >
          <h2
            className="appointment-care-heading"
            style={{
              margin: "0 0 9px",
              color: "rgba(244, 242, 236, 0.5)",
              fontFamily: "GTBold3, Arial, sans-serif",
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Tailoring Party
          </h2>
          <p
            style={{
              margin: "0 0 20px",
              color: "rgba(244, 242, 236, 0.55)",
              fontSize: "13px",
              maxWidth: "420px",
            }}
          >
            A wedding, a milestone birthday, or just a fitting with the crew —
            invite the people getting suited up alongside you.
          </p>
          <TailoringPartyPlanner
            href={
              tailoringParty
                ? `/wedding-parties/${tailoringParty.id}`
                : "/wedding-parties/new"
            }
            retailerId={retailerId}
            partyId={tailoringParty?.id ?? null}
            centerName={tailoringPartyCenterName}
            members={tailoringPartyMemberSlots}
            branches={bookableBranches}
            booking={tailoringPartyBooking}
            inviteToken={tailoringParty?.inviteToken ?? null}
            isGuest={session.isGuest}
          />
        </section>
      ) : null}
    </div>
  );
}
