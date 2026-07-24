import type { CommercialInquiry, CommercialInquiryInput } from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type Row = Database["public"]["Tables"]["commercial_inquiries"]["Row"];

const toDomain = (row: Row): CommercialInquiry => ({
  id: row.id,
  inquiryType: row.inquiry_type,
  companyName: row.company_name,
  contactName: row.contact_name,
  email: row.email,
  ...(row.website_url ? { websiteUrl: row.website_url } : {}),
  objective: row.objective,
  ...(row.requested_plan_key
    ? { requestedPlanKey: row.requested_plan_key }
    : {}),
  status: row.status as CommercialInquiry["status"],
  source: row.source,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class CommercialInquiryRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async submit(input: CommercialInquiryInput): Promise<string> {
    const { data, error } = await this.client.rpc("submit_commercial_inquiry", {
      p_inquiry_type: input.inquiryType,
      p_company_name: input.companyName,
      p_contact_name: input.contactName,
      p_email: input.email,
      p_website_url: input.websiteUrl ?? "",
      p_objective: input.objective,
      p_requested_plan_key: input.requestedPlanKey ?? "",
    });
    if (error) throw error;
    return data;
  }

  async findAll(): Promise<CommercialInquiry[]> {
    const { data, error } = await this.client
      .from("commercial_inquiries")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toDomain);
  }
}
