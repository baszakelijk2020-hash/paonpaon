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
