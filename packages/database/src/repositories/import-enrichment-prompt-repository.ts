import type {
  ImportEnrichmentPromptContract,
  UpdateImportEnrichmentPromptInput,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type PromptRow =
  Database["public"]["Tables"]["import_enrichment_prompt_contracts"]["Row"];

function toDomain(row: PromptRow): ImportEnrichmentPromptContract {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    promptMarkdown: row.prompt_markdown,
    responseSchemaVersion: row.response_schema_version,
    active: row.active,
    ...(row.updated_by_user_id === null
      ? {}
      : { updatedByUserId: row.updated_by_user_id }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ImportEnrichmentPromptRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findBySlug(
    slug: string,
  ): Promise<ImportEnrichmentPromptContract | null> {
    const { data, error } = await this.client
      .from("import_enrichment_prompt_contracts")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    return data ? toDomain(data) : null;
  }

  async findActive(): Promise<ImportEnrichmentPromptContract | null> {
    const { data, error } = await this.client
      .from("import_enrichment_prompt_contracts")
      .select("*")
      .eq("active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? toDomain(data) : null;
  }

  async listAll(): Promise<readonly ImportEnrichmentPromptContract[]> {
    const { data, error } = await this.client
      .from("import_enrichment_prompt_contracts")
      .select("*")
      .order("slug", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(toDomain);
  }

  async upsert(
    input: UpdateImportEnrichmentPromptInput & {
      readonly updatedByUserId?: string;
      readonly id?: string;
    },
  ): Promise<ImportEnrichmentPromptContract> {
    const payload = {
      ...(input.id === undefined ? {} : { id: input.id }),
      slug: input.slug,
      title: input.title,
      prompt_markdown: input.promptMarkdown,
      response_schema_version: input.responseSchemaVersion,
      active: input.active,
      updated_by_user_id: input.updatedByUserId ?? null,
    };

    const { data, error } = await this.client
      .from("import_enrichment_prompt_contracts")
      .upsert(payload, { onConflict: "slug" })
      .select("*")
      .single();
    if (error) throw error;
    return toDomain(data);
  }
}
