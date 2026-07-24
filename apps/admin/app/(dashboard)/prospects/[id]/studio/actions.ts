"use server";

import { randomUUID } from "node:crypto";

import { requirePlatformOperator } from "@paon/auth";
import { CommercialProspectRepository } from "@paon/database";
import { saveProspectDemoConfigurationInputSchema } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface StudioActionState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: string;
}

export interface BrandAssetActionState {
  error?: string;
  publicUrl?: string;
}

const ALLOWED_ASSET_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
  "image/x-icon",
] as const;

export async function uploadBrandAsset(
  prospectId: string,
  _previous: BrandAssetActionState,
  formData: FormData,
): Promise<BrandAssetActionState> {
  requirePlatformOperator(await getSession());
  const file = formData.get("asset");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a brand image." };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { error: "Brand assets must be 5 MB or smaller." };
  }
  if (
    !ALLOWED_ASSET_TYPES.includes(
      file.type as (typeof ALLOWED_ASSET_TYPES)[number],
    )
  ) {
    return { error: "Use SVG, ICO, JPEG, PNG or WebP." };
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120);
  const path = `${prospectId}/${randomUUID()}-${safeName}`;
  const client = await getSupabaseServerClient();
  const { error } = await client.storage
    .from("demo-brand-assets")
    .upload(path, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: false,
    });
  if (error) return { error: error.message };
  const { data } = client.storage.from("demo-brand-assets").getPublicUrl(path);
  return { publicUrl: data.publicUrl };
}

export async function saveStudioConfiguration(
  prospectId: string,
  _previous: StudioActionState,
  formData: FormData,
): Promise<StudioActionState> {
  requirePlatformOperator(await getSession());
  const locations = String(formData.get("locations") ?? "")
    .split("\n")
    .map((line) => line.split("|").map((part) => part.trim()))
    .filter(([name, city]) => name && city)
    .map(([name, city]) => ({ name, city }));
  const parsed = saveProspectDemoConfigurationInputSchema.safeParse({
    prospectId,
    planId: formData.get("planId"),
    theme: {
      logoUrl: formData.get("logoUrl"),
      faviconUrl: formData.get("faviconUrl"),
      heroImageUrl: formData.get("heroImageUrl"),
      accentColor: formData.get("accentColor"),
      surfaceColor: formData.get("surfaceColor"),
      inkColor: formData.get("inkColor"),
      displayFont: formData.get("displayFont"),
      bodyFont: formData.get("bodyFont"),
      cornerStyle: formData.get("cornerStyle"),
    },
    marketingHeadline: formData.get("marketingHeadline"),
    personalizedIntroduction: formData.get("personalizedIntroduction"),
    locations,
    productMix: formData.getAll("productMix"),
    featureKeys: formData.getAll("featureKeys"),
    changeNote: formData.get("changeNote"),
  });
  if (!parsed.success) {
    return {
      error: "Review the configuration before saving this version.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    const version = await new CommercialProspectRepository(
      await getSupabaseServerClient(),
    ).saveConfiguration(parsed.data);
    revalidatePath(`/prospects/${prospectId}/studio`);
    return { success: `Demo configuration version ${version} saved.` };
  } catch {
    return { error: "The demo configuration could not be saved." };
  }
}
