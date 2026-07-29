import {
  CustomerRepository,
  MorningRoutineDeliveryRepository,
  MorningRoutineRepository,
  RetailerRepository,
} from "@paon/database";

import { MorningRoutineDeliverySettingsPanel } from "./delivery-settings-panel";
import { MorningRoutinePanel } from "./routine-panel";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

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

  const groups = await Promise.all(
    customers.map(async (customer) => {
      const retailer = await retailerRepo.findById(customer.retailerId);
      const latest = await routineRepo.findLatestForCustomerDay(
        customer.id,
        forDate,
      );
      const subscription = await deliveryRepo.findSubscription(
        customer.retailerId,
        customer.id,
      );
      return { customer, retailer, latest, subscription };
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
          MorningRoutine
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Daily owned-first recommendations with weather, calendar, and
          StyleProfile inputs when consented — every pick explains itself.
        </p>
      </div>

      {groups.length === 0 ? (
        <div
          className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-stone-300)] px-6 py-16 text-center"
          role="status"
        >
          <p className="text-[var(--color-stone-600)]">
            No house connections yet.
          </p>
        </div>
      ) : (
        groups.map(({ customer, retailer, latest, subscription }) => (
          <div key={customer.id} className="flex flex-col gap-4">
            <MorningRoutineDeliverySettingsPanel
              retailerId={customer.retailerId}
              customerId={customer.id}
              subscription={
                subscription
                  ? {
                      deliveryOptIn: subscription.deliveryOptIn,
                      frequency: subscription.frequency,
                      channels: subscription.channels,
                      timezone: subscription.timezone,
                      deliveryHourLocal: subscription.deliveryHourLocal,
                      quietStartHour: subscription.quietStartHour,
                      quietEndHour: subscription.quietEndHour,
                      weeklyAnchorDow: subscription.weeklyAnchorDow,
                      ...(subscription.unsubscribedAt
                        ? { unsubscribedAt: subscription.unsubscribedAt }
                        : {}),
                    }
                  : null
              }
            />
            <MorningRoutinePanel
              key={customer.id}
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
                          explanation: recommendation.explanation,
                          actions: recommendation.actions,
                        }),
                      ),
                    }
                  : null
              }
            />
          </div>
        ))
      )}
    </div>
  );
}
