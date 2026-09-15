import {
  AlterationCatalogueRepository,
  AppointmentRepository,
  PaidCareServicePriceRepository,
  RetailerBranchRepository,
  RetailerRepository,
  WardrobeRepository,
  WardrobeRoadmapRepository,
} from "@paon/database";
import {
  APPOINTMENT_TYPE_LABELS,
  type PaidCareServiceKind,
} from "@paon/domain";
import { formatDate } from "@paon/utils";
import Link from "next/link";
import type { CSSProperties } from "react";
import { z } from "zod";

import { RelatedLinks } from "../related-links";

import { BookAppointmentLauncher } from "./book-appointment-launcher";
import type { BookableBranch } from "./booking-flow";
import { APPOINTMENT_REASONS } from "./booking-reasons";
import type { PricedOperation } from "./paid-care-flow";
import { PaidCareLauncher } from "./paid-care-launcher";
import { AppointmentStatusBadge } from "./status-badge";

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
    title: "Wardrobe Reset",
    copy: "Review fit, condition and the pieces that should lead the new year.",
    accent: "#a79a86",
  },
  {
    title: "Spring/Summer Preview",
    copy: "Choose lighter cloth and set the season's wardrobe before warmth arrives.",
    accent: "#aeb7a0",
  },
  {
    title: "Transitional Tailoring",
    copy: "Tune layers, weight and colour for changeable early-spring days.",
    accent: "#829192",
  },
  {
    title: "Summer Holiday",
    copy: "Plan linen, holiday tailoring and the pieces that earn a place in the case.",
    accent: "#b7aa84",
  },
  {
    title: "Wedding & Occasion",
    copy: "Prepare formal looks early, from ceremony tailoring to evening details.",
    accent: "#a79691",
  },
  {
    title: "Linen & Travel",
    copy: "Build a breathable, crease-conscious wardrobe for work and weekends away.",
    accent: "#c0ad87",
  },
  {
    title: "Midseason Fit Check",
    copy: "Reassess fit and refresh the hardworking pieces already in rotation.",
    accent: "#8f877b",
  },
  {
    title: "Autumn Preview",
    copy: "Reserve new-season cloth and decide which cooler-weather gaps to fill.",
    accent: "#8d765e",
  },
  {
    title: "Fall/Winter Wardrobe",
    copy: "Plan cloth, coats and the pieces the colder season will ask of you.",
    accent: "#726653",
  },
  {
    title: "Outerwear & Layering",
    copy: "Balance coats, knitwear and tailoring before temperatures settle.",
    accent: "#66706a",
  },
  {
    title: "Holiday Season",
    copy: "Prepare evening, festive and dinner looks before invitations arrive.",
    accent: "#76544d",
  },
  {
    title: "Festive & Black Tie",
    copy: "Finish the year with black tie, polished accessories and assured fit.",
    accent: "#786f82",
  },
] as const;

