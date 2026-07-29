import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { ImportEnrichmentPromptRepository } from "./import-enrichment-prompt-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

type PromptRow =
  Database["public"]["Tables"]["import_enrichment_prompt_contracts"]["Row"];

const promptRow: PromptRow = {
  id: "a2000000-0000-4000-8000-000000000001",
  slug: "catalogue_import_external_v1",
  title: "Catalogue import enrichment",
  prompt_markdown: "x".repeat(40) + " mill composition weight_gsm",
  response_schema_version: "v1",
  active: true,
  updated_by_user_id: null,
  created_at: "2026-07-30T00:00:00.000Z",
  updated_at: "2026-07-30T00:00:00.000Z",
};

describe("ImportEnrichmentPromptRepository", () => {
  it("maps the active Admin-maintained prompt contract", async () => {
    const repository = new ImportEnrichmentPromptRepository({
      from: () => fakeQueryBuilder({ data: promptRow, error: null }),
    } as unknown as PaonSupabaseClient);

    const prompt = await repository.findActive();
    expect(prompt).toEqual(
      expect.objectContaining({
        slug: "catalogue_import_external_v1",
        active: true,
        responseSchemaVersion: "v1",
      }),
    );
  });

  it("upserts prompt markdown for platform operators", async () => {
    const upsert = vi
      .fn()
      .mockReturnValue(fakeQueryBuilder({ data: promptRow, error: null }));
    const from = vi.fn(() => ({ upsert }));
    const repository = new ImportEnrichmentPromptRepository({
      from,
    } as unknown as PaonSupabaseClient);

    await repository.upsert({
      slug: "catalogue_import_external_v1",
      title: "Catalogue import enrichment",
      promptMarkdown: promptRow.prompt_markdown,
      responseSchemaVersion: "v1",
      active: true,
      updatedByUserId: "11111111-1111-4111-8111-111111111111",
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "catalogue_import_external_v1",
        prompt_markdown: promptRow.prompt_markdown,
      }),
      { onConflict: "slug" },
    );
  });
});
