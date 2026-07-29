"use server";

import { CustomerRepository, WardrobeRepository } from "@paon/database";
import {
  createExternalWardrobeItemInputSchema,
  retireWardrobeItemInputSchema,
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

async function resolveCustomer(userId: string, retailerId: string) {
  const supabase = await getSupabaseServerClient();
  const customers = await new CustomerRepository(supabase).findByUserId(
    userId as never,
  );
  return customers.find((candidate) => candidate.retailerId === retailerId);
}

export async function addExternalWardrobeItem(
  _prevState: WardrobeActionState,
  formData: FormData,
): Promise<WardrobeActionState> {
  const session = await requireSession();
  const parsed = createExternalWardrobeItemInputSchema.safeParse({
    retailerId: formData.get("retailerId"),
    customerId: formData.get("customerId"),
    categoryCode: formData.get("categoryCode"),
    displayName: formData.get("displayName"),
    brand: optionalString(formData.get("brand")),
    description: optionalString(formData.get("description")),
    condition: formData.get("condition") || "good",
    wearFrequency: optionalString(formData.get("wearFrequency")),
    careState: formData.get("careState") || "current",
    fitPerception: formData.get("fitPerception") || "unknown",
    careNotes: optionalString(formData.get("careNotes")),
    fitNotes: optionalString(formData.get("fitNotes")),
  });

  if (!parsed.success) {
    return { fieldErrors: zodFieldErrors(parsed.error) };
  }

  const customer = await resolveCustomer(
    session.userId,
    parsed.data.retailerId,
  );
  if (!customer || customer.id !== parsed.data.customerId) {
    return {
      fieldErrors: {},
      formError: "No relationship with this retailer.",
    };
  }

  try {
    const supabase = await getSupabaseServerClient();
    await new WardrobeRepository(supabase).createExternalItem({
      ...parsed.data,
      customerId: customer.id,
    });
  } catch (error) {
    return {
      fieldErrors: {},
      formError: error instanceof Error ? error.message : "Could not add item.",
    };
  }

  revalidatePath("/wardrobe");
  return { fieldErrors: {}, success: true };
}

export async function updateWardrobeItemState(
  _prevState: WardrobeActionState,
  formData: FormData,
): Promise<WardrobeActionState> {
  const session = await requireSession();
  const retailerId = z.string().uuid().safeParse(formData.get("retailerId"));
  const parsed = updateWardrobeItemStateInputSchema.safeParse({
    wardrobeItemId: formData.get("wardrobeItemId"),
    condition: optionalString(formData.get("condition")),
    wearFrequency: optionalString(formData.get("wearFrequency")),
    careState: optionalString(formData.get("careState")),
    fitPerception: optionalString(formData.get("fitPerception")),
    careNotes: optionalString(formData.get("careNotes")),
    fitNotes: optionalString(formData.get("fitNotes")),
    displayName: optionalString(formData.get("displayName")),
  });

  if (!retailerId.success || !parsed.success) {
    return {
      fieldErrors: {
        ...(!retailerId.success ? { retailerId: "Invalid retailer." } : {}),
        ...(!parsed.success ? zodFieldErrors(parsed.error) : {}),
      },
    };
  }

  const customer = await resolveCustomer(session.userId, retailerId.data);
  if (!customer) {
    return {
      fieldErrors: {},
      formError: "No relationship with this retailer.",
    };
  }

  try {
    const supabase = await getSupabaseServerClient();
    const repo = new WardrobeRepository(supabase);
    const existing = await repo.findById(parsed.data.wardrobeItemId as never);
    if (
      !existing ||
      existing.customerId !== customer.id ||
      existing.retailerId !== customer.retailerId
    ) {
      return { fieldErrors: {}, formError: "Wardrobe item not found." };
    }
    await repo.updateState(customer.retailerId, parsed.data);
  } catch (error) {
    return {
      fieldErrors: {},
      formError:
        error instanceof Error ? error.message : "Could not update item.",
    };
  }

  revalidatePath("/wardrobe");
  return { fieldErrors: {}, success: true };
}

export async function retireWardrobeItem(
  _prevState: WardrobeActionState,
  formData: FormData,
): Promise<WardrobeActionState> {
  const session = await requireSession();
  const retailerId = z.string().uuid().safeParse(formData.get("retailerId"));
  const parsed = retireWardrobeItemInputSchema.safeParse({
    wardrobeItemId: formData.get("wardrobeItemId"),
    note: optionalString(formData.get("note")),
  });

  if (!retailerId.success || !parsed.success) {
    return {
      fieldErrors: {
        ...(!retailerId.success ? { retailerId: "Invalid retailer." } : {}),
        ...(!parsed.success ? zodFieldErrors(parsed.error) : {}),
      },
    };
  }

  const customer = await resolveCustomer(session.userId, retailerId.data);
  if (!customer) {
    return {
      fieldErrors: {},
      formError: "No relationship with this retailer.",
    };
  }

  try {
    const supabase = await getSupabaseServerClient();
    const repo = new WardrobeRepository(supabase);
    const existing = await repo.findById(parsed.data.wardrobeItemId as never);
    if (
      !existing ||
      existing.customerId !== customer.id ||
      existing.retailerId !== customer.retailerId
    ) {
      return { fieldErrors: {}, formError: "Wardrobe item not found." };
    }
    await repo.retire(customer.retailerId, parsed.data.wardrobeItemId as never);
  } catch (error) {
    return {
      fieldErrors: {},
      formError:
        error instanceof Error ? error.message : "Could not retire item.",
    };
  }

  revalidatePath("/wardrobe");
  return { fieldErrors: {}, success: true };
}

function optionalString(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}
