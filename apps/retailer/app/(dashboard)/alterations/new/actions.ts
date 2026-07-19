"use server";

import { requireRetailerRole } from "@paon/auth";
import { AlterationRepository } from "@paon/database";
import { asId, createAlterationInputSchema } from "@paon/domain";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface CreateAlterationFormState {
  values: Record<string, string>;
  fieldErrors: Record<string, string>;
  formError?: string;
}

export const initialCreateAlterationFormState: CreateAlterationFormState = {
  values: {},
  fieldErrors: {},
};

export async function createAlteration(
  _prevState: CreateAlterationFormState,
  formData: FormData,
): Promise<CreateAlterationFormState> {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "sales_associate");

  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;

  const parsed = createAlterationInputSchema.safeParse({
    customerId: raw["customerId"],
    instructions: raw["instructions"],
    dueDate: raw["dueDate"] || undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      fieldErrors[key] ??= issue.message;
    }
    return { values: raw, fieldErrors };
  }

  const supabase = await getSupabaseServerClient();
  const alteration = await new AlterationRepository(supabase).create({
    retailerId: session.retailerId,
    customerId: asId<"CustomerId">(parsed.data.customerId),
    instructions: parsed.data.instructions,
    ...(parsed.data.dueDate ? { dueDate: parsed.data.dueDate } : {}),
  });

  redirect(`/alterations/${alteration.id}`);
}
