"use server";

import { AppointmentClosureRepository } from "@paon/database";
import { asId } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface ClosureFormState {
  values: Record<string, string>;
  formError?: string;
}

/**
 * RLS on `appointment_closures` is the real gate — `sales_associate`+ of the
 * owning retailer only. This action validates shape and lets the database
 * reject anything else, the same way `createAvailabilityWindow` does rather
 * than second-guessing the rule in application code.
 */
export async function createClosure(
  _prevState: ClosureFormState,
  formData: FormData,
): Promise<ClosureFormState> {
  const session = await requireSession();
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;

  const startsAt = Date.parse(raw["startsAt"] ?? "");
  const endsAt = Date.parse(raw["endsAt"] ?? "");
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) {
    return { values: raw, formError: "Give a start and an end." };
  }
  if (startsAt >= endsAt) {
    return { values: raw, formError: "The end must come after the start." };
  }

  const reason = (raw["reason"] ?? "").trim();
  const branchId = (raw["branchId"] ?? "").trim();

  try {
    await new AppointmentClosureRepository(
      await getSupabaseServerClient(),
    ).create({
      retailerId: session.retailerId,
      // Empty means every branch.
      branchId: branchId ? asId<"RetailerBranchId">(branchId) : null,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      reason: reason || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { values: raw, formError: message };
  }

  revalidatePath("/appointments/closures");
  return { values: {} };
}

export async function removeClosure(formData: FormData): Promise<void> {
  await requireSession();
  const id = String(formData.get("closureId") ?? "");
  if (!id) return;

  await new AppointmentClosureRepository(
    await getSupabaseServerClient(),
  ).remove(id);

  revalidatePath("/appointments/closures");
}
