"use server";

import { CommercialInquiryRepository } from "@paon/database";
import {
  commercialInquiryInputSchema,
  type CommercialInquiryType,
} from "@paon/domain";

import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface CommercialInquiryActionState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  inquiryId?: string;
}

export async function submitCommercialInquiry(
  inquiryType: CommercialInquiryType,
  _previous: CommercialInquiryActionState,
  formData: FormData,
): Promise<CommercialInquiryActionState> {
  const result = commercialInquiryInputSchema.safeParse({
    inquiryType,
    companyName: formData.get("companyName"),
    contactName: formData.get("contactName"),
    email: formData.get("email"),
    websiteUrl: formData.get("websiteUrl"),
    objective: formData.get("objective"),
    requestedPlanKey: formData.get("requestedPlanKey"),
  });
  if (!result.success) {
    return {
      error: "Please review the highlighted details.",
      fieldErrors: result.error.flatten().fieldErrors,
    };
  }
  try {
    const inquiryId = await new CommercialInquiryRepository(
      await getSupabaseServerClient(),
    ).submit(result.data);
    return { inquiryId };
  } catch {
    return {
      error: "We could not save your request. Please try again in a moment.",
    };
  }
}
