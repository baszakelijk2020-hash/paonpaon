"use server";

import { requireRetailerRole } from "@paon/auth";
import {
  CustomerRepository,
  ProductRepository,
  RetailerStaffRepository,
  WardrobeRepository,
} from "@paon/database";
import {
  asId,
  createAdvisorExternalWardrobeItemInputSchema,
  createCatalogueWardrobeItemInputSchema,
  GARMENT_CATEGORIES,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface RetailerWardrobeActionState {
  fieldErrors: Record<string, string>;
  formError?: string;
  success?: boolean;
}

function optionalString(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function zodFieldErrors(error: {
  issues: readonly { path: PropertyKey[]; message: string }[];
}): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "form";
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}

export async function addAdvisorExternalWardrobeItem(
  _prevState: RetailerWardrobeActionState,
  formData: FormData,
): Promise<RetailerWardrobeActionState> {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "sales_associate");

  const parsed = createAdvisorExternalWardrobeItemInputSchema.safeParse({
    retailerId: session.retailerId,
    customerId: formData.get("customerId"),
    categoryCode: formData.get("categoryCode"),
    displayName: formData.get("displayName"),
    brand: optionalString(formData.get("brand")),
    description: optionalString(formData.get("description")),
    condition: formData.get("condition") || "good",
    careState: formData.get("careState") || "current",
    fitPerception: formData.get("fitPerception") || "unknown",
    fitNotes: optionalString(formData.get("fitNotes")),
    productId: optionalString(formData.get("productId")),
  });

  if (!parsed.success) {
    return { fieldErrors: zodFieldErrors(parsed.error) };
  }

  const client = await getSupabaseServerClient();
  const customer = await new CustomerRepository(client).findById(
    asId<"CustomerId">(parsed.data.customerId),
  );
  if (!customer || customer.retailerId !== session.retailerId) {
    return { fieldErrors: {}, formError: "Customer not found." };
  }

  const staff = await new RetailerStaffRepository(client).findByUserId(
    session.userId,
  );
  if (!staff || staff.retailerId !== session.retailerId) {
    return { fieldErrors: {}, formError: "Active staff membership required." };
  }

  try {
    await new WardrobeRepository(client).createAdvisorExternalItem(
      {
        ...parsed.data,
        retailerId: session.retailerId,
        customerId: customer.id,
      },
      staff.id,
    );
  } catch (error) {
    return {
      fieldErrors: {},
      formError: error instanceof Error ? error.message : "Could not add item.",
    };
  }

  revalidatePath(`/customers/${customer.id}`);
  return { fieldErrors: {}, success: true };
}

export async function addCatalogueWardrobeItem(
  _prevState: RetailerWardrobeActionState,
  formData: FormData,
): Promise<RetailerWardrobeActionState> {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "sales_associate");

  const productId = optionalString(formData.get("productId"));
  const client = await getSupabaseServerClient();
  const customerIdRaw = String(formData.get("customerId") ?? "");

  const customer = await new CustomerRepository(client).findById(
    asId<"CustomerId">(customerIdRaw),
  );
  if (!customer || customer.retailerId !== session.retailerId) {
    return { fieldErrors: {}, formError: "Customer not found." };
  }

  if (!productId) {
    return { fieldErrors: { productId: "Select a catalogue product." } };
  }

  const product = await new ProductRepository(client).findById(
    asId<"ProductId">(productId),
  );
  if (!product || product.retailerId !== session.retailerId) {
    return { fieldErrors: { productId: "Product not found in this house." } };
  }

  const categoryGuess =
    GARMENT_CATEGORIES.find((code) =>
      product.name.toLowerCase().includes(code),
    ) ?? "other";

  const parsed = createCatalogueWardrobeItemInputSchema.safeParse({
    retailerId: session.retailerId,
    customerId: customer.id,
    categoryCode: formData.get("categoryCode") || categoryGuess,
    displayName: optionalString(formData.get("displayName")) ?? product.name,
    brand: optionalString(formData.get("brand")),
    description: optionalString(formData.get("description")),
    condition: formData.get("condition") || "new",
    careState: formData.get("careState") || "current",
    fitPerception: formData.get("fitPerception") || "unknown",
    productId: product.id,
    orderLineId: optionalString(formData.get("orderLineId")),
  });

  if (!parsed.success) {
    return { fieldErrors: zodFieldErrors(parsed.error) };
  }

  const staff = await new RetailerStaffRepository(client).findByUserId(
    session.userId,
  );
  if (!staff || staff.retailerId !== session.retailerId) {
    return { fieldErrors: {}, formError: "Active staff membership required." };
  }

  try {
    await new WardrobeRepository(client).createCatalogueItem(
      {
        ...parsed.data,
        retailerId: session.retailerId,
        customerId: customer.id,
        productId: product.id,
      },
      staff.id,
    );
  } catch (error) {
    return {
      fieldErrors: {},
      formError: error instanceof Error ? error.message : "Could not add item.",
    };
  }

  revalidatePath(`/customers/${customer.id}`);
  return { fieldErrors: {}, success: true };
}
