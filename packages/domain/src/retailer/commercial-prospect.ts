import type { RetailerBrandTheme } from "./retailer";

export const COMMERCIAL_PROSPECT_STAGES = [
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

export type CommercialProspectStage =
  (typeof COMMERCIAL_PROSPECT_STAGES)[number];

export const DEMO_PRODUCT_MIX = [
  "tailoring",
  "formalwear",
  "ready_to_wear",
  "accessories",
  "bridal",
  "made_to_measure",
] as const;

export type DemoProductMix = (typeof DEMO_PRODUCT_MIX)[number];

export interface CommercialProspect {
  id: string;
  companyName: string;
  websiteUrl?: string | undefined;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone?: string | undefined;
  stage: CommercialProspectStage;
  source: string;
  observedOpportunities: string[];
  salesNotes: string;
  recommendedPlanId?: string | undefined;
  nextAction?: string | undefined;
  nextActionDueAt?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface ProspectDemoLocation {
  name: string;
  city: string;
  /** Optional storefront appointment-sheet photography for this location. */
  imageUrl?: string | undefined;
}

/** Studio line → stored https URL (optional name/description in the hash). */
export function encodeProspectProductImageLine(input: {
  url: string;
  name?: string | undefined;
  description?: string | undefined;
}): string {
  const url = new URL(input.url);
  const params = new URLSearchParams();
  if (input.name?.trim()) params.set("n", input.name.trim());
  if (input.description?.trim()) params.set("d", input.description.trim());
  const encoded = params.toString();
  url.hash = encoded ? `paon&${encoded}` : "";
  return url.toString();
}

/** Stored URL or Studio `url | name | description` line → image + captions. */
export function decodeProspectProductImageLine(line: string): {
  url: string;
  name?: string | undefined;
  description?: string | undefined;
} {
  const trimmed = line.trim();
  if (!trimmed) return { url: "" };
  if (trimmed.includes("|")) {
    const [url, name, description] = trimmed
      .split("|")
      .map((part) => part.trim());
    return {
      url: url ?? "",
      ...(name ? { name } : {}),
      ...(description ? { description } : {}),
    };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.hash.startsWith("#paon&") || parsed.hash === "#paon") {
      const params = new URLSearchParams(
        parsed.hash.slice(1).replace(/^paon&?/, ""),
      );
      const name = params.get("n")?.trim() || undefined;
      const description = params.get("d")?.trim() || undefined;
      parsed.hash = "";
      return {
        url: parsed.toString(),
        ...(name ? { name } : {}),
        ...(description ? { description } : {}),
      };
    }
    return { url: trimmed };
  } catch {
    return { url: trimmed };
  }
}

/** Form textarea display for a stored encoded product image URL. */
export function formatProspectProductImageLine(stored: string): string {
  const decoded = decodeProspectProductImageLine(stored);
  return [decoded.url, decoded.name ?? "", decoded.description ?? ""]
    .filter((part, index) => index === 0 || part)
    .join(" | ");
}

export interface ProspectDemoConfiguration {
  id: string;
  prospectId: string;
  planId?: string | undefined;
  theme: RetailerBrandTheme;
  marketingHeadline: string;
  personalizedIntroduction: string;
  locations: ProspectDemoLocation[];
  productMix: DemoProductMix[];
  /** Prospect garment photography applied onto the seeded catalogue. */
  productImageUrls: string[];
  featureKeys: string[];
  status: "draft" | "review_ready" | "published";
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProspectDemoEnvironment {
  id: string;
  prospectId: string;
  configurationId: string;
  configurationVersion: number;
  publicToken: string;
  status: "draft" | "published" | "revoked" | "expired";
  expiresAt: string;
  syntheticData: DemoSyntheticData;
  /** Real seeded tenant created for this prospect — null on pre-step-1 envs. */
  retailerId?: string | undefined;
  retailerSlug?: string | undefined;
  generatedAt: string;
  publishedAt?: string | undefined;
}

export interface DemoSyntheticData {
  personas: Array<{
    key: string;
    label: string;
    attention: string;
    primaryAction: string;
    /** Seeded persona email when a real tenant exists (Demo Studio handoff). */
    email?: string | undefined;
    app?: "retailer" | "customer" | undefined;
  }>;
  customers: Array<{
    name: string;
    tier: string;
    nextMoment: string;
    lifetimeValue: string;
  }>;
  products: Array<{
    name: string;
    category: string;
    price: string;
    imageUrl?: string | undefined;
  }>;
  appointments: Array<{
    time: string;
    customer: string;
    purpose: string;
    status: string;
  }>;
  alterations: Array<{
    garment: string;
    customer: string;
    status: string;
    progress: number;
    due: string;
  }>;
  orders: Array<{
    reference: string;
    customer: string;
    status: string;
    value: string;
  }>;
  metrics: {
    relationshipValue: string;
    appointmentsToday: number;
    garmentsInMotion: number;
    returnRate: string;
  };
}

export interface PublicProspectDemo {
  environmentId: string;
  companyName: string;
  expiresAt: string;
  /** Live seeded tenant — opened demos always have one (RPC fails closed). */
  retailerSlug: string;
  configuration: {
    theme: RetailerBrandTheme;
    marketingHeadline: string;
    personalizedIntroduction: string;
    locations: ProspectDemoLocation[];
    productMix: DemoProductMix[];
  };
}
