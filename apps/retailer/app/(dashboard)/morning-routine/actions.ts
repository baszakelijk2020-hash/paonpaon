"use server";

import {
  MorningRoutineDeliveryRepository,
  ProductRepository,
} from "@paon/database";
import {
  upsertMorningRoutineRetailerSettingsInputSchema,
  asId,
} from "@paon/domain";
import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface MorningRoutineRetailerSettingsFormState {
  fieldErrors: Record<string, string>;
  formError?: string;
  success?: boolean;
}

function zodFieldErrors(error: ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

export async function saveMorningRoutineRetailerSettings(
  _prev: MorningRoutineRetailerSettingsFormState,
  formData: FormData,
): Promise<MorningRoutineRetailerSettingsFormState> {
  const session = await requireSession();

  const productIds = formData
    .getAll("eligibleProductIds")
    .filter((value): value is string => typeof value === "string");

  const parsed = upsertMorningRoutineRetailerSettingsInputSchema.safeParse({
    retailerId: session.retailerId,
    enabled: formData.get("enabled") === "on",
    deliveryHourLocal: Number(formData.get("deliveryHourLocal") ?? 7),
    eligibleProductIds: productIds,
  });

  if (!parsed.success) {
    return { fieldErrors: zodFieldErrors(parsed.error) };
  }

  try {
    const supabase = await getSupabaseServerClient();
    await new MorningRoutineDeliveryRepository(supabase).upsertRetailerSettings(
      parsed.data,
    );
    revalidatePath("/morning-routine");
    return { fieldErrors: {}, success: true };
  } catch (error) {
    return {
      fieldErrors: {},
      formError:
        error instanceof Error ? error.message : "Could not save settings.",
    };
  }
}

export async function loadMorningRoutineRetailerPageData(retailerId: string) {
  const supabase = await getSupabaseServerClient();
  const deliveryRepo = new MorningRoutineDeliveryRepository(supabase);
  const productRepo = new ProductRepository(supabase);
  const [settings, products] = await Promise.all([
    deliveryRepo.getRetailerSettings(retailerId),
    productRepo.findByRetailer(asId<"RetailerId">(retailerId)),
  ]);
  return {
    settings,
    products: products.filter((product) => product.status === "active"),
  };
}