function buildRollingAppointmentYear(from: Date) {
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(from.getFullYear(), from.getMonth() + index, 1);
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
  const appointmentRepo = new AppointmentRepository(supabase);
  const retailerRepo = new RetailerRepository(supabase);
  const branchRepo = new RetailerBranchRepository(supabase);

  const appointmentsByCustomer = await Promise.all(
    customers.map((customer) => appointmentRepo.findByCustomer(customer.id)),
  );
  const appointments = appointmentsByCustomer
    .flat()
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const retailers = await Promise.all(
    appointments.map((appointment) =>
      retailerRepo.findById(appointment.retailerId),
    ),
  );

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
  const now = Date.now();
  const upcoming = appointments.find(
    (appointment) =>
      !["completed", "canceled", "no_show"].includes(appointment.status) &&
      new Date(appointment.startsAt).getTime() >= now,
  );
  const history = appointments.filter(
    (appointment) => appointment.id !== upcoming?.id,
  );
  const retailerById = new Map(
    appointments.map((appointment, index) => [
      appointment.id,
      retailers[index],
    ]),
  );
  const formatTime = (iso: string) =>
    formatDate(iso, "en-US", { hour: "numeric", minute: "2-digit" });
  const formatRange = (startsAt: string, endsAt: string) =>
    `${formatTime(startsAt)}–${formatTime(endsAt)}`;
  const appointmentYear = buildRollingAppointmentYear(new Date());

  return (
    <div className="customer-page flex flex-col gap-6 bg-black pb-12 text-white">
      <header className="pe-page-head items-end gap-6 pb-3">
        <div>
          <p className="customer-kicker mb-2 text-white/55">
            Visits, fittings and garment care
          </p>
          <h1 className="font-display text-5xl font-semibold leading-none tracking-[-0.055em] text-white sm:text-6xl">
            Appointments
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-white/60">
            Plan your next visit, book paid care, and keep every past fitting
            close.
          </p>
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
          <RelatedLinks links={[{ href: "/concierge", label: "Concierge" }]} />
        </div>
      </header>

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
          className="appointment-year"
          aria-labelledby="appointment-year-title"
        >
          <div className="appointment-year-heading">
            <h2 id="appointment-year-title">Your next 12 months</h2>
            <p>One useful atelier visit for every month ahead.</p>
          </div>
          <div className="appointment-year-grid">
            {appointmentYear.map((month) => (
              <div
                key={month.id}
                className="appointment-month-cell"
                data-appointment-month={month.month}
              >
                <BookAppointmentLauncher
                  retailerId={primaryCustomer.retailerId}
                  branches={bookableBranches}
                  initialReason="in_the_mood_for_something_fresh"
                  purpose={`${month.title} Appointment`}
                  initialMonth={month.month}
                  className="appointment-month-launcher"
                  style={
                    { "--appointment-accent": month.accent } as CSSProperties
                  }
                >
                  <span className="appointment-month-topline">
                    <span className="appointment-month-name">
                      {month.monthName}
                    </span>
                    <span
                      className="appointment-month-number"
                      aria-hidden="true"
                    >
                      {month.monthNumber}
                    </span>
                  </span>
                  <span className="appointment-month-year">{month.year}</span>
                  <span className="appointment-month-title">{month.title}</span>
                  <span className="appointment-month-copy">{month.copy}</span>
                  <span className="appointment-month-cta">Book visit →</span>
                </BookAppointmentLauncher>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {upcoming ? (
        <section
          className="pe-card pe-card-blue relative overflow-hidden rounded-[32px] bg-[#aed6e7] p-7 text-[#181818] sm:p-9"
          data-pe-card
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="customer-kicker text-[#181818]/60">
                Next appointment
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-[#181818]">
                {APPOINTMENT_TYPE_LABELS[upcoming.type]}
              </h2>
              <p className="mt-2 text-[#181818]/70">
                {retailerById.get(upcoming.id)?.displayName ??
                  "Unknown retailer"}
              </p>
            </div>
            <AppointmentStatusBadge status={upcoming.status} />
          </div>
          <p className="mt-8 text-base text-[#181818]/70">
            {formatDate(upcoming.startsAt, "en-US")} ·{" "}
            {formatRange(upcoming.startsAt, upcoming.endsAt)}
          </p>
          <Link
            href={`/appointments/${upcoming.id}`}
            className="customer-button mt-6 inline-flex"
          >
            View appointment
          </Link>
        </section>
      ) : primaryCustomer ? (
        <section className="pe-card" data-pe-card>
          <p className="customer-kicker">Next appointment</p>
          <h2 className="mt-2">Your calendar is open.</h2>
          <p className="mt-1 max-w-xl">
            Book a fitting, styling appointment, or seasonal wardrobe review —
            the button above, or pick a season from the plan.
          </p>
        </section>
      ) : (
        <div
          className="pe-card rounded-[32px] bg-[#191b1d] px-6 py-16 text-center"
          data-pe-card
        >
          <p className="text-white/60">No retailer connection yet.</p>
        </div>
      )}

      {history.length > 0 ? (
        <details
          className="pe-card overflow-hidden rounded-[32px] bg-[#191b1d] text-white"
          data-pe-card
        >
          <summary className="cursor-pointer list-none px-7 py-6 text-2xl font-semibold tracking-[-0.025em] text-white">
            Appointment history ({history.length})
          </summary>
          <div className="divide-y divide-white/10 bg-[#191b1d]">
            {history.map((appointment) => (
              <Link
                key={appointment.id}
                href={`/appointments/${appointment.id}`}
                className="customer-list-row flex flex-wrap items-center justify-between gap-3 px-6 py-4"
              >
                <div className="min-w-0">
                  <p className="font-medium text-white">
                    {APPOINTMENT_TYPE_LABELS[appointment.type]}
                  </p>
                  <p className="text-sm text-white/55">
                    {retailerById.get(appointment.id)?.displayName ??
                      "Unknown retailer"}{" "}
                    · {formatDate(appointment.startsAt, "en-US")} ·{" "}
                    {formatRange(appointment.startsAt, appointment.endsAt)}
                  </p>
                </div>
                <AppointmentStatusBadge status={appointment.status} />
              </Link>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
