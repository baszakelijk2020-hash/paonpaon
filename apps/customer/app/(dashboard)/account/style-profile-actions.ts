"use server";

import { StyleProfileRepository, CustomerRepository } from "@paon/database";
import {
  removeStylePreferenceEvidenceInputSchema,
  type StyleProfile,
} from "@paon/domain";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface StyleProfileActionState {
  error?: string;
  success?: boolean;
  profile?: StyleProfile;
}

export async function removeStyleInferenceEvidence(
  _prev: StyleProfileActionState,
  formData: FormData,
): Promise<StyleProfileActionState> {
  const session = await requireSession();
  const parsed = removeStylePreferenceEvidenceInputSchema.safeParse({
    evidenceId: formData.get("evidenceId"),
  });
  const retailerId = z.string().uuid().safeParse(formData.get("retailerId"));
  if (!parsed.success || !retailerId.success) {
    return { error: "Invalid evidence." };
  }

  const supabase = await getSupabaseServerClient();
  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const customer = customers.find(
    (candidate) => candidate.retailerId === (retailerId.data as never),
  );
  if (!customer) {
    return { error: "No relationship with this retailer." };
  }

  const repo = new StyleProfileRepository(supabase);

  try {
    const profile = await repo.removeEvidence(
      customer.id,
      parsed.data.evidenceId as never,
    );
    revalidatePath("/account");
    return { success: true, profile };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { error: message };
  }
}
