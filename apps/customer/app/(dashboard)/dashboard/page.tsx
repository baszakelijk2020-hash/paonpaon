import {
  AppointmentRepository,
  CustomerRepository,
  ProductVariantRepository,
  RetailerRepository,
} from "@paon/database";
import { asId } from "@paon/domain";
import { formatMoney } from "@paon/utils";
import { Suspense } from "react";

import { ensureTodaysMorningRoutineSelection } from "../morning-routine/generation";
import { LocalWidgets } from "../morning-routine/local-widgets";
import { buildVariantIdByProductSlug } from "../wishlist/favorites-map";
import {
  MergeFavorites,
  type FavoritesHouse,
} from "../wishlist/merge-favorites";

import {
  MorningRoutineDashboardHero,
  type HeroPiece,
} from "./morning-routine-hero";

import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
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

async function DashboardDailyLook({
  primary,
  firstName,
  supabase,
}: {
  primary: {
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
  };
  firstName: string;
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>;
}) {
  let dailyLook: {
    featured: HeroPiece;
    selectionId: string;
    weatherSummary?: string;
  } | null = null;

  if (primary?.retailer) {
    const view = await ensureTodaysMorningRoutineSelection({
      supabase,
      retailerId: asId<"RetailerId">(primary.customer.retailerId),
      customerId: asId<"CustomerId">(primary.customer.id),
      forDate: todayUtcDate(),
    });
    const recommendation = view?.recommendations[0];
    if (view && recommendation) {
      const owned = Boolean(recommendation.wardrobeItemId);
      const variant =
        !owned && recommendation.productVariantId
          ? await new ProductVariantRepository(supabase).findById(
              asId<"ProductVariantId">(recommendation.productVariantId),
            )
          : null;
      const buyAction = recommendation.actions.find(
        (action) => action.kind === "buy",
      );
      const saveAction = recommendation.actions.find(
        (action) => action.kind === "save",
      );
      dailyLook = {
        selectionId: view.selection.id,
        ...(view.selection.provenance.weatherSummary
          ? { weatherSummary: view.selection.provenance.weatherSummary }
          : {}),
        featured: {
          id: recommendation.id,
          displayName: recommendation.displayName,
          owned,
          ...(recommendation.primaryImageUrl
            ? { imageUrl: recommendation.primaryImageUrl }
            : {}),
          ...(variant
            ? { priceLabel: formatMoney(variant.price, "en-US") }
            : {}),
          ...(buyAction?.available && buyAction.href
            ? { buyHref: buyAction.href }
            : {}),
          ...(recommendation.productVariantId
            ? { productVariantId: String(recommendation.productVariantId) }
            : {}),
          ...(saveAction?.available && saveAction.productVariantId
            ? { saveVariantId: saveAction.productVariantId }
            : {}),
        },
      };
    }
  }

  return (
    <>
      <LocalWidgets variant="dashboard" />
      {primary?.retailer && dailyLook ? (
        <MorningRoutineDashboardHero
          retailerId={primary.customer.retailerId}
          retailerSlug={primary.retailer.slug}
          customerFirstName={firstName}
          selectionId={dailyLook.selectionId}
          oneTapEligible={primary.customer.shippingAddresses.length > 0}
          featured={dailyLook.featured}
          {...(primary.nextAppointment
            ? {
                nextAppointmentHref: `/appointments/${primary.nextAppointment.id}`,
              }
            : {})}
        />
      ) : (
        <section className="bg-[#ece9e1] px-7 py-16 sm:px-12">
          <p className="customer-kicker text-[#6a6d65]">Outfit of the day</p>
          <h1 className="mt-4 max-w-2xl text-4xl leading-tight sm:text-6xl">
            Your next considered look will appear here.
          </h1>
        </section>
      )}
    </>
  );
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session || session.accountType !== "customer") return null;

  const supabase = await getSupabaseServerClient();
  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
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
    <div className="-mx-4 flex flex-col gap-0 sm:-mx-7 lg:-mx-10 xl:-mx-14">
      <Suspense fallback={null}>
        <DashboardFavorites relationships={relationships} supabase={supabase} />
      </Suspense>
      <Suspense
        fallback={
          <section className="bg-[#ece9e1] px-7 py-16 sm:px-12">
            <p className="customer-kicker text-[#6a6d65]">Outfit of the day</p>
            <h1 className="mt-4 max-w-2xl text-4xl leading-tight sm:text-6xl">
              Your next considered look will appear here.
            </h1>
          </section>
        }
      >
        {primary && (
          <DashboardDailyLook
            primary={primary}
            firstName={firstName}
            supabase={supabase}
          />
        )}
      </Suspense>
    </div>
  );
}
