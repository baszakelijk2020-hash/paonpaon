"use server";

import { ServicePlanRepository } from "@paon/database";
import {
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
