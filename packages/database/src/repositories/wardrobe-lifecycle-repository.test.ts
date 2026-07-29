import {
  asId,
  projectFitFreshness,
  recommendFitServiceHandoff,
} from "@paon/domain";
import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";
import { WardrobeLifecycleRepository } from "./wardrobe-lifecycle-repository";

type LifecycleRow =
  Database["public"]["Tables"]["wardrobe_lifecycle_events"]["Row"];
type SelfScanRow = Database["public"]["Tables"]["wardrobe_self_scans"]["Row"];
type AttachmentRow =
  Database["public"]["Tables"]["wardrobe_attachments"]["Row"];

const lifecycleRow: LifecycleRow = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
  retailer_id: "11111111-1111-4111-8111-111111111111",
  customer_id: "22222222-2222-4222-8222-222222222222",
  wardrobe_item_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  event_kind: "worn",
  actor_kind: "customer",
  actor_staff_id: null,
  note: null,
  guidance_kind: null,
  occurred_at: "2026-07-20T10:00:00.000Z",
  created_at: "2026-07-20T10:00:00.000Z",
};

const selfScanRow: SelfScanRow = {
  id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
  retailer_id: lifecycleRow.retailer_id,
  customer_id: lifecycleRow.customer_id,
  wardrobe_item_id: lifecycleRow.wardrobe_item_id,
  notes: "Chest feels tight",
  size_change_reported: true,
  fit_perception_at_scan: "slightly_tight",
  provenance: "self_reported",
  service_handoff_kind: "alteration_fitting",
  appointment_id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
  appointment_type: "alteration_fitting",
  created_by_actor: "customer",
  created_by_staff_id: null,
  created_at: "2026-07-30T10:00:00.000Z",
};

const attachmentRow: AttachmentRow = {
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
  retailer_id: lifecycleRow.retailer_id,
  wardrobe_item_id: lifecycleRow.wardrobe_item_id,
  self_scan_id: selfScanRow.id,
  kind: "self_scan",
  storage_bucket: "wardrobe-evidence",
  storage_path: `${lifecycleRow.retailer_id}/${lifecycleRow.wardrobe_item_id}/scan.jpg`,
  file_name: "scan.jpg",
  mime_type: "image/jpeg",
  size_bytes: 2048,
  uploaded_by_actor: "customer",
  uploaded_by_staff_id: null,
  created_at: "2026-07-30T10:01:00.000Z",
};

