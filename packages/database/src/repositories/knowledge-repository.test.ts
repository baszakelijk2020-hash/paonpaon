import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { KnowledgeRepository } from "./knowledge-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

type KnowledgeObjectRow =
  Database["public"]["Tables"]["knowledge_objects"]["Row"];
type RetailerKnowledgeOverrideRow =
  Database["public"]["Tables"]["retailer_knowledge_overrides"]["Row"];

const retailerId = "11111111-1111-1111-1111-111111111111";
const knowledgeObjectId = "a1000000-0000-4000-8000-000000000002";

const objectRow: KnowledgeObjectRow = {
  id: knowledgeObjectId,
  retailer_id: null,
  topic: "fibre",
  title: "Why fibre composition matters",
  slug: "why-fibre-composition-matters",
  summary: "Fibre choice shapes breathability.",
  body: "Neutral fixture body",
  image_url: null,
  display_types: ["information_card", "tooltip"],
  commercial_intent: "educate",
  priority: 90,
  active: true,
  created_at: "2026-07-30T00:00:00.000Z",
  updated_at: "2026-07-30T00:00:00.000Z",
  deleted_at: null,
};

const overrideRow: RetailerKnowledgeOverrideRow = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  retailer_id: retailerId,
  knowledge_object_id: knowledgeObjectId,
  display_title: "Local fibre title",
  summary_override: "Local summary",
  image_url_override: null,
  is_hidden: false,
  is_pinned: true,
  priority_override: 40,
  created_at: "2026-07-30T00:00:00.000Z",
  updated_at: "2026-07-30T00:00:00.000Z",
  deleted_at: null,
};

describe("KnowledgeRepository", () => {
  it("maps canonical knowledge and keeps an explicit tenant visibility filter", async () => {
    const or = vi.fn();
    const builder = fakeQueryBuilder({
      data: [objectRow],
      error: null,
    });
    builder.or = (...args: Parameters<typeof or>) => {
      or(...args);
      return builder;
    };
    const repository = new KnowledgeRepository({
      from: () => builder,
    } as unknown as PaonSupabaseClient);

    const objects = await repository.findVisible(retailerId as never, "fibre");

    expect(or).toHaveBeenCalledWith(
      `retailer_id.is.null,retailer_id.eq.${retailerId}`,
    );
    expect(objects).toEqual([
      expect.objectContaining({
        id: knowledgeObjectId,
        retailerId: null,
        topic: "fibre",
        title: "Why fibre composition matters",
        displayTypes: ["information_card", "tooltip"],
        commercialIntent: "educate",
        active: true,
      }),
    ]);
  });

  it("maps retailer knowledge overrides including pin and priority", async () => {
    const builder = fakeQueryBuilder({
      data: overrideRow,
      error: null,
    });
    const repository = new KnowledgeRepository({
      from: () => builder,
    } as unknown as PaonSupabaseClient);

    const override = await repository.findOverride(
      retailerId as never,
      knowledgeObjectId as never,
    );

    expect(override).toEqual(
      expect.objectContaining({
        retailerId,
        knowledgeObjectId,
        displayTitle: "Local fibre title",
        summaryOverride: "Local summary",
        isHidden: false,
        isPinned: true,
        priorityOverride: 40,
      }),
    );
  });

  it("returns no discovery candidates when accepted concepts are empty", async () => {
    const repository = new KnowledgeRepository({
      from: () => {
        throw new Error("should not query");
      },
    } as unknown as PaonSupabaseClient);

    await expect(
      repository.projectDiscoveryCandidates(retailerId as never, []),
    ).resolves.toEqual([]);
  });
});
