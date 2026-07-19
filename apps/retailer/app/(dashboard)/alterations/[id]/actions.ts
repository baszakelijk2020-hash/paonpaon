"use server";

import { requireRetailerRole } from "@paon/auth";
import { AlterationUpdateRepository } from "@paon/database";
import { addAlterationUpdateInputSchema, asId } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface AddAlterationUpdateFormState {
  formError?: string;
}

export const initialAddAlterationUpdateFormState: AddAlterationUpdateFormState =
  {};

export async function addAlterationUpdate(
  alterationId: string,
  _prevState: AddAlterationUpdateFormState,
  formData: FormData,
): Promise<AddAlterationUpdateFormState> {
  const session = await requireSession();
  // "production staff and above" — see docs/DECISIONS.md ADR-015. This
  // codebase's shorthand for that gate is "not read_only"; there is no
  // dedicated requireRetailerRole minimum for it since production_staff
  // already sits directly above read_only in the hierarchy.
  requireRetailerRole(session.retailerRole, "production_staff");

  const parsed = addAlterationUpdateInputSchema.safeParse({
    status: formData.get("status"),
    note: formData.get("note") || undefined,
  });

  if (!parsed.success) {
    return { formError: "Choose a valid status." };
  }

  const supabase = await getSupabaseServerClient();

  try {
    await new AlterationUpdateRepository(supabase).add({
      alterationId: asId<"AlterationId">(alterationId),
      retailerId: session.retailerId,
      status: parsed.data.status,
      ...(parsed.data.note ? { note: parsed.data.note } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { formError: message };
  }

  revalidatePath(`/alterations/${alterationId}`);
  return {};
}
