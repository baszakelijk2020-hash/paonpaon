"use server";

import { CustomerRepository, StyleProfileRepository } from "@paon/database";
import { removeInferredStylePreferenceInputSchema } from "@paon/domain";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface StyleProfileActionState {
  fieldErrors: Record<string, string>;
  formError?: string;
  success?: boolean;
}

const retailerIdSchema = z.string().uuid();

export async function removeInferredPreference(
  _prevState: StyleProfileActionState,
  formData: FormData,
): Promise<StyleProfileActionState> {
  const session = await requireSession();

  const rawRetailerId = formData.get("retailerId");
  const rawConceptId = formData.get("conceptId");
  const rawReason = formData.get("reason");

  const retailerId = retailerIdSchema.safeParse(rawRetailerId);
  const parsed = removeInferredStylePreferenceInputSchema.safeParse({
    conceptId: rawConceptId,
    reason:
      typeof rawReason === "string" && rawReason.trim().length > 0
        ? rawReason
        : undefined,
  });

  if (!retailerId.success || !parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.success ? [] : parsed.error.issues) {
      const key = issue.path.join(".");
      fieldErrors[key] ??= issue.message;
    }
    if (!retailerId.success) {
      fieldErrors["retailerId"] = "Invalid retailer.";
    }
    return { fieldErrors };
  }

  const supabase = await getSupabaseServerClient();
  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const customer = customers.find(
    (candidate) => candidate.retailerId === (retailerId.data as never),
  );
  if (!customer) {
    return {
      fieldErrors: {},
      formError: "No relationship with this retailer.",
    };
  }

  try {
    await new StyleProfileRepository(supabase).removeInferred(
      customer.id,
      parsed.data,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { fieldErrors: {}, formError: message };
  }

  revalidatePath("/account");
  return { fieldErrors: {}, success: true };
}
