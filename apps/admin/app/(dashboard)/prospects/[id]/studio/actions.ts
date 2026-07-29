"use server";

import { randomBytes, randomUUID } from "node:crypto";

import { requirePlatformOperator } from "@paon/auth";
import { CommercialProspectRepository } from "@paon/database";
import { seedProspectDemoRetailer } from "@paon/database/demo-seed";
import {
  decodeProspectProductImageLine,
  encodeProspectProductImageLine,
  saveProspectDemoConfigurationInputSchema,
} from "@paon/domain";
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
  role?: "garment" | "logoUrl" | "faviconUrl" | "heroImageUrl";
}

export interface DemoEnvironmentActionState {
  error?: string;
  success?: string;
  /** One-paste pack for the founder after generate (includes access code). */
  outreachPack?: string;
  /** Opens the founder's mail client with a cold-email draft (no Resend). */
  prospectMailtoHref?: string;
  /** Echoed once after generate so the UI can offer Copy without re-reading the form. */
  accessCode?: string;
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
  const roleRaw = String(formData.get("assetRole") ?? "garment");
  const role =
    roleRaw === "logoUrl" ||
    roleRaw === "faviconUrl" ||
    roleRaw === "heroImageUrl"
      ? roleRaw
      : "garment";
  return { publicUrl: data.publicUrl, role };
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

  try {
    const seeded = await seedProspectDemoRetailer({
      supabaseUrl: env.supabaseUrl,
      anonKey: env.supabaseAnonKey,
      serviceRoleKey: env.supabaseServiceRoleKey,
      displayName: prospect.companyName,
      slug,
      brandTheme: configuration.theme,
      productImageUrls: configuration.productImageUrls,
      productMix: configuration.productMix,
      locations: configuration.locations,
    });

    // Studio handoff payload: live links come from retailerSlug; personas
    // carry the real seeded emails so the founder can copy one-click logins.
    const loginFor = (label: string) =>
      seeded.logins.find((login) => login.role.endsWith(`— ${label}`));
    const customerLogin = seeded.logins.find((login) =>
      login.role.includes(" customer — "),
    );
    const syntheticData = {
      personas: [
        {
          key: "owner",
          label: "Retailer owner",
          attention: `${prospect.companyName}'s storefront is live with a seeded client book.`,
          primaryAction: "Open Mission Control",
          app: "retailer" as const,
          ...(loginFor("owner") ? { email: loginFor("owner")!.email } : {}),
        },
        {
          key: "manager",
          label: "Retailer manager",
          attention:
            "Appointments, alterations and loyalty are seeded and ready to walk.",
          primaryAction: "Open Mission Control",
          app: "retailer" as const,
          ...(loginFor("manager") ? { email: loginFor("manager")!.email } : {}),
        },
        {
          key: "advisor",
          label: "Sales advisor",
          attention:
            "The seeded client book and fittings are on the real tenant.",
          primaryAction: "Open the client book",
          app: "retailer" as const,
          ...(loginFor("sales") ? { email: loginFor("sales")!.email } : {}),
        },
        {
          key: "operations",
          label: "Production & operations",
          attention:
            "Orders and garments in motion exist on the seeded retailer.",
          primaryAction: "Review garments in motion",
          app: "retailer" as const,
          ...(loginFor("operations")
            ? { email: loginFor("operations")!.email }
            : {}),
        },
        {
          key: "workshop_manager",
          label: "Workshop manager",
          attention: "The alteration workroom queue is seeded on this tenant.",
          primaryAction: "Open the workroom queue",
          app: "retailer" as const,
          ...(loginFor("workshop")
            ? { email: loginFor("workshop")!.email }
            : {}),
        },
        {
          key: "worker",
          label: "Alteration specialist",
          attention:
            "Assigned alteration work is waiting on the real retailer.",
          primaryAction: "Continue assigned work",
          app: "retailer" as const,
          ...(loginFor("alteration-worker")
            ? { email: loginFor("alteration-worker")!.email }
            : {}),
        },
        {
          key: "customer",
          label: "Private client",
          attention:
            "Private-client personas can sign into the live Customer Portal.",
          primaryAction: "Open the Customer Portal",
          app: "customer" as const,
          ...(customerLogin ? { email: customerLogin.email } : {}),
        },
      ],
      customers: [],
      products: [],
      appointments: [],
      alterations: [],
      orders: [],
      metrics: {
        relationshipValue: "Live tenant",
        appointmentsToday: 0,
        garmentsInMotion: 0,
        returnRate: "—",
      },
    };

    const publicToken = randomBytes(32).toString("base64url");
    await repository.generateEnvironment({
      prospectId,
      publicToken,
      accessCode,
      expiresAt: new Date(
        Date.now() + expiryDays * 24 * 60 * 60 * 1000,
      ).toISOString(),
      syntheticData,
      retailerId: seeded.retailerId,
      retailerSlug: seeded.slug,
    });
    revalidatePath(`/prospects/${prospectId}/studio`);

    const customerBase = (env.customerAppUrl ?? "").replace(/\/$/, "");
    const retailerBase = (env.retailerAppUrl ?? "").replace(/\/$/, "");
    const storefront = customerBase
      ? `${customerBase}/r/${seeded.slug}`
      : `/r/${seeded.slug}`;
    const demoLink = customerBase
      ? `${customerBase}/demo/${publicToken}`
      : `/demo/${publicToken}`;
    const ownerEmail = loginFor("owner")?.email;
    const customerEmail = customerLogin?.email;
    const outreachPack = [
      `${prospect.companyName} — PAON demo`,
      `Storefront: ${storefront}`,
      `Private demo: ${demoLink}`,
      `Access code: ${accessCode}`,
      `Demo password (all personas): Demo-PAON-2026!`,
      ownerEmail
        ? `Retailer owner login: ${retailerBase || "(retailer app)"}/login?demo=1&email=${encodeURIComponent(ownerEmail)}`
        : null,
      customerEmail
        ? `Customer login: ${customerBase || "(customer app)"}/login?demo=1&email=${encodeURIComponent(customerEmail)}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    const contactFirst =
      prospect.primaryContactName.trim().split(/\s+/)[0] ??
      prospect.primaryContactName;
    const emailSubject = `Your private ${prospect.companyName} demonstration on PAON`;
    const emailBody = [
      `Hi ${contactFirst},`,
      "",
      `I've prepared a private PAON demonstration for ${prospect.companyName} — a live storefront and Mission Control, not a slide deck.`,
      "",
      "Open the private demo:",
      demoLink,
      "",
      `Access code: ${accessCode}`,
      "",
      "Live storefront (same tenant):",
      storefront,
      "",
      "Happy to walk it with you whenever suits.",
      "",
    ].join("\n");
    const prospectMailtoHref = `mailto:${encodeURIComponent(prospect.primaryContactEmail)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

    await repository.saveFounderOutreachPack(prospectId, outreachPack);

    return {
      success: `Branded demo retailer ready at /r/${seeded.slug}. Review the live storefront before publishing.`,
      outreachPack,
      prospectMailtoHref,
      accessCode,
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
    .map(([name, city, imageUrl]) => ({
      name,
      city,
      ...(imageUrl ? { imageUrl } : {}),
    }));
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
    productImageUrls: String(formData.get("productImageUrls") ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const decoded = decodeProspectProductImageLine(line);
        return encodeProspectProductImageLine(decoded);
      }),
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
