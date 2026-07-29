"use server";

import { requirePlatformOperator } from "@paon/auth";
import { CommercialInquiryRepository } from "@paon/database";
import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const STATUSES = ["new", "reviewed", "converted", "closed"] as const;

export async function updateInquiryStatus(formData: FormData): Promise<void> {
  requirePlatformOperator(await getSession());
  const id = String(formData.get("inquiryId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !STATUSES.includes(status as (typeof STATUSES)[number])) {
    return;
  }
  await new CommercialInquiryRepository(
    await getSupabaseServerClient(),
  ).updateStatus(id, status as (typeof STATUSES)[number]);
  revalidatePath("/inquiries");
}
