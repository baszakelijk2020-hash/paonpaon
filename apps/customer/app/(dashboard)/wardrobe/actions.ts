"use server";

import { CustomerRepository, WardrobeRepository } from "@paon/database";
import {
  createExternalWardrobeItemInputSchema,
  updateWardrobeItemStateInputSchema,
} from "@paon/domain";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface WardrobeActionState {
  fieldErrors: Record<string, string>;
  formError?: string;
  success?: boolean;
}

const retailerIdSchema = z.string().uuid();
const itemIdSchema = z.string().uuid();

async function requireCustomerForRetailer(
  retailerId: string,
  userId: string,
) {
  const supabase = await getSupabaseServerClient();
  const customers = await new CustomerRepository(supabase).findByUserId(userId);
  const customer = customers.find(
    (candidate) => candidate.retailerId === (retailerId as never),
  );
  return customer ?? null;
}

export async function createExternalWardrobeItem(
  _prevState: WardrobeActionState,
  formData: FormData,
): Promise<WardrobeActionState> {
  const session = await requireSession();
  const retailerId = retailerIdSchema.safeParse(formData.get("retailerId"));
  const parsed = createExternalWardrobeItemInputSchema.safeParse({
    categoryCode: formData.get("categoryCode"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    brand: formData.get("brand") || undefined,
    conditionState: formData.get("conditionState") || undefined,
    fitNotes: formData.get("fitNotes") || undefined,
    careNotes: formData.get("careNotes") || undefined,
    wearFrequency: formData.get("wearFrequency") || undefined,
  });

  if (!retailerId.success || !parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.success ? [] : parsed.error.issues) {
      fieldErrors[issue.path.join(".")] ??= issue.message;
    }
    if (!retailerId.success) {
      fieldErrors["retailerId"] = "Invalid retailer.";
    }
    return { fieldErrors };
  }

  const customer = await requireCustomerForRetailer(
    retailerId.data,
    session.userId,
  );
  if (!customer) {
    return {
      fieldErrors: {},
      formError: "No relationship with this retailer.",
    };
  }

  try {
    const supabase = await getSupabaseServerClient();
    await new WardrobeRepository(supabase).createExternal(
      retailerId.data as never,
      parsed.data,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { fieldErrors: {}, formError: message };
  }

  revalidatePath("/wardrobe");
  return { fieldErrors: {}, success: true };
}

export async function updateWardrobeItem(
  _prevState: WardrobeActionState,
  formData: FormData,
): Promise<WardrobeActionState> {
  const session = await requireSession();
  const itemId = itemIdSchema.safeParse(formData.get("itemId"));
  const parsed = updateWardrobeItemStateInputSchema.safeParse({
    conditionState: formData.get("conditionState") || undefined,
    fitNotes: formData.get("fitNotes") || undefined,
    careNotes: formData.get("careNotes") || undefined,
    wearFrequency: formData.get("wearFrequency") || undefined,
  });

  if (!itemId.success || !parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.success ? [] : parsed.error.issues) {
      fieldErrors[issue.path.join(".")] ??= issue.message;
    }
    if (!itemId.success) {
      fieldErrors["itemId"] = "Invalid item.";
    }
    return { fieldErrors };
  }

  const supabase = await getSupabaseServerClient();
  const repo = new WardrobeRepository(supabase);
  const item = await repo.findById(itemId.data as never);
  if (!item) {
    return { fieldErrors: {}, formError: "Wardrobe item not found." };
  }

  const customer = await requireCustomerForRetailer(
    item.retailerId,
    session.userId,
  );
  if (!customer || customer.id !== item.customerId) {
    return { fieldErrors: {}, formError: "Not authorized." };
  }

  try {
    await repo.updateState(itemId.data as never, parsed.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { fieldErrors: {}, formError: message };
  }

  revalidatePath("/wardrobe");
  return { fieldErrors: {}, success: true };
}

export async function archiveWardrobeItem(
  _prevState: WardrobeActionState,
  formData: FormData,
): Promise<WardrobeActionState> {
  const session = await requireSession();
  const itemId = itemIdSchema.safeParse(formData.get("itemId"));
  if (!itemId.success) {
    return { fieldErrors: { itemId: "Invalid item." } };
  }

  const supabase = await getSupabaseServerClient();
  const repo = new WardrobeRepository(supabase);
  const item = await repo.findById(itemId.data as never);
  if (!item) {
    return { fieldErrors: {}, formError: "Wardrobe item not found." };
  }

  const customer = await requireCustomerForRetailer(
    item.retailerId,
    session.userId,
  );
  if (!customer || customer.id !== item.customerId) {
    return { fieldErrors: {}, formError: "Not authorized." };
  }

  try {
    await repo.archive(itemId.data as never);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { fieldErrors: {}, formError: message };
  }

  revalidatePath("/wardrobe");
  return { fieldErrors: {}, success: true };
}
