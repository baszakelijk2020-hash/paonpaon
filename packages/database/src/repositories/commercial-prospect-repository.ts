import {
  normalizeRetailerBrandTheme,
  type CommercialProspect,
  type DemoProductMix,
  type DemoSyntheticData,
  type ProspectDemoConfiguration,
  type ProspectDemoEnvironment,
  type ProspectDemoLocation,
  type PublicProspectDemo,
  type RetailerBrandTheme,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

type ProspectRow = Database["public"]["Tables"]["commercial_prospects"]["Row"];
type ConfigurationRow =
  Database["public"]["Tables"]["prospect_demo_configurations"]["Row"];
type EnvironmentRow =
  Database["public"]["Tables"]["prospect_demo_environments"]["Row"];

const prospectToDomain = (row: ProspectRow): CommercialProspect => ({
  id: row.id,
  companyName: row.company_name,
  ...(row.website_url ? { websiteUrl: row.website_url } : {}),
  primaryContactName: row.primary_contact_name,
  primaryContactEmail: row.primary_contact_email,
  ...(row.primary_contact_phone
    ? { primaryContactPhone: row.primary_contact_phone }
    : {}),
  stage: row.stage,
  source: row.source,
  observedOpportunities: row.observed_opportunities,
  salesNotes: row.sales_notes,
  ...(row.recommended_plan_id
    ? { recommendedPlanId: row.recommended_plan_id }
    : {}),
  ...(row.next_action ? { nextAction: row.next_action } : {}),
  ...(row.next_action_due_at
    ? { nextActionDueAt: row.next_action_due_at }
    : {}),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export interface CreateCommercialProspectParams {
  companyName: string;
  websiteUrl?: string | undefined;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone?: string | undefined;
  source: string;
  observedOpportunities: string[];
  salesNotes: string;
  recommendedPlanId?: string | undefined;
  nextAction?: string | undefined;
  nextActionDueAt?: string | undefined;
}

export interface SaveProspectDemoConfigurationParams {
  prospectId: string;
  planId: string;
  theme: RetailerBrandTheme;
  marketingHeadline: string;
  personalizedIntroduction: string;
  locations: ProspectDemoLocation[];
  productMix: DemoProductMix[];
  productImageUrls: string[];
  featureKeys: string[];
  changeNote: string;
}

export interface GenerateProspectDemoEnvironmentParams {
  prospectId: string;
  publicToken: string;
  accessCode: string;
  expiresAt: string;
  syntheticData: DemoSyntheticData;
  retailerId?: string | undefined;
  retailerSlug?: string | undefined;
}

export class CommercialProspectRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async list(): Promise<CommercialProspect[]> {
    const { data, error } = await this.client
      .from("commercial_prospects")
      .select("*")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data.map(prospectToDomain);
  }

  async findById(id: string): Promise<CommercialProspect | null> {
    const { data, error } = await this.client
      .from("commercial_prospects")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return data ? prospectToDomain(data) : null;
  }

  async create(params: CreateCommercialProspectParams): Promise<string> {
    const { data, error } = await this.client
      .from("commercial_prospects")
      .insert({
        company_name: params.companyName,
        website_url: params.websiteUrl ?? null,
        primary_contact_name: params.primaryContactName,
        primary_contact_email: params.primaryContactEmail,
        primary_contact_phone: params.primaryContactPhone ?? null,
        source: params.source,
        observed_opportunities: params.observedOpportunities,
        sales_notes: params.salesNotes,
        recommended_plan_id: params.recommendedPlanId ?? null,
        next_action: params.nextAction ?? null,
        next_action_due_at: params.nextActionDueAt ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }

  async findConfiguration(
    prospectId: string,
  ): Promise<ProspectDemoConfiguration | null> {
    const { data, error } = await this.client
      .from("prospect_demo_configurations")
      .select("*")
      .eq("prospect_id", prospectId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const { data: modules, error: moduleError } = await this.client
      .from("prospect_demo_modules")
      .select("feature_key")
      .eq("configuration_id", data.id);
    if (moduleError) throw moduleError;
    return this.configurationToDomain(
      data,
      modules.map((row) => row.feature_key),
    );
  }

  async saveConfiguration(
    params: SaveProspectDemoConfigurationParams,
  ): Promise<number> {
    const { data, error } = await this.client.rpc(
      "save_prospect_demo_configuration",
      {
        p_prospect_id: params.prospectId,
        p_plan_id: params.planId,
        p_theme: params.theme as unknown as Json,
        p_marketing_headline: params.marketingHeadline,
        p_personalized_introduction: params.personalizedIntroduction,
        p_locations: params.locations as unknown as Json,
        p_product_mix: params.productMix,
        p_product_image_urls: params.productImageUrls,
        p_feature_keys: params.featureKeys,
        p_change_note: params.changeNote,
      },
    );
    if (error) throw error;
    return data;
  }

  async findEnvironment(
    prospectId: string,
  ): Promise<ProspectDemoEnvironment | null> {
    const { data, error } = await this.client
      .from("prospect_demo_environments")
      .select("*")
      .eq("prospect_id", prospectId)
      .maybeSingle();
    if (error) throw error;
    return data ? this.environmentToDomain(data) : null;
  }

  async generateEnvironment(
    params: GenerateProspectDemoEnvironmentParams,
  ): Promise<string> {
    const { data, error } = await this.client.rpc(
      "generate_prospect_demo_environment",
      {
        p_prospect_id: params.prospectId,
        p_public_token: params.publicToken,
        p_access_code: params.accessCode,
        p_expires_at: params.expiresAt,
        p_synthetic_data: params.syntheticData as unknown as Json,
        ...(params.retailerId ? { p_retailer_id: params.retailerId } : {}),
        ...(params.retailerSlug
          ? { p_retailer_slug: params.retailerSlug }
          : {}),
      },
    );
    if (error) throw error;
    return data;
  }

  async setEnvironmentPublished(
    prospectId: string,
    published: boolean,
  ): Promise<void> {
    const { error } = await this.client.rpc("set_prospect_demo_publication", {
      p_prospect_id: prospectId,
      p_publish: published,
    });
    if (error) throw error;
  }

  /**
   * Marks published demo environments past `expires_at` as `expired` and
   * suspends each linked retailer so `/r/{slug}` 404s (Demo Studio A.4).
   */
  async expireDueEnvironments(): Promise<number> {
    const { data, error } = await this.client.rpc(
      "expire_due_prospect_demo_environments",
    );
    if (error) throw error;
    return data ?? 0;
  }

  async openPublishedDemo(
    publicToken: string,
    accessCode: string,
  ): Promise<PublicProspectDemo | null> {
    const { data, error } = await this.client.rpc("open_prospect_demo", {
      p_public_token: publicToken,
      p_access_code: accessCode,
    });
    if (error) throw error;
    return data as unknown as PublicProspectDemo | null;
  }

  async updateStage(
    id: string,
    stage:
      | "researched"
      | "qualified"
      | "demo_preparation"
      | "demo_ready"
      | "demo_sent"
      | "consultation"
      | "proposal"
      | "pilot"
      | "converted"
      | "lost",
  ): Promise<void> {
    const { error } = await this.client
      .from("commercial_prospects")
      .update({ stage: stage })
      .eq("id", id);
    if (error) throw error;
  }

  private configurationToDomain(
    row: ConfigurationRow,
    featureKeys: string[],
  ): ProspectDemoConfiguration {
    return {
      id: row.id,
      prospectId: row.prospect_id,
      ...(row.plan_id ? { planId: row.plan_id } : {}),
      theme: normalizeRetailerBrandTheme(row.theme),
      marketingHeadline: row.marketing_headline,
      personalizedIntroduction: row.personalized_introduction,
      locations: row.locations as unknown as ProspectDemoLocation[],
      productMix: row.product_mix as DemoProductMix[],
      productImageUrls: row.product_image_urls ?? [],
      featureKeys,
      status: row.status,
      currentVersion: row.current_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private environmentToDomain(row: EnvironmentRow): ProspectDemoEnvironment {
    return {
      id: row.id,
      prospectId: row.prospect_id,
      configurationId: row.configuration_id,
      configurationVersion: row.configuration_version,
      publicToken: row.public_token,
      status: row.status,
      expiresAt: row.expires_at,
      syntheticData: row.synthetic_data as unknown as DemoSyntheticData,
      ...(row.retailer_id ? { retailerId: row.retailer_id } : {}),
      ...(row.retailer_slug ? { retailerSlug: row.retailer_slug } : {}),
      generatedAt: row.generated_at,
      ...(row.published_at ? { publishedAt: row.published_at } : {}),
    };
  }
}
