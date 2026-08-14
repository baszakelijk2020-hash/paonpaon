"use server";

import { CitedRecommendationRepository } from "@paon/database";
import { retailerRoleAtLeast } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface AnalyticsActionState {
  formError?: string;
  notice?: string;
}

const REASONS: Record<string, string> = {
  no_appointments_in_window:
    "No appointments in the last 90 days yet, so there is nothing to find a pattern in.",
  no_customers_or_gaps:
    "No customers or catalogue gaps to find a pattern in yet.",
  no_sources: "Nothing was observed to cite.",
  window_invalid: "The observation window was invalid.",
  sample_size_not_positive: "There was nothing to count.",
  statement_required: "Could not build a statement to show.",
  sample_exceeds_observed_rows: "The sample did not match what was observed.",
  projector_version_required: "The projector was not versioned correctly.",
};

/**
 * Recomputes the `temporal_hotspot` recommendation from live appointments.
 * A manager triggers this on demand rather than it running silently, so
 * an empty or sparse result is a visible, explained state rather than a
 * stale card nobody refreshed.
 */
export async function recomputeTemporalHotspot(
  _previous: AnalyticsActionState,
  _formData: FormData,
): Promise<AnalyticsActionState> {
  const session = await requireSession();
  if (!retailerRoleAtLeast(session.retailerRole, "manager")) {
    return { formError: "Only a manager or above can recompute this." };
  }
  const supabase = await getSupabaseServerClient();
  const result = await new CitedRecommendationRepository(
    supabase,
  ).computeTemporalHotspot({ retailerId: session.retailerId });

  revalidatePath("/analytics");
  if (result.ok) return { notice: "Recomputed from the latest appointments." };
  return { formError: REASONS[result.reason] ?? "Could not recompute that." };
}

/**
 * Recomputes the `complete_look` recommendation from customer wardrobes and
 * the retailer's catalogue. A manager triggers this on demand rather than it
 * running silently, so an empty or sparse result is a visible, explained
 * state rather than a stale card nobody refreshed.
 */
export async function recomputeCompleteLook(
  _previous: AnalyticsActionState,
  _formData: FormData,
): Promise<AnalyticsActionState> {
  const session = await requireSession();
  if (!retailerRoleAtLeast(session.retailerRole, "manager")) {
    return { formError: "Only a manager or above can recompute this." };
  }
  const supabase = await getSupabaseServerClient();
  const result = await new CitedRecommendationRepository(
    supabase,
  ).computeCompleteLook({ retailerId: session.retailerId });

  revalidatePath("/analytics");
  if (result.ok)
    return { notice: "Recomputed from wardrobe and catalogue data." };
  return { formError: REASONS[result.reason] ?? "Could not recompute that." };
}
