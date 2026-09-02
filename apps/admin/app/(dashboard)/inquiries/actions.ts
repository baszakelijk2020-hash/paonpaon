"use server";

import { requirePlatformOperator } from "@paon/auth";
import { CommercialInquiryRepository } from "@paon/database";
import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const STATUSES = ["new", "reviewed", "converted", "closed"] as const;

export interface InquiryStatusActionState {
  formError?: string;
  saved?: boolean;
}

export async function updateInquiryStatus(
  _previous: InquiryStatusActionState,
  formData: FormData,
): Promise<InquiryStatusActionState> {
  requirePlatformOperator(await getSession());
  const id = String(formData.get("inquiryId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !STATUSES.includes(status as (typeof STATUSES)[number])) {
    return { formError: "Invalid inquiry ID or status." };
  }

  try {
    await new CommercialInquiryRepository(
      await getSupabaseServerClient(),
    ).updateStatus(id, status as (typeof STATUSES)[number]);
  } catch (error) {
    return {
      formError:
        error instanceof Error
          ? error.message
          : "Could not update inquiry status.",
    };
  }

  revalidatePath("/inquiries");
  return { saved: true };
}
