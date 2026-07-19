"use server";

import { requireRetailerRole } from "@paon/auth";
import {
  CustomerFitProfileRepository,
  RetailerStaffRepository,
} from "@paon/database";
import { addFitProfileEntryInputSchema, asId } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface AddFitProfileEntryFormState {
  formError?: string;
}

export const initialAddFitProfileEntryFormState: AddFitProfileEntryFormState =
  {};

const MEASUREMENT_FIELDS = [
  "chest",
  "waist",
  "hips",
  "inseam",
  "shoulders",
  "sleeve",
  "neck",
  "height",
] as const;

export async function addFitProfileEntry(
  customerId: string,
  _prevState: AddFitProfileEntryFormState,
  formData: FormData,
): Promise<AddFitProfileEntryFormState> {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "sales_associate");

  const measurements: Record<string, string> = {};
  for (const field of MEASUREMENT_FIELDS) {
    const value = formData.get(field);
    if (typeof value === "string" && value.trim().length > 0) {
      measurements[field] = value.trim();
    }
  }

  const parsed = addFitProfileEntryInputSchema.safeParse({
    measurements,
    fitPreferences: formData.get("fitPreferences") || undefined,
    styleNotes: formData.get("styleNotes") || undefined,
  });

  if (!parsed.success) {
    return { formError: "Enter at least one measurement or note." };
  }

  const supabase = await getSupabaseServerClient();

  try {
    const me = await new RetailerStaffRepository(supabase).findByUserId(
      session.userId,
    );
    await new CustomerFitProfileRepository(supabase).add({
      customerId: asId<"CustomerId">(customerId),
      retailerId: session.retailerId,
      measurements: parsed.data.measurements,
      ...(parsed.data.fitPreferences
        ? { fitPreferences: parsed.data.fitPreferences }
        : {}),
      ...(parsed.data.styleNotes ? { styleNotes: parsed.data.styleNotes } : {}),
      ...(me ? { recordedByStaffId: me.id } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { formError: message };
  }

  revalidatePath(`/customers/${customerId}`);
  return {};
}
