"use server";

import { MessagingRepository } from "@paon/database";
import { asId } from "@paon/domain";

import { validateTableServiceInquiry } from "./table-service-validation";

import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface TableServiceFormState {
  values: Record<string, string>;
  fieldErrors: Record<string, string>;
  formError?: string;
  submitted?: boolean;
}

/**
 * The only anonymous-visitor write path in the customer app — runs
 * under the anon key, no session required. All real validation lives
 * in `submit_table_service_inquiry` (SECURITY DEFINER, ADR-034); this
 * action only shapes field errors for the form.
 */
export async function submitTableServiceInquiry(
  retailerId: string,
  _prevState: TableServiceFormState,
  formData: FormData,
): Promise<TableServiceFormState> {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;

  const validation = validateTableServiceInquiry({ ...raw, retailerId });
  if (!validation.ok) {
    return { values: raw, fieldErrors: validation.fieldErrors };
  }
  const { name, email, message, intent } = validation.value;

  const supabase = await getSupabaseServerClient();
  try {
    await new MessagingRepository(supabase).submitTableServiceInquiry({
      retailerId: asId<"RetailerId">(retailerId),
      name,
      email,
      intent,
      message,
    });
  } catch (error) {
    const formError =
      error instanceof Error ? error.message : "Something went wrong.";
    return { values: raw, fieldErrors: {}, formError };
  }

  return { values: {}, fieldErrors: {}, submitted: true };
}
