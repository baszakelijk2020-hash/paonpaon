import {
  CustomerFactRepository,
  MorningRoutineRepository,
  RetailerRepository,
} from "@paon/database";
import { selectUpcomingOccasions } from "@paon/domain";

import { CompleteTheLookCard } from "./complete-the-look-card";
import { buildCompleteTheLookSuggestions } from "./complete-the-look-data";
import { MorningRoutinePanel } from "./routine-panel";
import { UpcomingOccasionsCard } from "./upcoming-occasions-card";

import { getCustomersForUser } from "@/lib/customer-context";
import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const UPCOMING_OCCASION_LEAD_DAYS = 45;

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * The morning routine itself — occasions, the daily edit, delivery
 * preferences and complete-the-look — for every house the customer is
 * connected to.
 *
 * Extracted from morning-routine/page.tsx so the Overview tab can show the
 * same sections rather than only the 100px local-context strip and the daily
 * look hero. One component, two mount points; no duplicated queries or
 * drifting markup.
 */
export async function RoutineSections() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const forDate = todayUtcDate();

  const customers = await getCustomersForUser(session.userId);
  const retailerRepo = new RetailerRepository(supabase);
  const routineRepo = new MorningRoutineRepository(supabase);
  const factRepo = new CustomerFactRepository(supabase);

  const groups = await Promise.all(
    customers.map(async (customer) => {
      const retailer = await retailerRepo.findById(customer.retailerId);
      const latest = await routineRepo.findLatestForCustomerDay(
        customer.id,
        forDate,
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
        upcomingOccasions,
        completeTheLookSuggestions,
      };
    }),
  );

  if (groups.length === 0) {
    return (
      <div className="customer-panel px-6 py-16 text-center" role="status">
        <p className="text-[var(--color-stone-600)]">
          No house connections yet.
        </p>
      </div>
    );
  }

  return (
    <>
      {groups.map(
        ({
          customer,
          retailer,
          latest,
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
              oneClickCheckoutStatus={customer.oneClickCheckoutStatus}
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
            <CompleteTheLookCard
              retailerId={customer.retailerId}
              suggestions={completeTheLookSuggestions}
            />
          </div>
        ),
      )}
    </>
  );
}
