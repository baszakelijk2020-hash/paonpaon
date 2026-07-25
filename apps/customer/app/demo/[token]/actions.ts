"use server";

import { CommercialProspectRepository } from "@paon/database";
import type { PublicProspectDemo } from "@paon/domain";

import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface OpenDemoState {
  error?: string;
  demo?: PublicProspectDemo;
}

export async function openPrivateDemo(
  publicToken: string,
  _previous: OpenDemoState,
  formData: FormData,
): Promise<OpenDemoState> {
  const accessCode = String(formData.get("accessCode") ?? "");
  if (accessCode.length < 6 || accessCode.length > 80) {
    return { error: "Enter the access code supplied with this demonstration." };
  }
  try {
    const demo = await new CommercialProspectRepository(
      await getSupabaseServerClient(),
    ).openPublishedDemo(publicToken, accessCode);
    return demo
      ? { demo }
      : {
          error:
            "This private demonstration is unavailable or the code is incorrect.",
        };
  } catch {
    return {
      error: "The demonstration could not be opened. Please try again.",
    };
  }
}
