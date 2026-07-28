"use server";

import { randomBytes, randomUUID } from "node:crypto";

import { requirePlatformOperator } from "@paon/auth";
import { CommercialProspectRepository } from "@paon/database";
import { seedProspectDemoRetailer } from "@paon/database/demo-seed";
import { saveProspectDemoConfigurationInputSchema } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { env } from "@/lib/env";
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
  const [prospect, configuration, existingEnvironment] = await Promise.all([
    repository.findById(prospectId),
    repository.findConfiguration(prospectId),
    repository.findEnvironment(prospectId),
  ]);
  if (!prospect || !configuration || configuration.currentVersion < 1) {
    return { error: "Save a complete Demo Studio configuration first." };
  }

  const slug =
    existingEnvironment?.retailerSlug ??
    prospectDemoSlug(prospect.companyName, prospect.id);
  const hero = configuration.theme.heroImageUrl;

  try {
    const seeded = await seedProspectDemoRetailer({
      supabaseUrl: env.supabaseUrl,
      anonKey: env.supabaseAnonKey,
      serviceRoleKey: env.supabaseServiceRoleKey,
      displayName: prospect.companyName,
      slug,
    });

    // Preview payload for the Studio panel and /demo/[token] until step 3
    // routes those surfaces into the live storefront and portal. The real
    // tenant is what matters; this blob is transitional.
    const syntheticData = {
      personas: [
        {
          key: "owner",
          label: "Retailer owner",
          attention: `${prospect.companyName}'s storefront is live with a seeded client book.`,
          primaryAction: "Open the storefront",
        },
        {
          key: "manager",
          label: "Retailer manager",
          attention:
            "Appointments, alterations and loyalty are seeded and ready to walk.",
          primaryAction: "Open Mission Control",
        },
        {
          key: "advisor",
          label: "Sales advisor",
          attention:
            "Isabelle's relationship brief and fittings are on the real tenant.",
          primaryAction: "Open the client book",
        },
        {
          key: "operations",
          label: "Production & operations",
          attention:
            "Orders and garments in motion exist on the seeded retailer.",
          primaryAction: "Review garments in motion",
        },
        {
          key: "workshop_manager",
          label: "Workshop manager",
          attention: "The alteration workroom queue is seeded on this tenant.",
          primaryAction: "Open the workroom queue",
        },
        {
          key: "worker",
          label: "Alteration specialist",
          attention:
            "Assigned alteration work is waiting on the real retailer.",
          primaryAction: "Continue assigned work",
        },
        {
          key: "customer",
          label: "Private client",
          attention:
            "Private-client personas can sign into the live Customer Portal.",
          primaryAction: "View the storefront",
        },
      ],
      customers: [
        {
          name: "Isabelle Laurent",
          tier: "Private client",
          nextMoment: "Seeded on the real tenant",
          lifetimeValue: "Live data",
        },
        {
          name: "Marc Fontaine",
          tier: "Returning client",
          nextMoment: "Seeded on the real tenant",
          lifetimeValue: "Live data",
        },
        {
          name: "Julien Moreau",
          tier: "VIP",
          nextMoment: "Seeded on the real tenant",
          lifetimeValue: "Live data",
        },
      ],
      products: [
        {
          name: "Catalogue seeded from the Maison Dubois template",
          category: "Made to measure",
          price: "Live storefront",
          ...(hero ? { imageUrl: hero } : {}),
        },
      ],
      appointments: [
        {
          time: "Live",
          customer: "Isabelle Laurent",
          purpose: "Seeded fitting",
          status: "On the real tenant",
        },
      ],
      alterations: [
        {
          garment: "Wool jacket",
          customer: "Isabelle Laurent",
          status: "Seeded work order",
          progress: 50,
          due: "On the real tenant",
        },
      ],
      orders: [
        {
          reference: "Seeded",
          customer: "Isabelle Laurent",
          status: "Delivered on the real tenant",
          value: "Live data",
        },
      ],
      metrics: {
        relationshipValue: "Live tenant",
        appointmentsToday: seeded.logins.filter((l) =>
          l.role.includes("customer"),
        ).length,
        garmentsInMotion: 1,
        returnRate: "Seeded",
      },
    };

    await repository.generateEnvironment({
      prospectId,
      publicToken: randomBytes(32).toString("base64url"),
      accessCode,
      expiresAt: new Date(
        Date.now() + expiryDays * 24 * 60 * 60 * 1000,
      ).toISOString(),
      syntheticData,
      retailerId: seeded.retailerId,
      retailerSlug: seeded.slug,
    });
    revalidatePath(`/prospects/${prospectId}/studio`);
    return {
      success: `Real demo retailer ready at /r/${seeded.slug}. Review the live storefront before publishing.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return {
      error: `The demo retailer could not be generated: ${message}`,
    };
  }
}

function prospectDemoSlug(companyName: string, prospectId: string): string {
  const base = companyName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = prospectId.replace(/-/g, "").slice(0, 8);
  return `demo-${base || "prospect"}-${suffix}`;
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
