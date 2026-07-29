"use server";

import { WardrobeRepository } from "@paon/database";
import {
  addWardrobeAdvisorNoteInputSchema,
  asId,
  createRetailerPurchaseWardrobeItemInputSchema,
  updateWardrobeItemStateInputSchema,
} from "@paon/domain";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface RetailerWardrobeActionState {
  fieldErrors: Record<string, string>;
  formError?: string;
  success?: boolean;
}

const customerIdSchema = z.string().uuid();
const itemIdSchema = z.string().uuid();

export async function createRetailerPurchaseWardrobeItem(
  _prevState: RetailerWardrobeActionState,
  formData: FormData,
): Promise<RetailerWardrobeActionState> {
  await requireSession();
  const customerId = customerIdSchema.safeParse(formData.get("customerId"));
  const parsed = createRetailerPurchaseWardrobeItemInputSchema.safeParse({
    categoryCode: formData.get("categoryCode"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    brand: formData.get("brand") || undefined,
    physicalGarmentId: formData.get("physicalGarmentId") || undefined,
    productId: formData.get("productId") || undefined,
    orderLineId: formData.get("orderLineId") || undefined,
    conditionState: formData.get("conditionState") || undefined,
    fitNotes: formData.get("fitNotes") || undefined,
  });

  if (!customerId.success || !parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.success ? [] : parsed.error.issues) {
      fieldErrors[issue.path.join(".")] ??= issue.message;
    }
    if (!customerId.success) {
      fieldErrors["customerId"] = "Invalid customer.";
    }
    return { fieldErrors };
  }

  try {
    const supabase = await getSupabaseServerClient();
    await new WardrobeRepository(supabase).createRetailerPurchase(
      asId<"CustomerId">(customerId.data),
      parsed.data,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { fieldErrors: {}, formError: message };
  }

  revalidatePath(`/customers/${customerId.data}`);
  return { fieldErrors: {}, success: true };
}

export async function updateCustomerWardrobeItem(
  _prevState: RetailerWardrobeActionState,
  formData: FormData,
): Promise<RetailerWardrobeActionState> {
  await requireSession();
  const customerId = customerIdSchema.safeParse(formData.get("customerId"));
  const itemId = itemIdSchema.safeParse(formData.get("itemId"));
  const parsed = updateWardrobeItemStateInputSchema.safeParse({
    conditionState: formData.get("conditionState") || undefined,
    fitNotes: formData.get("fitNotes") || undefined,
    careNotes: formData.get("careNotes") || undefined,
    wearFrequency: formData.get("wearFrequency") || undefined,
  });

  if (!customerId.success || !itemId.success || !parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.success ? [] : parsed.error.issues) {
      fieldErrors[issue.path.join(".")] ??= issue.message;
    }
    if (!customerId.success) fieldErrors["customerId"] = "Invalid customer.";
    if (!itemId.success) fieldErrors["itemId"] = "Invalid item.";
    return { fieldErrors };
  }

  try {
    const supabase = await getSupabaseServerClient();
    await new WardrobeRepository(supabase).updateState(
      asId<"WardrobeItemId">(itemId.data),
      parsed.data,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { fieldErrors: {}, formError: message };
  }

  revalidatePath(`/customers/${customerId.data}`);
  return { fieldErrors: {}, success: true };
}

export async function addWardrobeAdvisorNote(
  _prevState: RetailerWardrobeActionState,
  formData: FormData,
): Promise<RetailerWardrobeActionState> {
  await requireSession();
  const customerId = customerIdSchema.safeParse(formData.get("customerId"));
  const itemId = itemIdSchema.safeParse(formData.get("itemId"));
  const parsed = addWardrobeAdvisorNoteInputSchema.safeParse({
    note: formData.get("note"),
  });

  if (!customerId.success || !itemId.success || !parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.success ? [] : parsed.error.issues) {
      fieldErrors[issue.path.join(".")] ??= issue.message;
    }
    if (!customerId.success) fieldErrors["customerId"] = "Invalid customer.";
    if (!itemId.success) fieldErrors["itemId"] = "Invalid item.";
    return { fieldErrors };
  }

  try {
    const supabase = await getSupabaseServerClient();
    await new WardrobeRepository(supabase).addAdvisorNote(
      asId<"WardrobeItemId">(itemId.data),
      parsed.data,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { fieldErrors: {}, formError: message };
  }

  revalidatePath(`/customers/${customerId.data}`);
  return { fieldErrors: {}, success: true };
}
