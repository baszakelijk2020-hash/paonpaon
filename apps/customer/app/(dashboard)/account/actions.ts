"use server";

import {
  CustomerConsentRepository,
  CustomerPreferencesRepository,
  CustomerRepository,
} from "@paon/database";
import {
  setCustomerConsentInputSchema,
  upsertCustomerPreferencesInputSchema,
  type ConsentPurpose,
  type ConsentStatus,
} from "@paon/domain";
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

function consentStatusForToggle(
  purpose: ConsentPurpose,
  enabled: boolean,
  current: ConsentStatus,
): ConsentStatus {
  if (enabled) return "granted";
  // Only mark personalization as withdrawn when turning off an active grant
  // so anonymization runs; never-granted stays denied.
  if (purpose === "personalization" && current === "granted") {
    return "withdrawn";
  }
  if (purpose === "personalization" && current === "withdrawn") {
    return "withdrawn";
  }
  return "denied";
}

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
  const personalizationOptIn = formData.get("personalizationOptIn") === "on";
  const locationOptIn = formData.get("locationOptIn") === "on";

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
    personalizationOptIn: personalizationOptIn ? "on" : "",
    locationOptIn: locationOptIn ? "on" : "",
  };

  const retailerId = retailerIdSchema.safeParse(rawRetailerId);
  const parsed = upsertCustomerPreferencesInputSchema.safeParse({
    preferredLocale: rawPreferredLocale,
    preferredCurrency: rawPreferredCurrency,
    communicationChannels: rawCommunicationChannels,
    styleNotes: rawStyleNotes || undefined,
    marketingOptIn,
    personalizationOptIn,
    locationOptIn,
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
    const consentRepo = new CustomerConsentRepository(supabase);
    const current = await consentRepo.getState(
      customer.retailerId,
      customer.id,
    );
    const consentUpdates: Array<{
      purpose: ConsentPurpose;
      status: ConsentStatus;
    }> = [
      {
        purpose: "personalization",
        status: consentStatusForToggle(
          "personalization",
          parsed.data.personalizationOptIn,
          current.personalization.status,
        ),
      },
      {
        purpose: "marketing",
        status: consentStatusForToggle(
          "marketing",
          parsed.data.marketingOptIn,
          current.marketing.status,
        ),
      },
      {
        purpose: "location",
        status: consentStatusForToggle(
          "location",
          parsed.data.locationOptIn,
          current.location.status,
        ),
      },
    ];

    for (const update of consentUpdates) {
      if (current[update.purpose].status === update.status) continue;
      const consentParsed = setCustomerConsentInputSchema.safeParse(update);
      if (!consentParsed.success) {
        return {
          values,
          fieldErrors: {},
          formError: "Invalid consent update.",
        };
      }
      await consentRepo.setConsent(customer.id, consentParsed.data);
    }

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
