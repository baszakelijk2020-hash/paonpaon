"use server";

import { CustomerRepository, OutfitRepository } from "@paon/database";
import {
  createOutfitInputSchema,
  outfitSlotKindForGarmentCategory,
  type GarmentCategoryCode,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { enqueueLook } from "@/app/(dashboard)/wardrobe/virtual-studio-actions";
import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface CompleteTheLookGenerateState {
  readonly error?: string;
}

/**
 * Complete the Look's own "see it on me" tap-to-generate entry point
 * (PHASE 17.10 / ADV-110, vision spec §14 item 3) — never automatic
 * generation. A throwaway single-slot Outfit carries the suggested
 * (not-yet-owned) product into the existing Virtual Wardrobe Studio
 * enqueue pipeline (`enqueueLook`, `wardrobe/virtual-studio-actions.ts`)
 * rather than a second generation path — same consent/portrait/preset
 * gates every other tap-to-generate action already enforces.
 */
export async function generateCompleteTheLookTryOn(
  retailerId: string,
  _previous: CompleteTheLookGenerateState,
  formData: FormData,
): Promise<CompleteTheLookGenerateState> {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const customer = customers.find((row) => row.retailerId === retailerId);
  if (!customer) return { error: "Customer relationship not found." };

  const productId = String(formData.get("productId") ?? "");
  const categoryCode = String(
    formData.get("categoryCode") ?? "",
  ) as GarmentCategoryCode;
  const displayName = String(formData.get("displayName") ?? "this item");
  if (!productId || !categoryCode) {
    return { error: "Missing suggestion details." };
  }

  const slotKind = outfitSlotKindForGarmentCategory(categoryCode);
  const parsed = createOutfitInputSchema.safeParse({
    retailerId: customer.retailerId,
    customerId: customer.id,
    title: `See it on me: ${displayName}`,
    slots: [
      {
        slotKind,
        label: slotKind,
        available: true,
        displayOrder: 0,
        productId,
      },
    ],
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Could not build the look.",
    };
  }

  let outfitId: string;
  try {
    const outfit = await new OutfitRepository(supabase).createByCustomer(
      parsed.data,
      customer.id,
    );
    outfitId = outfit.id;
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not create the look.",
    };
  }

  const result = await enqueueLook(supabase, {
    retailerId: customer.retailerId,
    customerId: customer.id,
    outfitId,
  });

  revalidatePath("/wardrobe");
  revalidatePath("/morning-routine");
  return result.error ? { error: result.error } : {};
}
