"use server";

import { requireRetailerRole } from "@paon/auth";
import { StaffRosterRepository } from "@paon/database";
import { asId, createStaffShiftSchema } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function createStaffShift(formData: FormData) {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "manager");

  const value = createStaffShiftSchema.parse({
    staffId: formData.get("staffId"),
    shiftDate: formData.get("shiftDate"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    notes: formData.get("notes") || undefined,
  });

  await new StaffRosterRepository(await getSupabaseServerClient()).createShift({
    retailerId: session.retailerId,
    staffId: asId<"StaffId">(value.staffId),
    shiftDate: value.shiftDate,
    startTime: value.startTime,
    endTime: value.endTime,
    ...(value.notes ? { notes: value.notes } : {}),
  });
  revalidatePath("/staff/roster");
}

export async function deleteStaffShift(formData: FormData) {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "manager");

  const shiftId = String(formData.get("shiftId"));
  await new StaffRosterRepository(await getSupabaseServerClient()).deleteShift(
    asId<"StaffShiftId">(shiftId),
  );
  revalidatePath("/staff/roster");
}

/** Any staff role — clocking in/out is not a manager-only action. */
export async function clockIn() {
  await requireSession();
  await new StaffRosterRepository(await getSupabaseServerClient()).clockIn();
  revalidatePath("/dashboard");
}

export async function clockOut() {
  await requireSession();
  await new StaffRosterRepository(await getSupabaseServerClient()).clockOut();
  revalidatePath("/dashboard");
}
