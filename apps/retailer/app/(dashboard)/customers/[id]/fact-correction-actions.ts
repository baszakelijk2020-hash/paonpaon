"use server";

import {
  CitedRecommendationRepository,
  CustomerFactRepository,
  RetailerStaffRepository,
} from "@paon/database";
import {
  correctionRequiresRecompute,
  CUSTOMER_INTEREST_PROJECTOR_VERSION,
  FOR_YOU_PROJECTOR_VERSION,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function correctCustomerFact(formData: FormData): Promise<void> {
  const session = await requireModuleSession("relationship_intelligence");
  const factId = formData.get("factId");
  const customerId = formData.get("customerId");
  const factType = formData.get("factType");
  const reason = formData.get("reason");
  if (
    typeof factId !== "string" ||
    typeof customerId !== "string" ||
    typeof factType !== "string" ||
    typeof reason !== "string" ||
    reason.trim().length === 0
  ) {
    return;
  }

  const supabase = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  if (!staff) return;

  await new CustomerFactRepository(supabase).markCorrected({
    retailerId: session.retailerId,
    factId,
    staffId: staff.id,
    reason: reason.trim(),
  });

  // Pure recompute contract — projections are on-read today; this records
  // the intent that interest/For You/opportunity drafts must refresh.
  const recomputePlan = correctionRequiresRecompute({
    correctedFactTypes: [factType],
    affectedProjectorVersions: [
      CUSTOMER_INTEREST_PROJECTOR_VERSION,
      FOR_YOU_PROJECTOR_VERSION,
    ],
  });

  if (
    recomputePlan.recomputeInterest ||
    recomputePlan.recomputeForYou ||
    recomputePlan.expireOpportunities
  ) {
    await new CitedRecommendationRepository(supabase).withdrawStale({
      retailerId: session.retailerId,
      correctedFactIds: [factId],
      reason: `Customer fact corrected: ${reason.trim()}`,
    });
  }

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/analytics");
}
