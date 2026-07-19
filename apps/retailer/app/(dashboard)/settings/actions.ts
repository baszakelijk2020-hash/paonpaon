"use server";

import { requireRetailerRole } from "@paon/auth";
import { RetailerRepository } from "@paon/database";
import { updateRetailerProfileInputSchema } from "@paon/domain";
import { stripUndefined } from "@paon/utils";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface UpdateSettingsFormState {
  values: Record<string, string>;
  fieldErrors: Record<string, string>;
  formError?: string;
  success?: boolean;
}

export async function updateRetailerProfile(
  _prevState: UpdateSettingsFormState,
  formData: FormData,
): Promise<UpdateSettingsFormState> {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "admin");

  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;

  const parsed = updateRetailerProfileInputSchema.safeParse({
    legalName: raw["legalName"],
    displayName: raw["displayName"],
    primaryDomain: raw["primaryDomain"] || undefined,
    defaultLocale: raw["defaultLocale"],
    billingAddress: {
      line1: raw["billingLine1"],
      line2: raw["billingLine2"] || undefined,
      city: raw["billingCity"],
      region: raw["billingRegion"] || undefined,
      postalCode: raw["billingPostalCode"],
      countryCode: raw["billingCountryCode"],
    },
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      fieldErrors[key] ??= issue.message;
    }
    return { values: raw, fieldErrors };
  }

  const supabase = await getSupabaseServerClient();

  try {
    await new RetailerRepository(supabase).updateProfile(session.retailerId, {
      legalName: parsed.data.legalName,
      displayName: parsed.data.displayName,
      ...(parsed.data.primaryDomain
        ? { primaryDomain: parsed.data.primaryDomain }
        : {}),
      defaultLocale: parsed.data.defaultLocale,
      billingAddress: stripUndefined(parsed.data.billingAddress),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { values: raw, fieldErrors: {}, formError: message };
  }

  return { values: raw, fieldErrors: {}, success: true };
}
