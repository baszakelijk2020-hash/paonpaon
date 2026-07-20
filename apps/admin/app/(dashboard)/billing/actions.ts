"use server";

import { requirePlatformOperator } from "@paon/auth";
import { SubscriptionPlanRepository } from "@paon/database";
import { asId, updateSubscriptionPlanPriceInputSchema } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface BillingActionState {
  formError?: string;
  saved?: boolean;
}

/** Records a Stripe Price id a platform operator already created in the Stripe dashboard — see docs/PROJECT_STATE.md "Credentials needed". */
export async function updatePlanPrice(
  _previous: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const session = await getSession();
  requirePlatformOperator(session);

  const parsed = updateSubscriptionPlanPriceInputSchema.safeParse({
    planId: formData.get("planId"),
    providerPriceId: formData.get("providerPriceId"),
  });
  if (!parsed.success) {
    return { formError: "Enter a valid Stripe Price id." };
  }

  try {
    await new SubscriptionPlanRepository(
      await getSupabaseServerClient(),
    ).updateProviderPriceId(
      asId<"SubscriptionPlanId">(parsed.data.planId),
      parsed.data.providerPriceId,
    );
  } catch (error) {
    return {
      formError: error instanceof Error ? error.message : "Update failed",
    };
  }

  revalidatePath("/billing");
  return { saved: true };
}
