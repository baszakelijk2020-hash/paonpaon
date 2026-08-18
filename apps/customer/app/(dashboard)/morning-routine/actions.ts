"use server";

import {
  CustomerRepository,
  MorningRoutineRepository,
  OrderRepository,
  WishlistRepository,
} from "@paon/database";
import {
  asId,
  generateMorningRoutineInputSchema,
  morningRoutineActionInputSchema,
} from "@paon/domain";
import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";

import { buildAndPersistMorningRoutineSelection } from "./generation";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface MorningRoutineActionState {
  fieldErrors: Record<string, string>;
  formError?: string;
  success?: boolean;
  selectionId?: string;
}

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
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

function optionalString(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function resolveCustomerForUser(
  userId: string,
  retailerId: string,
  customerId: string,
) {
  const supabase = await getSupabaseServerClient();
  const customers = await new CustomerRepository(supabase).findByUserId(
    userId as never,
  );
  const customer = customers.find(
    (candidate) =>
      candidate.id === customerId && candidate.retailerId === retailerId,
  );
  if (!customer) return null;
  return { customer, supabase };
}

export async function generateMorningRoutineSelection(
  _prevState: MorningRoutineActionState,
  formData: FormData,
): Promise<MorningRoutineActionState> {
  const session = await requireSession();
  const parsed = generateMorningRoutineInputSchema.safeParse({
    retailerId: formData.get("retailerId"),
    customerId: formData.get("customerId"),
    forDate: optionalString(formData.get("forDate")) ?? todayUtcDate(),
    occasionLabel: optionalString(formData.get("occasionLabel")),
  });
  if (!parsed.success) {
    return { fieldErrors: zodFieldErrors(parsed.error) };
  }

  const owned = await resolveCustomerForUser(
    session.userId,
    parsed.data.retailerId,
    parsed.data.customerId,
  );
  if (!owned) {
    return { fieldErrors: {}, formError: "Customer relationship not found." };
  }

  const { customer, supabase } = owned;
  const retailerId = asId<"RetailerId">(customer.retailerId);
  const customerId = asId<"CustomerId">(customer.id);
  const forDate = parsed.data.forDate ?? todayUtcDate();

  try {
    const selectionId = await buildAndPersistMorningRoutineSelection({
      supabase,
      retailerId,
      customerId,
      forDate,
      ...(parsed.data.occasionLabel
        ? { occasionLabel: parsed.data.occasionLabel }
        : {}),
    });

    revalidatePath("/morning-routine");
    revalidatePath("/dashboard");
    return {
      fieldErrors: {},
      success: true,
      selectionId,
    };
  } catch (error) {
    return {
      fieldErrors: {},
      formError:
        error instanceof Error
          ? error.message
          : "Could not build today’s routine.",
    };
  }
}

/**
 * Plain-form adapter for `runMorningRoutineAction` — that action is shaped
 * for `useActionState` (prevState + formData) so `/morning-routine`'s client
 * panel can show pending/error state; the dashboard hero is a Server
 * Component with no client state to update, so it needs a bare
 * `(formData) => Promise<void>` action instead of the two-arg signature.
 */
export async function saveMorningRoutinePick(
  formData: FormData,
): Promise<void> {
  await runMorningRoutineAction({ fieldErrors: {} }, formData);
}

export async function runMorningRoutineAction(
  _prevState: MorningRoutineActionState,
  formData: FormData,
): Promise<MorningRoutineActionState> {
  const session = await requireSession();
  const parsed = morningRoutineActionInputSchema.safeParse({
    selectionId: formData.get("selectionId"),
    recommendationId: optionalString(formData.get("recommendationId")),
    action: formData.get("action"),
    productVariantId: optionalString(formData.get("productVariantId")),
    retailerId: formData.get("retailerId"),
    reviewNote: optionalString(formData.get("reviewNote")),
  });
  if (!parsed.success) {
    return { fieldErrors: zodFieldErrors(parsed.error) };
  }

  const supabase = await getSupabaseServerClient();
  const routineRepo = new MorningRoutineRepository(supabase);
  const view = await routineRepo.findById(parsed.data.selectionId);
  if (!view) {
    return { fieldErrors: {}, formError: "Routine selection not found." };
  }

  const owned = await resolveCustomerForUser(
    session.userId,
    view.selection.retailerId,
    view.selection.customerId,
  );
  if (!owned || owned.customer.retailerId !== parsed.data.retailerId) {
    return { fieldErrors: {}, formError: "Not authorized for this routine." };
  }

  try {
    if (parsed.data.action === "save") {
      if (parsed.data.productVariantId) {
        await new WishlistRepository(supabase).toggleItem(
          asId<"RetailerId">(parsed.data.retailerId),
          asId<"ProductVariantId">(parsed.data.productVariantId),
        );
      }
      await routineRepo.markReview(parsed.data.selectionId, "saved");
      revalidatePath("/wishlist");
    } else if (parsed.data.action === "review") {
      await routineRepo.markReview(parsed.data.selectionId, "reviewed");
    } else if (parsed.data.action === "book" || parsed.data.action === "buy") {
      // Navigation-only actions — authorization already verified.
    }

    revalidatePath("/morning-routine");
    return { fieldErrors: {}, success: true };
  } catch (error) {
    return {
      fieldErrors: {},
      formError:
        error instanceof Error ? error.message : "Could not complete action.",
    };
  }
}

export interface BuyMorningRoutineItemState {
  fieldErrors: Record<string, string>;
  formError?: string;
  success?: boolean;
  orderId?: string;
  notEligible?: boolean;
  productHref?: string;
}

export async function buyMorningRoutineItem(
  _prevState: BuyMorningRoutineItemState,
  formData: FormData,
): Promise<BuyMorningRoutineItemState> {
  const session = await requireSession();
  const retailerId = formData.get("retailerId");
  const productVariantId = formData.get("productVariantId");
  const productHref = formData.get("productHref");

  if (typeof retailerId !== "string" || retailerId.trim() === "") {
    return { fieldErrors: { retailerId: "Retailer ID required." } };
  }
  if (typeof productVariantId !== "string" || productVariantId.trim() === "") {
    return {
      fieldErrors: { productVariantId: "Product variant ID required." },
    };
  }
  if (typeof productHref !== "string") {
    return { fieldErrors: { productHref: "Product link required." } };
  }

  try {
    const supabase = await getSupabaseServerClient();
    const customers = await new CustomerRepository(supabase).findByUserId(
      session.userId as never,
    );
    const customer = customers.find((c) => c.retailerId === retailerId);
    if (!customer) {
      return { fieldErrors: {}, formError: "Customer relationship not found." };
    }

    // Check one-tap-checkout eligibility: customer must have a saved default address
    const hasDefaultAddress =
      customer.shippingAddresses && customer.shippingAddresses.length > 0;
    if (!hasDefaultAddress) {
      // Not eligible — signal UI to fall back to product page link
      return {
        fieldErrors: {},
        notEligible: true,
        productHref,
      };
    }

    // Eligible — add to cart
    const orderRepo = new OrderRepository(supabase);
    const orderId = await orderRepo.addToCart({
      retailerId: asId<"RetailerId">(retailerId),
      productVariantId,
      quantity: 1,
    });

    revalidatePath("/morning-routine");
    return {
      fieldErrors: {},
      success: true,
      orderId,
    };
  } catch (error) {
    return {
      fieldErrors: {},
      formError:
        error instanceof Error ? error.message : "Could not add item to cart.",
    };
  }
}
