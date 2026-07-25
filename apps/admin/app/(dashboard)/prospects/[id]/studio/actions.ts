"use server";

import { randomBytes, randomUUID } from "node:crypto";

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

export interface DemoEnvironmentActionState {
  error?: string;
  success?: string;
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

export async function generateDemoEnvironment(
  prospectId: string,
  _previous: DemoEnvironmentActionState,
  formData: FormData,
): Promise<DemoEnvironmentActionState> {
  requirePlatformOperator(await getSession());
  const accessCode = String(formData.get("accessCode") ?? "").trim();
  const expiryDays = Number(formData.get("expiryDays"));
  if (
    accessCode.length < 6 ||
    accessCode.length > 80 ||
    !Number.isInteger(expiryDays) ||
    expiryDays < 1 ||
    expiryDays > 90
  ) {
    return {
      error: "Use a 6–80 character access code and an expiry from 1–90 days.",
    };
  }
  const repository = new CommercialProspectRepository(
    await getSupabaseServerClient(),
  );
  const [prospect, configuration] = await Promise.all([
    repository.findById(prospectId),
    repository.findConfiguration(prospectId),
  ]);
  if (!prospect || !configuration || configuration.currentVersion < 1) {
    return { error: "Save a complete Demo Studio configuration first." };
  }
  const hero = configuration.theme.heroImageUrl;
  const syntheticData = {
    personas: [
      {
        key: "owner",
        label: "Retailer owner",
        attention:
          "Two service promises and one growth decision need attention.",
        primaryAction: "Review today’s commercial brief",
      },
      {
        key: "manager",
        label: "Retailer manager",
        attention: "The afternoon fitting schedule has one preparation gap.",
        primaryAction: "Balance the floor",
      },
      {
        key: "advisor",
        label: "Sales advisor",
        attention: "Isabelle’s fitting begins in 45 minutes.",
        primaryAction: "Prepare the relationship brief",
      },
      {
        key: "operations",
        label: "Production & operations",
        attention: "One delivery promise is approaching its handoff deadline.",
        primaryAction: "Review garments in motion",
      },
      {
        key: "workshop_manager",
        label: "Workshop manager",
        attention: "Three garments need assignment before noon.",
        primaryAction: "Open the workroom queue",
      },
      {
        key: "worker",
        label: "Alteration specialist",
        attention: "The midnight dinner jacket is ready for hand-finishing.",
        primaryAction: "Continue assigned work",
      },
      {
        key: "customer",
        label: "Private client",
        attention: "Your jacket has moved into completion review.",
        primaryAction: "View the garment story",
      },
    ],
    customers: [
      {
        name: "Isabelle Laurent",
        tier: "Private client",
        nextMoment: "Wedding fitting · Today 14:30",
        lifetimeValue: "€18,450",
      },
      {
        name: "Theo Bennett",
        tier: "Returning client",
        nextMoment: "Collection preview · Friday",
        lifetimeValue: "€9,820",
      },
      {
        name: "Sofia Marin",
        tier: "New relationship",
        nextMoment: "First consultation · Tomorrow",
        lifetimeValue: "€2,450",
      },
    ],
    products: [
      {
        name: "Midnight dinner jacket",
        category: "Tailoring",
        price: "€2,950",
        ...(hero ? { imageUrl: hero } : {}),
      },
      {
        name: "Ivory silk evening shirt",
        category: "Formalwear",
        price: "€740",
      },
      {
        name: "Hand-finished travel blazer",
        category: "Made to measure",
        price: "€2,250",
      },
    ],
    appointments: [
      {
        time: "10:00",
        customer: "Theo Bennett",
        purpose: "Collection preview",
        status: "Prepared",
      },
      {
        time: "14:30",
        customer: "Isabelle Laurent",
        purpose: "Wedding fitting",
        status: "Needs preparation",
      },
      {
        time: "17:00",
        customer: "Sofia Marin",
        purpose: "Private consultation",
        status: "Confirmed",
      },
    ],
    alterations: [
      {
        garment: "Midnight dinner jacket",
        customer: "Isabelle Laurent",
        status: "Hand finishing",
        progress: 72,
        due: "Tomorrow",
      },
      {
        garment: "Navy travel blazer",
        customer: "Theo Bennett",
        status: "Completion review",
        progress: 88,
        due: "Friday",
      },
      {
        garment: "Silk evening trousers",
        customer: "Sofia Marin",
        status: "Fitting captured",
        progress: 24,
        due: "Next week",
      },
    ],
    orders: [
      {
        reference: "PAON-1048",
        customer: "Isabelle Laurent",
        status: "In atelier",
        value: "€3,690",
      },
      {
        reference: "PAON-1042",
        customer: "Theo Bennett",
        status: "Ready for delivery",
        value: "€2,250",
      },
    ],
    metrics: {
      relationshipValue: "€184k",
      appointmentsToday: 7,
      garmentsInMotion: 18,
      returnRate: "68%",
    },
  };
  try {
    await repository.generateEnvironment({
      prospectId,
      publicToken: randomBytes(32).toString("base64url"),
      accessCode,
      expiresAt: new Date(
        Date.now() + expiryDays * 24 * 60 * 60 * 1000,
      ).toISOString(),
      syntheticData,
    });
    revalidatePath(`/prospects/${prospectId}/studio`);
    return {
      success:
        "Isolated synthetic environment generated. Review every role before publishing.",
    };
  } catch {
    return { error: "The isolated demo environment could not be generated." };
  }
}

export async function setDemoPublication(formData: FormData): Promise<void> {
  requirePlatformOperator(await getSession());
  const prospectId = String(formData.get("prospectId") ?? "");
  const publish = formData.get("publish") === "true";
  await new CommercialProspectRepository(
    await getSupabaseServerClient(),
  ).setEnvironmentPublished(prospectId, publish);
  revalidatePath(`/prospects/${prospectId}/studio`);
  revalidatePath("/prospects");
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
