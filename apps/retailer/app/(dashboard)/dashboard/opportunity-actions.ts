"use server";

import { requireRetailerRole } from "@paon/auth";
import {
  ClientelingOpportunityRepository,
  RetailerStaffRepository,
} from "@paon/database";
import { type ClientelingOutcomeType } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function assignOpportunityToMe(formData: FormData) {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "sales_associate");
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const supabase = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  if (!staff || staff.retailerId !== session.retailerId) {
    throw new Error("Active staff membership required.");
  }
  await new ClientelingOpportunityRepository(supabase).assign(
    opportunityId,
    staff.id,
  );
  revalidatePath("/dashboard");
}

export async function dismissOpportunity(formData: FormData) {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "sales_associate");
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const feedbackNote = String(formData.get("feedbackNote") ?? "").trim();
  const supabase = await getSupabaseServerClient();
  await new ClientelingOpportunityRepository(supabase).updateStatus({
    opportunityId,
    status: "dismissed",
    ...(feedbackNote ? { feedbackNote } : {}),
  });
  revalidatePath("/dashboard");
}

export async function recordOpportunityOutcome(formData: FormData) {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "sales_associate");
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const outcomeType = String(
    formData.get("outcomeType") ?? "",
  ) as ClientelingOutcomeType;
  const feedbackNote = String(formData.get("feedbackNote") ?? "").trim();
  const supabase = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  if (!staff || staff.retailerId !== session.retailerId) {
    throw new Error("Active staff membership required.");
  }
  await new ClientelingOpportunityRepository(supabase).recordOutcome({
    opportunityId,
    outcomeType,
    staffId: staff.id,
    ...(feedbackNote ? { feedbackNote } : {}),
  });
  revalidatePath("/dashboard");
}