describe("WardrobeLifecycleRepository", () => {
  it("maps lifecycle events and self-scans with self_reported provenance", async () => {
    const from = vi.fn((table: string) => {
      if (table === "wardrobe_lifecycle_events") {
        return fakeQueryBuilder({ data: [lifecycleRow], error: null });
      }
      if (table === "wardrobe_self_scans") {
        return fakeQueryBuilder({ data: [selfScanRow], error: null });
      }
      return fakeQueryBuilder({ data: [], error: null });
    });
    const repo = new WardrobeLifecycleRepository({
      from,
    } as unknown as PaonSupabaseClient);

    const events = await repo.listLifecycleEvents(
      lifecycleRow.wardrobe_item_id as never,
    );
    expect(events[0]?.eventKind).toBe("worn");

    const scans = await repo.listSelfScans(
      lifecycleRow.wardrobe_item_id as never,
    );
    expect(scans[0]?.provenance).toBe("self_reported");
    expect(scans[0]?.serviceHandoffKind).toBe("alteration_fitting");
    expect(scans[0]?.appointmentType).toBe("alteration_fitting");
  });

  it("returns signed URLs for private wardrobe attachments", async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://signed.example/scan.jpg" },
      error: null,
    });
    const repo = new WardrobeLifecycleRepository({
      from: () => fakeQueryBuilder({ data: [attachmentRow], error: null }),
      storage: {
        from: () => ({ createSignedUrl }),
      },
    } as unknown as PaonSupabaseClient);

    const attachments = await repo.findAttachmentsByItem(
      attachmentRow.wardrobe_item_id as never,
    );
    expect(attachments).toHaveLength(1);
    expect(attachments[0]?.signedUrl).toBe("https://signed.example/scan.jpg");
    expect(attachments[0]?.attachment.storageBucket).toBe("wardrobe-evidence");
    expect(createSignedUrl).toHaveBeenCalledWith(
      attachmentRow.storage_path,
      15 * 60,
    );
  });

  it("rejects insecure upload paths before storage write", async () => {
    const upload = vi.fn();
    const repo = new WardrobeLifecycleRepository({
      storage: { from: () => ({ upload }) },
    } as unknown as PaonSupabaseClient);

    await expect(
      repo.uploadSelfScanImage({
        retailerId: asId<"RetailerId">(lifecycleRow.retailer_id),
        wardrobeItemId: asId<"WardrobeItemId">(lifecycleRow.wardrobe_item_id),
        selfScanId: asId<"WardrobeSelfScanId">(selfScanRow.id),
        storagePath: "other-retailer/other-item/scan.jpg",
        fileName: "scan.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 100,
        content: new ArrayBuffer(8),
      }),
    ).rejects.toThrow(/Storage path/);
    expect(upload).not.toHaveBeenCalled();
  });

  it("projects fit freshness from official observations only", async () => {
    const from = vi.fn((table: string) => {
      if (table === "wardrobe_lifecycle_events") {
        return fakeQueryBuilder({ data: [lifecycleRow], error: null });
      }
      if (table === "wardrobe_self_scans") {
        return fakeQueryBuilder({ data: [selfScanRow], error: null });
      }
      if (table === "fitting_observations") {
        return fakeQueryBuilder({
          data: { created_at: "2026-01-01T12:00:00.000Z" },
          error: null,
        });
      }
      return fakeQueryBuilder({ data: [], error: null });
    });
    const repo = new WardrobeLifecycleRepository({
      from,
    } as unknown as PaonSupabaseClient);

    const view = await repo.projectItemServiceView(
      {
        id: asId<"WardrobeItemId">(lifecycleRow.wardrobe_item_id),
        retailerId: asId<"RetailerId">(lifecycleRow.retailer_id),
        customerId: asId<"CustomerId">(lifecycleRow.customer_id),
        ownershipKind: "retailer_purchased",
        provenanceSource: "order_line",
        categoryCode: "jacket",
        displayName: "Navy jacket",
        condition: "good",
        careState: "current",
        fitPerception: "slightly_tight",
        fitNotes: "Self-reported tightness",
        physicalGarmentId: asId<"PhysicalGarmentId">(
          "33333333-3333-4333-8333-333333333333",
        ),
        orderLineId: asId<"OrderLineId">(
          "44444444-4444-4444-8444-444444444444",
        ),
        createdByActor: "advisor",
        createdByStaffId: asId<"StaffId">(
          "55555555-5555-4555-8555-555555555555",
        ),
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      "2026-07-30T12:00:00.000Z",
    );

    expect(view.fitFreshness.status).toBe("aging");
    expect(view.fitFreshness.selfReportedFitPerception).toBe("slightly_tight");
    expect(view.selfScanEligible).toBe(true);
    expect(
      view.longevityGuidance.every((g) => g.forcesReplacement === false),
    ).toBe(true);
  });

  it("keeps self-scan handoff from claiming official observation writes", () => {
    const handoff = recommendFitServiceHandoff({
      sizeChangeReported: true,
      freshnessStatus: "stale",
      notes: "test",
    });
    expect(handoff.writesOfficialObservation).toBe(false);
    expect(handoff.provenance).toBe("self_reported");

    const freshness = projectFitFreshness({
      wardrobeItemId: asId<"WardrobeItemId">(lifecycleRow.wardrobe_item_id),
      nowIso: "2026-07-30T12:00:00.000Z",
      selfReportedFitNotes: "notes only",
    });
    expect(freshness.lastOfficialMeasuredAt).toBeUndefined();
  });
});
