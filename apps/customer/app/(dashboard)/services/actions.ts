"use server";

import { ServicePlanRepository } from "@paon/database";
import { requestServiceBookingInputSchema } from "@paon/domain";
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
