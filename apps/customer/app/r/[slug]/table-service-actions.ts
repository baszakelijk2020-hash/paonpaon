"use server";

import { MessagingRepository } from "@paon/database";
import { type ConversationIntent, asId } from "@paon/domain";

import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface TableServiceFormState {
  values: Record<string, string>;
  fieldErrors: Record<string, string>;
  formError?: string;
  submitted?: boolean;
}

const INTENTS: ConversationIntent[] = [
  "wedding",
  "shirts",
  "style_help",
  "freeform",
];

function isConversationIntent(value: string): value is ConversationIntent {
  return (INTENTS as string[]).includes(value);
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
  const fieldErrors: Record<string, string> = {};

  const name = (raw["name"] ?? "").trim();
  const email = (raw["email"] ?? "").trim();
  const message = (raw["message"] ?? "").trim();
  const intentRaw = raw["intent"] ?? "freeform";

  if (!name) fieldErrors["name"] = "Your name is required.";
  if (!email || !email.includes("@")) {
    fieldErrors["email"] = "A valid email is required.";
  }
  if (!message) fieldErrors["message"] = "Tell us what you're looking for.";
  if (!isConversationIntent(intentRaw)) {
    fieldErrors["intent"] = "Unrecognized selection.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { values: raw, fieldErrors };
  }

  const supabase = await getSupabaseServerClient();
  try {
    await new MessagingRepository(supabase).submitTableServiceInquiry({
      retailerId: asId<"RetailerId">(retailerId),
      name,
      email,
      intent: intentRaw as ConversationIntent,
      message,
    });
  } catch (error) {
    const formError =
      error instanceof Error ? error.message : "Something went wrong.";
    return { values: raw, fieldErrors: {}, formError };
  }

  return { values: {}, fieldErrors: {}, submitted: true };
}
