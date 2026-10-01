"use server";

import { PaidCareBookingRepository } from "@paon/database";
import { asId, PAID_CARE_BOOKING_STATUSES } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Advance a paid-care booking. `paid_care_bookings_staff_update` is the real
 * gate — it restricts the write to the owning retailer's staff — so this only
 * validates that the requested status is a real one.
 */
export async function updatePaidCareStatus(formData: FormData): Promise<void> {
  await requireSession();

  const bookingId = String(formData.get("bookingId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!bookingId) return;
  if (!(PAID_CARE_BOOKING_STATUSES as readonly string[]).includes(status)) {
    return;
  }

  await new PaidCareBookingRepository(
    await getSupabaseServerClient(),
  ).updateStatusAsStaff({
    id: asId<"PaidCareBookingId">(bookingId),
    status: status as (typeof PAID_CARE_BOOKING_STATUSES)[number],
  });

  revalidatePath("/appointments/paid-care");
}
