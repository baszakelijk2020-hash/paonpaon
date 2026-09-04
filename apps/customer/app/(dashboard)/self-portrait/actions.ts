"use server";

import { CustomerFactRepository, CustomerRepository } from "@paon/database";
import { asId } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface CorrectionFormState {
  formError?: string;
  success?: boolean;
}

/**
 * Customer-owned correction of a single House Memory fact. The source fact
 * stays immutable — `correct_own_customer_fact` inserts an additive
 * counterfact and supersedes the original, so provenance is never lost.
 * The RPC itself is the authority on which facts a customer may correct
 * (customer-visible, standard sensitivity, non-transactional, owned by the
 * calling auth user); this action does not duplicate that gate, only
 * surfaces its rejection honestly.
 */
export async function correctOwnFact(
  factId: string,
  _previous: CorrectionFormState,
  formData: FormData,
): Promise<CorrectionFormState> {
  const session = await requireSession();
  const replacementValueLabel = String(
    formData.get("replacementValueLabel") ?? "",
  ).trim();
  const replacementValueText = String(
    formData.get("replacementValueText") ?? "",
  ).trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (replacementValueLabel.length === 0) {
    return { formError: "Enter what this should say instead." };
  }

  const client = await getSupabaseServerClient();
  // Confirm the caller actually owns a customer row before touching the
  // RPC — belt-and-braces alongside its own auth.uid() ownership check.
  const customers = await new CustomerRepository(client).findByUserId(
    session.userId,
  );
  if (customers.length === 0) {
    return { formError: "No customer profile found for this account." };
  }

  try {
    await new CustomerFactRepository(client).correctOwnFact({
      factId: asId<"CustomerFactId">(factId),
      replacementValueLabel,
      ...(replacementValueText ? { replacementValueText } : {}),
      ...(reason ? { reason } : {}),
    });
  } catch {
    return {
      formError:
        "That could not be corrected — it may no longer be available for correction.",
    };
  }

  revalidatePath("/self-portrait");
  return { success: true };
}
