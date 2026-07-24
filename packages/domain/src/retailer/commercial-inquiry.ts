export const COMMERCIAL_INQUIRY_TYPES = [
  "personalized_demo",
  "consultation",
  "paid_pilot",
] as const;

export type CommercialInquiryType = (typeof COMMERCIAL_INQUIRY_TYPES)[number];

export interface CommercialInquiryInput {
  inquiryType: CommercialInquiryType;
  companyName: string;
  contactName: string;
  email: string;
  websiteUrl?: string | undefined;
  objective: string;
  requestedPlanKey?: string | undefined;
}

export interface CommercialInquiry extends CommercialInquiryInput {
  id: string;
  status: "new" | "reviewed" | "converted" | "closed";
  source: string;
  createdAt: string;
  updatedAt: string;
}
