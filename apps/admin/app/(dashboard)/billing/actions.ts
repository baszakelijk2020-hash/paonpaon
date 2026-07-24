"use server";

import { requirePlatformOperator } from "@paon/auth";
import { SubscriptionPlanRepository } from "@paon/database";
import {
  asId,
  updateCommercialPlanInputSchema,
  updateSubscriptionPlanPriceInputSchema,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface BillingActionState {
  formError?: string;
  saved?: boolean;
}

export async function updateCommercialPlan(
  _previous: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const session = await getSession();
  requirePlatformOperator(session);

  const parsed = updateCommercialPlanInputSchema.safeParse({
    planId: formData.get("planId"),
    name: formData.get("name"),
    positioning: formData.get("positioning"),
    description: formData.get("description"),
    priceAmountMinorUnits: formData.get("priceAmountMinorUnits"),
    priceCurrency: formData.get("priceCurrency"),
    priceIsFrom: formData.get("priceIsFrom") === "on",
    implementationFeeAmountMinorUnits: formData.get(
      "implementationFeeAmountMinorUnits",
    ),
    implementationFeeCurrency: formData.get("implementationFeeCurrency"),
    seatLimit: formData.get("seatLimit"),
    includedFeatureKeys: formData.getAll("includedFeatureKeys"),
    isPublic: formData.get("isPublic") === "on",
  });
  if (!parsed.success) {
    return {
      formError:
        parsed.error.issues[0]?.message ?? "Review the commercial plan.",
    };
  }

  try {
    await new SubscriptionPlanRepository(
      await getSupabaseServerClient(),
    ).updateCommercialPlan(parsed.data);
  } catch (error) {
    return {
      formError: error instanceof Error ? error.message : "Update failed",
    };
  }

  revalidatePath("/billing");
  return { saved: true };
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
