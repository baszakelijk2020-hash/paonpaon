"use server";

import { ConciergeServiceRepository } from "@paon/database";
import {
  requestConciergeBookingInputSchema,
  transitionConciergeBookingInputSchema,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function requestConciergeBooking(
  formData: FormData,
): Promise<void> {
  await requireSession();
  const operationsRaw = formData.get("operations");
  const operations =
    typeof operationsRaw === "string" ? JSON.parse(operationsRaw) : [];
  const parsed = requestConciergeBookingInputSchema.parse({
    enrollmentId: formData.get("enrollmentId"),
    title: formData.get("title"),
    notes: formData.get("notes") || undefined,
    wardrobeItemId: formData.get("wardrobeItemId") || undefined,
    operations,
  });
  await new ConciergeServiceRepository(
    await getSupabaseServerClient(),
  ).requestBooking(parsed);
  revalidatePath("/services");
}

export async function cancelConciergeBooking(
  formData: FormData,
): Promise<void> {
  await requireSession();
  const parsed = transitionConciergeBookingInputSchema.parse({
    bookingId: formData.get("bookingId"),
    transition: "cancel",
    note: formData.get("note") || undefined,
  });
  await new ConciergeServiceRepository(
    await getSupabaseServerClient(),
  ).transitionBooking(parsed);
  revalidatePath("/services");
}

export async function completeConciergeBooking(
  formData: FormData,
): Promise<void> {
  await requireSession();
  const parsed = transitionConciergeBookingInputSchema.parse({
    bookingId: formData.get("bookingId"),
    transition: "complete",
  });
  await new ConciergeServiceRepository(
    await getSupabaseServerClient(),
  ).transitionBooking(parsed);
  revalidatePath("/services");
}
