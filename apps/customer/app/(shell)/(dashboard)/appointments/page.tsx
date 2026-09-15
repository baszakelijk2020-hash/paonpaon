import {
  AlterationCatalogueRepository,
  PaidCareServicePriceRepository,
  RetailerBranchRepository,
  WardrobeRepository,
  WardrobeRoadmapRepository,
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

import { getCustomersForUser } from "@/lib/customer-context";
import { requireSession } from "@/lib/session";
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
    title: "Fall/Winter Wardrobe",
    copy: "Plan cloth, coats and the colder season's essentials.",
    accent: "#8d765e",
  },
  {
    title: "Winter Coat Shopping",
    copy: "Choose outerwear for comfort and style.",
    accent: "#726653",
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

function buildAppointmentYear(from: Date): AppointmentYearMonth[] {
  const currentMonth = from.getMonth();
  const cycleStartMonth = Math.floor(currentMonth / 3) * 3;
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(from.getFullYear(), cycleStartMonth + index, 1);
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
      isPast: date < new Date(from.getFullYear(), currentMonth, 1),
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
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const resolvedSearchParams = await searchParams;

  const customers = await getCustomersForUser(session.userId);
  const branchRepo = new RetailerBranchRepository(supabase);

  const primaryCustomer = customers[0];
  const bookingPrefill = primaryCustomer
    ? await resolveBookingPrefill(
        supabase,
        primaryCustomer.id,
        resolvedSearchParams,
      )
    : null;
  const bookableBranches: readonly BookableBranch[] = primaryCustomer
    ? (await branchRepo.listByRetailer(primaryCustomer.retailerId)).map(
        (branch) => ({
          id: branch.id,
          name: branch.name,
          openingHours: branch.openingHours,
        }),
      )
    : [];

  let operationsByService: Record<
    PaidCareServiceKind,
    readonly PricedOperation[]
  > = { dry_cleaning: [], shoe_repair: [], alteration: [] };
  if (primaryCustomer) {
    const priceRepo = new PaidCareServicePriceRepository(supabase);
    const [dryCleaning, shoeRepair, catalogue] = await Promise.all([
      priceRepo.findForRetailer(primaryCustomer.retailerId, "dry_cleaning"),
      priceRepo.findForRetailer(primaryCustomer.retailerId, "shoe_repair"),
      new AlterationCatalogueRepository(supabase).findForRetailer(
        primaryCustomer.retailerId,
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
      alteration: catalogue.operations
        .filter((op) => op.enabled && op.effectivePrice)
        .map((op) => ({
          code: op.code,
          label: op.name,
          amountMinorUnits: op.effectivePrice!.amountMinorUnits,
          currency: op.effectivePrice!.currency,
        })),
    };
  }
  const appointmentYear = buildAppointmentYear(new Date());

  return (
    <div className="customer-page appointment-fit flex flex-col gap-6 bg-black text-white">
      <header className="pe-page-head items-end gap-3 pb-2">
        <div>
          <h1 className="font-display text-4xl font-semibold leading-none tracking-[-0.055em] text-white">
            Appointments
          </h1>
        </div>
        <div className="flex flex-wrap gap-3">
          {primaryCustomer ? (
            <BookAppointmentLauncher
              retailerId={primaryCustomer.retailerId}
              branches={bookableBranches}
              {...(bookingPrefill
                ? {
                    autoOpen: true,
                    initialReason: bookingPrefill.initialReason,
                    purpose: bookingPrefill.purpose,
                    ...(bookingPrefill.wardrobeItemId
                      ? { wardrobeItemId: bookingPrefill.wardrobeItemId }
                      : {}),
                    ...(bookingPrefill.roadmapGapId
                      ? { roadmapGapId: bookingPrefill.roadmapGapId }
                      : {}),
                  }
                : {})}
            />
          ) : null}
        </div>
      </header>

      {primaryCustomer ? (
        <section className="appointment-quick-book" aria-label="Quick book">
          <QuickBookBar
            retailerId={primaryCustomer.retailerId}
            branches={bookableBranches}
          />
        </section>
      ) : null}

      {primaryCustomer ? (
        <section
          className="appointment-care-actions"
          aria-label="Garment care services"
        >
          <PaidCareLauncher
            retailerId={primaryCustomer.retailerId}
            operationsByService={operationsByService}
          />
        </section>
      ) : null}

      {primaryCustomer ? (
        <section
          className="appointment-idea-carousel-section"
          aria-label="Appointment ideas"
        >
          <AppointmentIdeaCarousel
            retailerId={primaryCustomer.retailerId}
            branches={bookableBranches}
          />
        </section>
      ) : null}

      {primaryCustomer ? (
        <section className="min-h-0 flex-1">
          <AppointmentMonthCarousel
            retailerId={primaryCustomer.retailerId}
            branches={bookableBranches}
            months={appointmentYear}
          />
        </section>
      ) : null}
    </div>
  );
}
