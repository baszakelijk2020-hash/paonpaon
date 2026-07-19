"use server";

import { AvailabilityWindowRepository } from "@paon/database";
import { asId, createAvailabilityWindowInputSchema } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface CreateAvailabilityWindowFormState {
  values: Record<string, string>;
  fieldErrors: Record<string, string>;
  formError?: string;
}

/**
 * RLS (`20260719000014_*`) is the real gate here: a staff member may
 * only write their own windows unless they're `manager`+ — this action
 * doesn't re-derive that itself, it just lets the database reject an
 * unauthorized `staffId` rather than guessing the rule client-side.
 */
export async function createAvailabilityWindow(
  _prevState: CreateAvailabilityWindowFormState,
  formData: FormData,
): Promise<CreateAvailabilityWindowFormState> {
  await requireSession();

  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;

  const parsed = createAvailabilityWindowInputSchema.safeParse({
    staffId: raw["staffId"],
    dayOfWeek: raw["dayOfWeek"],
    startTime: raw["startTime"],
    endTime: raw["endTime"],
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      fieldErrors[key] ??= issue.message;
    }
    return { values: raw, fieldErrors };
  }

  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  try {
    await new AvailabilityWindowRepository(supabase).create({
      staffId: asId<"StaffId">(parsed.data.staffId),
      retailerId: session.retailerId,
      dayOfWeek: parsed.data.dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return {
      values: raw,
      fieldErrors: {},
      formError: `Couldn't save that window: ${message}`,
    };
  }

  revalidatePath("/appointments/availability");
  return { values: {}, fieldErrors: {} };
}

export async function deleteAvailabilityWindow(
  windowId: string,
): Promise<void> {
  await requireSession();
  const supabase = await getSupabaseServerClient();
  await new AvailabilityWindowRepository(supabase).delete(
    asId<"AvailabilityWindowId">(windowId),
  );
  revalidatePath("/appointments/availability");
}
