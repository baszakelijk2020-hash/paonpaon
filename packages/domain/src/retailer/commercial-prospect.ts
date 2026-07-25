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
  generatedAt: string;
  publishedAt?: string | undefined;
}

export interface DemoSyntheticData {
  personas: Array<{
    key: string;
    label: string;
    attention: string;
    primaryAction: string;
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
  configuration: {
    theme: RetailerBrandTheme;
    marketingHeadline: string;
    personalizedIntroduction: string;
    locations: ProspectDemoLocation[];
    productMix: DemoProductMix[];
  };
  syntheticData: DemoSyntheticData;
}
