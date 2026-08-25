"use server";

import {
  CustomerRepository,
  MessagingRepository,
  WardrobeRepository,
} from "@paon/database";
import {
  createExternalWardrobeItemInputSchema,
  requestWardrobeItemServiceInputSchema,
  retireWardrobeItemInputSchema,
  updateWardrobeItemStateInputSchema,
  wardrobeReorderRequestMessage,
  wardrobeServiceRequestMessage,
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

export interface WardrobeServiceRequestState extends WardrobeActionState {
  conversationId?: string;
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

/**
 * PHASE 17.13's own named gap ("Book an alteration"/"Book a cleaning" per
 * `docs/vision/PAON_VIRTUAL_TRYON_AND_OOTD_ECONOMICS.md` §17) — a customer
 * viewing their own wardrobe item raises a real service request. Reuses
 * the existing conversation/messaging primitives verbatim
 * (`getOrCreateForCustomer`/`send`, both already re-deriving the caller's
 * own identity server-side via `auth.uid()`) rather than a new request
 * table: the retailer's existing Messages inbox is where staff already
 * triage exactly this kind of ask, and a real alteration/cleaning work
 * order needs the garment physically in hand regardless — this creates
 * the real touchpoint, not a fabricated downstream object.
 */
export async function requestWardrobeItemService(
  _prevState: WardrobeServiceRequestState,
  formData: FormData,
): Promise<WardrobeServiceRequestState> {
  const session = await requireSession();
  const parsed = requestWardrobeItemServiceInputSchema.safeParse({
    wardrobeItemId: formData.get("wardrobeItemId"),
    retailerId: formData.get("retailerId"),
    kind: formData.get("kind"),
  });

  if (!parsed.success) {
    return { fieldErrors: zodFieldErrors(parsed.error) };
  }

  const customer = await resolveCustomer(
    session.userId,
    parsed.data.retailerId,
  );
  if (!customer) {
    return {
      fieldErrors: {},
      formError: "No relationship with this retailer.",
    };
  }

  try {
    const supabase = await getSupabaseServerClient();
    const wardrobeRepo = new WardrobeRepository(supabase);
    const item = await wardrobeRepo.findById(
      parsed.data.wardrobeItemId as never,
    );
    if (
      !item ||
      item.customerId !== customer.id ||
      item.retailerId !== customer.retailerId
    ) {
      return { fieldErrors: {}, formError: "Wardrobe item not found." };
    }

    const messagingRepo = new MessagingRepository(supabase);
    const conversationId = await messagingRepo.getOrCreateForCustomer(
      customer.retailerId,
    );
    await messagingRepo.send(
      conversationId,
      wardrobeServiceRequestMessage({
        kind: parsed.data.kind,
        itemDisplayName: item.displayName,
        ...(item.brand ? { itemBrand: item.brand } : {}),
      }),
    );

    return { fieldErrors: {}, success: true, conversationId };
  } catch (error) {
    return {
      fieldErrors: {},
      formError:
        error instanceof Error ? error.message : "Could not send request.",
    };
  }
}

/**
 * Order Again's fallback when a wardrobe item has no linked product/variant
 * to repurchase directly — reuses the exact real conversation channel as
 * {@link requestWardrobeItemService} rather than a broken repurchase link.
 */
export async function requestWardrobeItemReorderViaAdvisor(
  _prevState: WardrobeServiceRequestState,
  formData: FormData,
): Promise<WardrobeServiceRequestState> {
  const session = await requireSession();
  const wardrobeItemId = z
    .string()
    .uuid()
    .safeParse(formData.get("wardrobeItemId"));
  const retailerId = z.string().uuid().safeParse(formData.get("retailerId"));

  if (!wardrobeItemId.success || !retailerId.success) {
    return {
      fieldErrors: {
        ...(!wardrobeItemId.success
          ? { wardrobeItemId: "Invalid wardrobe item." }
          : {}),
        ...(!retailerId.success ? { retailerId: "Invalid retailer." } : {}),
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
    const wardrobeRepo = new WardrobeRepository(supabase);
    const item = await wardrobeRepo.findById(wardrobeItemId.data as never);
    if (
      !item ||
      item.customerId !== customer.id ||
      item.retailerId !== customer.retailerId
    ) {
      return { fieldErrors: {}, formError: "Wardrobe item not found." };
    }

    const messagingRepo = new MessagingRepository(supabase);
    const conversationId = await messagingRepo.getOrCreateForCustomer(
      customer.retailerId,
    );
    await messagingRepo.send(
      conversationId,
      wardrobeReorderRequestMessage({
        itemDisplayName: item.displayName,
        ...(item.brand ? { itemBrand: item.brand } : {}),
      }),
    );

    return { fieldErrors: {}, success: true, conversationId };
  } catch (error) {
    return {
      fieldErrors: {},
      formError:
        error instanceof Error ? error.message : "Could not send request.",
    };
  }
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
