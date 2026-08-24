import {
  CustomerFactRepository,
  CustomerRepository,
  MorningRoutineDeliveryRepository,
  MorningRoutineRepository,
  RetailerRepository,
} from "@paon/database";
import { selectUpcomingOccasions } from "@paon/domain";

import { RelatedLinks } from "../related-links";

import { CompleteTheLookCard } from "./complete-the-look-card";
import { buildCompleteTheLookSuggestions } from "./complete-the-look-data";
import { MorningRoutineDeliveryPanel } from "./delivery-panel";
import { LocalWidgets } from "./local-widgets";
import { MorningRoutinePanel } from "./routine-panel";
import { UpcomingOccasionsCard } from "./upcoming-occasions-card";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const UPCOMING_OCCASION_LEAD_DAYS = 45;

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function MorningRoutinePage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const forDate = todayUtcDate();

  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const retailerRepo = new RetailerRepository(supabase);
  const routineRepo = new MorningRoutineRepository(supabase);
  const deliveryRepo = new MorningRoutineDeliveryRepository(supabase);
  const factRepo = new CustomerFactRepository(supabase);

  const groups = await Promise.all(
    customers.map(async (customer) => {
      const retailer = await retailerRepo.findById(customer.retailerId);
      const latest = await routineRepo.findLatestForCustomerDay(
        customer.id,
        forDate,
      );
      const subscription = await deliveryRepo.findSubscriptionByCustomer(
        customer.id,
      );
      const facts = await factRepo.listForCustomer(
        customer.retailerId,
        customer.id,
      );
      const upcomingOccasions = selectUpcomingOccasions({
        facts: facts.map((fact) => ({
          factId: fact.id,
          factType: fact.factType,
          valueLabel: fact.valueLabel,
          ...(fact.valueText ? { valueText: fact.valueText } : {}),
        })),
        todayIso: forDate,
        leadDays: UPCOMING_OCCASION_LEAD_DAYS,
      });
      const completeTheLookSuggestions = await buildCompleteTheLookSuggestions({
        supabase,
        retailerId: customer.retailerId,
        customerId: customer.id,
      });
      return {
        customer,
        retailer,
        latest,
        subscription,
        upcomingOccasions,
        completeTheLookSuggestions,
      };
    }),
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="customer-page-header flex-col items-start sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <p className="customer-kicker">Daily edit</p>
          <h1 className="font-display mt-3 text-4xl leading-none tracking-[-0.045em] text-[var(--customer-ink)] sm:text-5xl">
            Morning routine
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-[var(--color-stone-600)]">
            A considered daily edit shaped by your wardrobe, local conditions,
            and the occasions ahead.
          </p>
        </div>
        <RelatedLinks
          links={[
            { href: "/for-you", label: "For You" },
            { href: "/style-quiz", label: "Style Quiz" },
            { href: "/silhouette-analysis", label: "Silhouette Analysis" },
          ]}
        />
      </header>

      <LocalWidgets />

      {groups.length === 0 ? (
        <div className="customer-panel px-6 py-16 text-center" role="status">
          <p className="text-[var(--color-stone-600)]">
            No house connections yet.
          </p>
        </div>
      ) : (
        groups.map(
          ({
            customer,
            retailer,
            latest,
            subscription,
            upcomingOccasions,
            completeTheLookSuggestions,
          }) => (
            <div key={customer.id} className="flex flex-col gap-4">
              <UpcomingOccasionsCard occasions={upcomingOccasions} />
              <MorningRoutinePanel
                retailerId={customer.retailerId}
                retailerName={retailer?.displayName ?? "Retailer"}
                retailerSlug={retailer?.slug ?? "store"}
                customerId={customer.id}
                forDate={forDate}
                view={
                  latest
                    ? {
                        selectionId: latest.selection.id,
                        summary: latest.selection.summary,
                        reviewStatus: latest.selection.reviewStatus,
                        provenance: latest.selection.provenance,
                        recommendations: latest.recommendations.map(
                          (recommendation) => ({
                            id: recommendation.id,
                            rank: recommendation.rank,
                            source: recommendation.source,
                            displayName: recommendation.displayName,
                            ...(recommendation.categoryCode
                              ? { categoryCode: recommendation.categoryCode }
                              : {}),
                            ...(recommendation.primaryImageUrl
                              ? { imageUrl: recommendation.primaryImageUrl }
                              : {}),
                            ...(recommendation.wardrobeItemId
                              ? { owned: true }
                              : {}),
                            explanation: recommendation.explanation,
                            actions: recommendation.actions,
                          }),
                        ),
                      }
                    : null
                }
              />
              <MorningRoutineDeliveryPanel
                retailerId={customer.retailerId}
                customerId={customer.id}
                subscription={
                  subscription
                    ? {
                        optedIn: subscription.optedIn,
                        frequency: subscription.frequency,
                        timezone: subscription.timezone,
                        preferredLocalHour: subscription.preferredLocalHour,
                        channels: subscription.channels,
                        ...(subscription.quietHours
                          ? {
                              quietStartMinute:
                                subscription.quietHours.startMinute,
                              quietEndMinute: subscription.quietHours.endMinute,
                            }
                          : {}),
                      }
                    : null
                }
              />
              <CompleteTheLookCard
                retailerId={customer.retailerId}
                suggestions={completeTheLookSuggestions}
              />
            </div>
          ),
        )
      )}
    </div>
  );
}
