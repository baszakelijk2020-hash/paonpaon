import { asId } from "@paon/domain";
import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";

import { WorkflowDefinitionRepository } from "./workflow-definition-repository";

const retailerA = asId<"RetailerId">("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
const retailerB = asId<"RetailerId">("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");

type QueryResult = { data: unknown; error: null | { message: string } };

function createBuilder(resolve: () => QueryResult) {
  const builder: Record<string, unknown> = {};
  const self = new Proxy(builder, {
    get(target, prop) {
      if (prop === "then") {
        return (onFulfilled: (value: QueryResult) => unknown) =>
          Promise.resolve(resolve()).then(onFulfilled);
      }
      if (!(prop in target)) {
        target[prop as string] = vi.fn(() => self);
      }
      return target[prop as string];
    },
  });
  return self as { eq: ReturnType<typeof vi.fn> };
}

describe("WorkflowDefinitionRepository", () => {
  it("scopes binding lookup to the requested retailer", async () => {
    const from = vi.fn(() =>
      createBuilder(() => ({ data: null, error: null })),
    );
    const repo = new WorkflowDefinitionRepository({
      from,
    } as unknown as PaonSupabaseClient);

    await repo.getBinding({
      retailerId: retailerB,
      subjectType: "alteration",
      subjectId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    });

    expect(from).toHaveBeenCalledWith("workflow_instance_bindings");
    const builder = from.mock.results[0]?.value as {
      eq: ReturnType<typeof vi.fn>;
    };
    expect(builder.eq).toHaveBeenCalledWith("retailer_id", retailerB);
  });

  it("keeps an existing pin when bindInstance is called again", async () => {
    const pinned = {
      id: "bind-1",
      retailer_id: retailerA,
      subject_type: "alteration",
      subject_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      definition_version_id: "version-1",
      pinned_at: "2026-07-30T12:00:00.000Z",
      created_at: "2026-07-30T12:00:00.000Z",
      updated_at: "2026-07-30T12:00:00.000Z",
    };
    const from = vi.fn(() =>
      createBuilder(() => ({ data: pinned, error: null })),
    );
    const repo = new WorkflowDefinitionRepository({
      from,
    } as unknown as PaonSupabaseClient);

    const binding = await repo.bindInstance({
      retailerId: retailerA,
      subjectType: "alteration",
      subjectId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      definitionKey: "alteration_work_order",
    });

    expect(binding.definitionVersionId).toBe("version-1");
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("resolves retailer familiarity preset without claiming schema forks", async () => {
    const from = vi.fn(() =>
      createBuilder(() => ({
        data: {
          retailer_id: retailerA,
          preset_key: "atelier_tailoring",
          created_at: "2026-07-30T12:00:00.000Z",
          updated_at: "2026-07-30T12:00:00.000Z",
        },
        error: null,
      })),
    );
    const repo = new WorkflowDefinitionRepository({
      from,
    } as unknown as PaonSupabaseClient);

    const preset = await repo.getRetailerPreset(retailerA);
    expect(preset.key).toBe("atelier_tailoring");
    expect(preset.navigation.labelsByHref["/alterations"]).toBe("Work orders");
  });
});
