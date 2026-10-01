import {
  AppointmentRepository,
  type CustomerRepository,
  RetailerRepository,
} from "@paon/database";
import { type CSSProperties, Suspense } from "react";

import { LocalWidgets } from "../morning-routine/local-widgets";
import { buildVariantIdByProductSlug } from "../wishlist/favorites-map";
import {
  MergeFavorites,
  type FavoritesHouse,
} from "../wishlist/merge-favorites";

import { AnalogueClock } from "./analogue-clock";
import { ClockCard } from "./clock-card";
import { FitCopy } from "./fit-copy";
import { HIGHLIGHT } from "./highlight";
import { MorningRoutineVisualRoot } from "./morning-routine-visual-root";
import { OutfitBreakdown } from "./outfit-breakdown";
import { PearlLight } from "./pearl-light";
import { AirCard, SunCard } from "./sky-cards";
import { HighlightCard, WelcomeCard } from "./welcome-card";
import { WorldClock } from "./world-clock";
import "./morning-cards.css";

import { getCustomersForUser } from "@/lib/customer-context";
import { getViewerSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Which overview to render.
 *
 * "original" — the design as of 12 September 2026: three stat tiles across
 *   the top, the OOTD photo beside the greeting and outfit list, the world
 *   clock full width beneath. Kept whole, markup and CSS, so it can be
 *   switched back to by changing this one value.
 *
 * "morning" — every part a separate card on one responsive grid: the
 *   readings, the greeting, the world clock, the OOTD photo, the pieces, the
 *   delivery and fitting, and the total. Three columns filling the window
 *   when they fit; two, then one, stacking and scrolling when they do not.
 */
const OVERVIEW_LAYOUT: "original" | "morning" = "morning";

function SkyExtras() {
  return (
    <>
      <SunCard />
      <AirCard />
    </>
  );
}

function OverviewOriginal({ firstName }: { firstName: string }) {
  return (
    <div className="paon-overview-shell">
      <div className="paon-overview-stats">
        {/* Three tiles: the day (time, date), the sky (weather, sun, air,
            wind), the commute. */}
        <ClockCard />
        <LocalWidgets variant="dashboard" skyExtras={<SkyExtras />} />
      </div>
      <div className="paon-overview-hero">
        <HighlightCard />
        <div className="paon-overview-hero-side">
          <WelcomeCard firstName={firstName} />
          <OutfitBreakdown />
        </div>
      </div>
      {/* Below the hero, not inside its right-hand column: that column is
          pinned to the OOTD image's height so the outfit card can finish on
          the same line, and the world clock inside it squeezed the outfit
          to nothing. */}
      <WorldClock />
    </div>
  );
}

function OverviewMorning({ firstName }: { firstName: string }) {
  return (
    /* The side columns paint themselves from this image's own edge pixels,
       so the ground matches whatever photograph the day's look is. */
    <div
      className="paon-morning paon-morning-cards"
      style={
        {
          "--paon-ootd-image": `url(${HIGHLIGHT.image})`,
        } as CSSProperties
      }
    >
      {/* Every part below is its own card on one responsive grid
          (morning-cards.css): the section wrappers are dissolved there, so
          the readings, the greeting, the world clock, the photograph and the
          outfit's three parts each move and resize on their own. */}
      <section className="paon-morning-hello" aria-label="Good morning">
        {/* The readings: the watch with the time and date beside it, then
            the weather, the drive and the sky. */}
        <div className="paon-morning-readings">
          <AnalogueClock size={72} />
          <LocalWidgets variant="dashboard" skyExtras={<SkyExtras />} />
          <ClockCard />
        </div>
        <WelcomeCard firstName={firstName} />
        {/* Sizes the greeting to exactly fill the space it is left. */}
        <FitCopy
          selector=".paon-overview-morning .paon-welcome-copy"
          trimPx={0}
        />
        <WorldClock />
      </section>
      <section className="paon-morning-ootd" aria-label="Today’s outfit">
        <HighlightCard />
      </section>
      {/* The outfit splits itself into three cards: the pieces, the delivery
          and fitting, and the total with its actions. */}
      <section className="paon-morning-pieces" aria-label="The pieces">
        <OutfitBreakdown />
      </section>
      {/* The pearl surfaces — the watch face, the chosen card, Add to Bag —
          catch the light as the pointer moves. */}
      <PearlLight />
    </div>
  );
}

async function DashboardFavorites({
  relationships,
  supabase,
}: {
  relationships: Array<{
    customer: Awaited<
      ReturnType<InstanceType<typeof CustomerRepository>["findByUserId"]>
    >[number];
    retailer: Awaited<
      ReturnType<InstanceType<typeof RetailerRepository>["findById"]>
    >;
    nextAppointment:
      | Awaited<
          ReturnType<
            InstanceType<typeof AppointmentRepository>["findByCustomer"]
          >
        >[number]
      | undefined;
  }>;
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>;
}) {
  const favorites: FavoritesHouse[] = await Promise.all(
    relationships.flatMap(({ retailer }) =>
      retailer
        ? [
            (async () => ({
              slug: retailer.slug,
              retailerId: retailer.id,
              variantIdByProductSlug: await buildVariantIdByProductSlug(
                supabase,
                retailer.id,
              ),
            }))(),
          ]
        : [],
    ),
  );
  return <MergeFavorites houses={favorites} />;
}

export default async function DashboardPage() {
  const session = await getViewerSession();

  const supabase = await getSupabaseServerClient();
  const customers = await getCustomersForUser(session.userId);
  const retailerRepo = new RetailerRepository(supabase);
  const appointmentRepo = new AppointmentRepository(supabase);
  const relationships = await Promise.all(
    customers.map(async (customer) => {
      const [retailer, appointments] = await Promise.all([
        retailerRepo.findById(customer.retailerId),
        appointmentRepo.findByCustomer(customer.id),
      ]);
      const now = Date.now();
      const nextAppointment = appointments
        .filter(
          (appointment) =>
            !["completed", "canceled", "no_show"].includes(
              appointment.status,
            ) && new Date(appointment.startsAt).getTime() >= now,
        )
        .sort(
          (a, b) =>
            new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
        )[0];
      return { customer, retailer, nextAppointment };
    }),
  );

  const primary = relationships[0];
  /* A guest is greeted without a name. */
  const firstName = session.isGuest
    ? ""
    : (primary?.customer.fullName.trim().split(/\s+/)[0] ?? "there");

  return (
    <div
      className={[
        "paon-overview",
        OVERVIEW_LAYOUT === "morning" ? "paon-overview-morning" : "",
      ].join(" ")}
    >
      <Suspense fallback={null}>
        <DashboardFavorites relationships={relationships} supabase={supabase} />
      </Suspense>
      {OVERVIEW_LAYOUT === "morning" ? (
        <MorningRoutineVisualRoot>
          <OverviewMorning firstName={firstName} />
        </MorningRoutineVisualRoot>
      ) : (
        <OverviewOriginal firstName={firstName} />
      )}
    </div>
  );
}
