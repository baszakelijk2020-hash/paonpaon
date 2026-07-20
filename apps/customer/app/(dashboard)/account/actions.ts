"use server";

import {
  CustomerPreferencesRepository,
  CustomerRepository,
} from "@paon/database";
import { upsertCustomerPreferencesInputSchema } from "@paon/domain";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface PreferencesFormState {
  values: Record<string, string | string[]>;
  fieldErrors: Record<string, string>;
  formError?: string;
  success?: boolean;
}

const retailerIdSchema = z.string().uuid();

export async function savePreferences(
  _prevState: PreferencesFormState,
  formData: FormData,
): Promise<PreferencesFormState> {
  const session = await requireSession();

  const rawRetailerId = formData.get("retailerId");
  const rawPreferredLocale = formData.get("preferredLocale");
  const rawPreferredCurrency = formData.get("preferredCurrency");
  const rawCommunicationChannels = formData.getAll("communicationChannels");
  const rawStyleNotes = formData.get("styleNotes");
  const marketingOptIn = formData.get("marketingOptIn") === "on";

  const values: Record<string, string | string[]> = {
    retailerId: typeof rawRetailerId === "string" ? rawRetailerId : "",
    preferredLocale:
      typeof rawPreferredLocale === "string" ? rawPreferredLocale : "",
    preferredCurrency:
      typeof rawPreferredCurrency === "string" ? rawPreferredCurrency : "",
    communicationChannels: rawCommunicationChannels.filter(
      (value): value is string => typeof value === "string",
    ),
    styleNotes: typeof rawStyleNotes === "string" ? rawStyleNotes : "",
    marketingOptIn: marketingOptIn ? "on" : "",
  };

  const retailerId = retailerIdSchema.safeParse(rawRetailerId);
  const parsed = upsertCustomerPreferencesInputSchema.safeParse({
    preferredLocale: rawPreferredLocale,
    preferredCurrency: rawPreferredCurrency,
    communicationChannels: rawCommunicationChannels,
    styleNotes: rawStyleNotes || undefined,
    marketingOptIn,
  });

  if (!retailerId.success || !parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.success ? [] : parsed.error.issues) {
      const key = issue.path.join(".");
      fieldErrors[key] ??= issue.message;
    }
    if (!retailerId.success) {
      fieldErrors["retailerId"] = "Invalid retailer.";
    }
    return { values, fieldErrors };
  }

  const supabase = await getSupabaseServerClient();
  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const customer = customers.find(
    (candidate) => candidate.retailerId === (retailerId.data as never),
  );
  if (!customer) {
    return {
      values,
      fieldErrors: {},
      formError: "No relationship with this retailer.",
    };
  }

  try {
    await new CustomerPreferencesRepository(supabase).upsert(
      customer.id,
      parsed.data,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { values, fieldErrors: {}, formError: message };
  }

  revalidatePath("/account");
  return { values, fieldErrors: {}, success: true };
}
