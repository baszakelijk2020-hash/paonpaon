"use server";

import { requirePlatformOperator } from "@paon/auth";
import { CommercialProspectRepository } from "@paon/database";
import {
  createCommercialProspectInputSchema,
  updateCommercialProspectContactInputSchema,
} from "@paon/domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface ProspectActionState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export async function createProspect(
  _previous: ProspectActionState,
  formData: FormData,
): Promise<ProspectActionState> {
  requirePlatformOperator(await getSession());
  const opportunities = String(formData.get("observedOpportunities") ?? "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  const dueDate = String(formData.get("nextActionDueDate") ?? "");
  const parsed = createCommercialProspectInputSchema.safeParse({
    companyName: formData.get("companyName"),
    websiteUrl: formData.get("websiteUrl"),
    primaryContactName: formData.get("primaryContactName"),
    primaryContactEmail: formData.get("primaryContactEmail"),
    primaryContactPhone: formData.get("primaryContactPhone"),
    source: formData.get("source"),
    salesNotes: formData.get("salesNotes"),
    observedOpportunities: opportunities,
    recommendedPlanId: formData.get("recommendedPlanId") || undefined,
    nextAction: formData.get("nextAction"),
    nextActionDueAt: dueDate
      ? new Date(`${dueDate}T09:00:00.000Z`).toISOString()
      : undefined,
  });
  if (!parsed.success) {
    return {
      error: "Review the prospect details.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const id = await new CommercialProspectRepository(
    await getSupabaseServerClient(),
  ).create(parsed.data);
  redirect(`/prospects/${id}/studio`);
}

const STAGES = [
  "researched",
  "qualified",
  "demo_preparation",
  "demo_ready",
  "demo_sent",
  "consultation",
  "proposal",
  "pilot",
  "converted",
  "lost",
] as const;

export interface ProspectStageActionState {
  formError?: string;
  saved?: boolean;
}

export async function updateProspectStage(
  _previous: ProspectStageActionState,
  formData: FormData,
): Promise<ProspectStageActionState> {
  requirePlatformOperator(await getSession());
  const prospectId = String(formData.get("prospectId") ?? "");
  const stage = String(formData.get("stage") ?? "");
  if (!prospectId || !STAGES.includes(stage as (typeof STAGES)[number])) {
    return { formError: "Invalid prospect ID or stage." };
  }

  try {
    await new CommercialProspectRepository(
      await getSupabaseServerClient(),
    ).updateStage(prospectId, stage as (typeof STAGES)[number]);
  } catch (error) {
    return {
      formError:
        error instanceof Error
          ? error.message
          : "Could not update prospect stage.",
    };
  }

  revalidatePath("/prospects");
  revalidatePath(`/prospects/${prospectId}/studio`);
  return { saved: true };
}

export interface ProspectContactActionState {
  error?: string;
  saved?: boolean;
}

export async function updateProspectContact(
  _previous: ProspectContactActionState,
  formData: FormData,
): Promise<ProspectContactActionState> {
  requirePlatformOperator(await getSession());
  const prospectId = String(formData.get("prospectId") ?? "");
  if (!prospectId) return { error: "Missing prospect." };

  const parsed = updateCommercialProspectContactInputSchema.safeParse({
    companyName: formData.get("companyName"),
    websiteUrl: formData.get("websiteUrl"),
    primaryContactName: formData.get("primaryContactName"),
    primaryContactEmail: formData.get("primaryContactEmail"),
    primaryContactPhone: formData.get("primaryContactPhone"),
    nextAction: formData.get("nextAction"),
  });
  if (!parsed.success) {
    return { error: "Review the contact details." };
  }

  await new CommercialProspectRepository(
    await getSupabaseServerClient(),
  ).updateContact(prospectId, parsed.data);
  revalidatePath("/prospects");
  revalidatePath(`/prospects/${prospectId}/studio`);
  return { saved: true };
}
