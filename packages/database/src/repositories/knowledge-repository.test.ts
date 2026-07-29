import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { KnowledgeRepository } from "./knowledge-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

type KnowledgeObjectRow =
  Database["public"]["Tables"]["knowledge_objects"]["Row"];
type KnowledgeObjectConceptRow =
  Database["public"]["Tables"]["knowledge_object_concepts"]["Row"];
type RetailerKnowledgeOverrideRow =
  Database["public"]["Tables"]["retailer_knowledge_overrides"]["Row"];

const retailerId = "11111111-1111-1111-1111-111111111111";
const knowledgeObjectId = "22222222-2222-2222-2222-222222222222";
const conceptId = "33333333-3333-3333-3333-333333333333";

const knowledgeObjectRow: KnowledgeObjectRow = {
  id: knowledgeObjectId,
  retailer_id: null,
  title: "Hopsack for warm weather",
  slug: "hopsack-for-warm-weather",
  summary: "Explains why open weaves breathe and recover shape in heat.",
  body: "Hopsack's basket structure creates air pockets.",
  image_url: "https://example.com/hopsack.jpg",
  display_types: ["information_card"],
  commercial_intent: "educate",
  education_topic: "weaves",
  priority: 85,
  active: true,
  created_at: "2026-07-30T00:00:00.000Z",
  updated_at: "2026-07-30T00:00:00.000Z",
  deleted_at: null,
};

const conceptLinkRow: KnowledgeObjectConceptRow = {
  id: "44444444-4444-4444-4444-444444444444",
  knowledge_object_id: knowledgeObjectId,
  concept_id: conceptId,
  match_strength: 1,
  created_at: "2026-07-30T00:00:00.000Z",
  updated_at: "2026-07-30T00:00:00.000Z",
  deleted_at: null,
};

const overrideRow: RetailerKnowledgeOverrideRow = {
  id: "55555555-5555-5555-5555-555555555555",
  retailer_id: retailerId,
  knowledge_object_id: knowledgeObjectId,
  title_override: "Our hopsack guide",
  summary_override: "Local summary for summer clients.",
  image_url_override: null,
  is_hidden: false,
  is_pinned: true,
  priority_override: 120,
  created_at: "2026-07-30T00:00:00.000Z",
  updated_at: "2026-07-30T00:00:00.000Z",
  deleted_at: null,
};

describe("KnowledgeRepository", () => {
  it("maps canonical knowledge and keeps an explicit tenant visibility filter", async () => {
    const or = vi.fn();
    const builder = fakeQueryBuilder({
      data: [knowledgeObjectRow],
      error: null,
    });
    builder.or = (...args: Parameters<typeof or>) => {
      or(...args);
      return builder;
    };
    const repository = new KnowledgeRepository({
      from: () => builder,
    } as unknown as PaonSupabaseClient);

    const objects = await repository.findVisibleKnowledgeObjects(
      retailerId as never,
      "weaves",
    );

    expect(or).toHaveBeenCalledWith(
      `retailer_id.is.null,retailer_id.eq.${retailerId}`,
    );
    expect(objects).toEqual([
      expect.objectContaining({
        id: knowledgeObjectId,
        retailerId: null,
        educationTopic: "weaves",
        displayTypes: ["information_card"],
      }),
    ]);
  });

  it("maps concept links for a visible knowledge object", async () => {
    const objectBuilder = fakeQueryBuilder({
      data: knowledgeObjectRow,
      error: null,
    });
    const conceptBuilder = fakeQueryBuilder({
      data: [conceptLinkRow],
      error: null,
    });
    const from = vi
      .fn()
      .mockReturnValueOnce(objectBuilder)
      .mockReturnValueOnce(conceptBuilder);

    const repository = new KnowledgeRepository({
      from,
    } as unknown as PaonSupabaseClient);

    const links = await repository.findConceptLinksForObject(
      retailerId as never,
      knowledgeObjectId as never,
    );

    expect(links).toEqual([
      expect.objectContaining({
        knowledgeObjectId,
        conceptId,
        matchStrength: 1,
      }),
    ]);
  });

  it("maps retailer knowledge overrides with pin and priority controls", async () => {
    const builder = fakeQueryBuilder({
      data: overrideRow,
      error: null,
    });
    const repository = new KnowledgeRepository({
      from: () => builder,
    } as unknown as PaonSupabaseClient);

    const override = await repository.findKnowledgeOverride(
      retailerId as never,
      knowledgeObjectId as never,
    );

    expect(override).toEqual(
      expect.objectContaining({
        titleOverride: "Our hopsack guide",
        isPinned: true,
        priorityOverride: 120,
      }),
    );
  });
});
