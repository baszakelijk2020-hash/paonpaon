"use server";

import {
  appointmentCalendarProvider,
  AppointmentRepository,
  CustomerRepository,
  MorningRoutineRepository,
  RetailerRepository,
} from "@paon/database";
import type { MorningRoutineSelectionResult } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { createMorningRoutineWeatherProvider } from "@/lib/morning-routine-providers";
import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface MorningRoutineActionState {
  readonly result?: MorningRoutineSelectionResult;
  readonly retailerName?: string;
  readonly slug?: string;
  readonly retailerId?: string;
  readonly formError?: string;
}

const initial: MorningRoutineActionState = {};

export async function generateMorningRoutine(
  retailerId: string,
  customerId: string,
  slug: string,
  declaredOccasion: string | undefined,
  _prevState: MorningRoutineActionState,
): Promise<MorningRoutineActionState> {
  await requireSession();
  const supabase = await getSupabaseServerClient();
  const retailer = await new RetailerRepository(supabase).findById(
    retailerId as never,
  );
  if (!retailer) {
    return { formError: "Retailer not found." };
  }

  const customer = await new CustomerRepository(supabase).findById(
    customerId as never,
  );
  if (!customer || customer.retailerId !== retailer.id) {
    return { formError: "Customer relationship not found." };
  }

  const appointments = new AppointmentRepository(supabase);
  const repo = new MorningRoutineRepository(supabase, {
    weather: createMorningRoutineWeatherProvider(),
    calendar: appointmentCalendarProvider(appointments),
  });

  const result = await repo.buildRoutine({
    retailerId: retailer.id,
    customerId: customer.id,
    slug,
    ...(declaredOccasion?.trim()
      ? { declaredOccasion: declaredOccasion.trim() }
      : {}),
  });

  if (!result || result.recommendations.length === 0) {
    return {
      formError:
        "Nothing to suggest yet — add wardrobe pieces or browse the catalogue.",
    };
  }

  revalidatePath("/morning-routine");
  return {
    result,
    retailerName: retailer.displayName,
    slug,
    retailerId: retailer.id,
  };
}

export async function saveMorningRoutineCatalogueItem(
  formData: FormData,
): Promise<void> {
  await requireSession();
  const retailerId = String(formData.get("retailerId") ?? "");
  const productVariantId = String(formData.get("productVariantId") ?? "");
  if (!retailerId || !productVariantId) return;

  const { WishlistRepository } = await import("@paon/database");
  const { toggleWishlistItemInputSchema } = await import("@paon/domain");
  const parsed = toggleWishlistItemInputSchema.parse({
    retailerId,
    productVariantId,
  });
  await new WishlistRepository(await getSupabaseServerClient()).toggleItem(
    parsed.retailerId as never,
    parsed.productVariantId as never,
  );
  revalidatePath("/morning-routine");
  revalidatePath("/wishlist");
}

export { initial as morningRoutineInitialState };
