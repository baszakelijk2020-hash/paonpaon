import {
  AppointmentRepository,
  type CustomerRepository,
  RetailerRepository,
} from "@paon/database";
import { Suspense } from "react";

import { LocalWidgets } from "../morning-routine/local-widgets";
import { buildVariantIdByProductSlug } from "../wishlist/favorites-map";
import {
  MergeFavorites,
  type FavoritesHouse,
} from "../wishlist/merge-favorites";

import { ClockCard } from "./clock-card";
import { OutfitBreakdown } from "./outfit-breakdown";
import { AirCard, SunCard, WindCard } from "./sky-cards";
import { HighlightCard, WelcomeCard } from "./welcome-card";
import { WorldClock } from "./world-clock";

import { getCustomersForUser } from "@/lib/customer-context";
import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

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
  const session = await getSession();
  if (!session || session.accountType !== "customer") return null;

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
  const firstName =
    primary?.customer.fullName.trim().split(/\s+/)[0] ?? "there";

  return (
    <div className="paon-overview">
      <Suspense fallback={null}>
        <DashboardFavorites relationships={relationships} supabase={supabase} />
      </Suspense>
      <div className="paon-overview-shell">
        <div className="paon-overview-stats">
          {/* Three tiles: the day (time, date), the sky (weather, sun, air,
              wind), the commute. */}
          <ClockCard />
          <LocalWidgets
            variant="dashboard"
            skyExtras={
              <>
                <SunCard />
                <AirCard />
                <WindCard />
              </>
            }
          />
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
    </div>
  );
}
