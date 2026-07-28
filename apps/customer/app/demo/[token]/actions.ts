"use server";

import { CommercialProspectRepository } from "@paon/database";
import type { PublicProspectDemo } from "@paon/domain";

import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface OpenDemoState {
  error?: string;
  demo?: PublicProspectDemo;
}

const ERROR_COPY: Record<string, string> = {
  expired: "This private demonstration has expired.",
  revoked: "This private demonstration has been revoked.",
  invalid_code: "That access code is incorrect.",
  not_found: "This private demonstration could not be found.",
  unavailable: "This private demonstration is not available yet.",
};

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
    const result = await new CommercialProspectRepository(
      await getSupabaseServerClient(),
    ).openPublishedDemo(publicToken, accessCode);
    if (!result) {
      return {
        error:
          "This private demonstration is unavailable or the code is incorrect.",
      };
    }
    if ("error" in result) {
      return {
        error:
          ERROR_COPY[result.error] ??
          "This private demonstration is unavailable or the code is incorrect.",
      };
    }
    return { demo: result };
  } catch {
    return {
      error: "The demonstration could not be opened. Please try again.",
    };
  }
}
