"use server";

import { requireRetailerRole } from "@paon/auth";
import {
  ClientelingOpportunityRepository,
  RetailerStaffRepository,
} from "@paon/database";
import { revalidatePath } from "next/cache";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export type CompleteAssignedOpportunityResult =
  { readonly status: "completed" } | { readonly status: "unavailable" };

/** Complete only the authenticated staff member's own open customer work. */
export async function completeAssignedOpportunity(
  _previous: CompleteAssignedOpportunityResult | undefined,
  formData: FormData,
): Promise<CompleteAssignedOpportunityResult> {
  const session = await requireModuleSession("retail_operations");
  requireRetailerRole(session.retailerRole, "sales_associate");

  const opportunityId = String(formData.get("opportunityId") ?? "").trim();
  if (!opportunityId) return { status: "unavailable" };

  const supabase = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  if (!staff) return { status: "unavailable" };

  const completed = await new ClientelingOpportunityRepository(
    supabase,
  ).completeAssignedOpen({
    retailerId: session.retailerId,
    staffId: staff.id,
    opportunityId,
  });
  if (!completed) return { status: "unavailable" };

  revalidatePath("/staff/today");
  return { status: "completed" };
}
