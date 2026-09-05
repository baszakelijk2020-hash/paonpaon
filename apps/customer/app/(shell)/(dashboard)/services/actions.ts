"use server";

import {
  ServicePartnerRepository,
  ServicePlanRepository,
} from "@paon/database";
import {
  asId,
  decideServiceWeeklyPlanInputSchema,
  requestServiceBookingInputSchema,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function requestConciergeBooking(
  formData: FormData,
): Promise<void> {
  await requireSession();
  const parsed = requestServiceBookingInputSchema.parse({
    membershipId: formData.get("membershipId"),
    kind: formData.get("kind"),
    notes: formData.get("notes") || undefined,
    idempotencyKey:
      formData.get("idempotencyKey") ||
      `customer-book-${String(formData.get("membershipId"))}-${String(formData.get("kind"))}-${Date.now()}`,
    ...(formData.get("requestedFor")
      ? { requestedFor: String(formData.get("requestedFor")) }
      : {}),
  });
  await new ServicePlanRepository(
    await getSupabaseServerClient(),
  ).requestBooking(parsed);
  revalidatePath("/services");
}

export async function decideWeeklyPlan(formData: FormData): Promise<void> {
  await requireSession();
  const parsed = decideServiceWeeklyPlanInputSchema.parse({
    planId: formData.get("planId"),
    decision: formData.get("decision"),
    declineReason: formData.get("declineReason") || undefined,
  });
  await new ServicePlanRepository(
    await getSupabaseServerClient(),
  ).decideWeeklyPlan(parsed);
  revalidatePath("/services");
}

export async function submitCustomerQualityReview(
  engagementId: string,
  formData: FormData,
): Promise<void> {
  await requireSession();
  const supabase = await getSupabaseServerClient();
  const repo = new ServicePartnerRepository(supabase);
  const rating = formData.get("customerRating");
  const note = formData.get("customerNote");

  // For customers, we need to verify the engagement is accessible
  // and get the partner_id via the care status RPC
  const careStatus = await repo.listMyCustomerCareStatus();
  const care = careStatus.find((c) => c.engagementId === engagementId);
  if (!care) {
    throw new Error("Engagement not found or not accessible");
  }

  // Submit the review using the partner/retailer id from care status —
  // both must come from this whitelist projection, never from a direct
  // service_partner_engagements lookup, which RLS reserves for retailer
  // staff and a customer session cannot read.
  await repo.submitQualityReview({
    engagementId,
    partnerId: care.partnerId,
    retailerId: asId<"RetailerId">(care.retailerId),
    customerRating: rating ? parseInt(String(rating), 10) : undefined,
    customerNote: note ? String(note).trim() || undefined : undefined,
  });

  revalidatePath("/services");
}
