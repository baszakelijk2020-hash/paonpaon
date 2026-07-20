"use server";

import { NewsletterRepository } from "@paon/database";
import { asId } from "@paon/domain";

import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface NewsletterState {
  formError?: string;
  subscribed?: boolean;
}

export async function subscribeToNewsletter(
  retailerId: string,
  _prevState: NewsletterState,
  formData: FormData,
): Promise<NewsletterState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email || !email.includes("@")) {
    return { formError: "A valid email is required." };
  }

  const supabase = await getSupabaseServerClient();
  try {
    await new NewsletterRepository(supabase).subscribe(
      asId<"RetailerId">(retailerId),
      email,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { formError: message };
  }
  return { subscribed: true };
}
