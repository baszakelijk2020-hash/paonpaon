import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import {
  buildWardrobeEvidenceObjectPath,
  deriveLongevityGuidance,
  isSecureWardrobeEvidencePath,
  isWardrobeItemSelfScanEligible,
  projectFitFreshness,
  projectLifecycleState,
  recommendFitServiceHandoff,
  wardrobeSelfScanNeverWritesOfficialObservation,
  type WardrobeLifecycleEvent,
} from "./lifecycle";
import {
  recordWardrobeLifecycleEventInputSchema,
  submitWardrobeSelfScanInputSchema,
  wardrobeAttachmentUploadMetaSchema,
} from "./lifecycle.schema";

const wardrobeItemId = asId<"WardrobeItemId">(
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
);
const retailerId = asId<"RetailerId">("11111111-1111-4111-8111-111111111111");
const customerId = asId<"CustomerId">("22222222-2222-4222-8222-222222222222");
const garmentId = asId<"PhysicalGarmentId">(
  "33333333-3333-4333-8333-333333333333",
);

function event(
  partial: Pick<WardrobeLifecycleEvent, "eventKind" | "occurredAt"> &
    Partial<WardrobeLifecycleEvent>,
): WardrobeLifecycleEvent {
  return {
    id: asId<"WardrobeLifecycleEventId">(
      partial.id ?? "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    ),
    retailerId,
    customerId,
    wardrobeItemId,
    actorKind: "customer",
    createdAt: partial.occurredAt,
    ...partial,
  };
}

describe("fit freshness projection", () => {
  const now = "2026-07-30T12:00:00.000Z";

  it("escalates deterministically from last official measured date", () => {
    expect(
      projectFitFreshness({
        wardrobeItemId,
        physicalGarmentId: garmentId,
        lastOfficialMeasuredAt: "2026-06-01T12:00:00.000Z",
        nowIso: now,
        selfReportedFitPerception: "slightly_tight",
      }).status,
    ).toBe("current");

    expect(
      projectFitFreshness({
        wardrobeItemId,
        lastOfficialMeasuredAt: "2026-01-01T12:00:00.000Z",
        nowIso: now,
      }).status,
    ).toBe("aging");

    expect(
      projectFitFreshness({
        wardrobeItemId,
        lastOfficialMeasuredAt: "2025-06-01T12:00:00.000Z",
        nowIso: now,
      }).status,
    ).toBe("stale");

    expect(
      projectFitFreshness({
        wardrobeItemId,
        lastOfficialMeasuredAt: "2024-01-01T12:00:00.000Z",
        nowIso: now,
      }).status,
    ).toBe("overdue");
  });

  it("keeps self-reported fit separate from official measurement absence", () => {
    const projection = projectFitFreshness({
      wardrobeItemId,
      nowIso: now,
      selfReportedFitPerception: "needs_alteration",
      selfReportedFitNotes: "Chest feels tight after travel",
    });
    expect(projection.status).toBe("unknown");
    expect(projection.lastOfficialMeasuredAt).toBeUndefined();
    expect(projection.selfReportedFitPerception).toBe("needs_alteration");
    expect(projection.recommendedAppointmentType).toBe("fitting");
  });
});

describe("self-scan eligibility and provenance", () => {
  it("allows order-line, physical-garment, or retailer-purchased items", () => {
    expect(
      isWardrobeItemSelfScanEligible({
        condition: "good",
        ownershipKind: "external",
        orderLineId: asId<"OrderLineId">(
          "44444444-4444-4444-8444-444444444444",
        ),
      }),
    ).toBe(true);
    expect(
      isWardrobeItemSelfScanEligible({
        condition: "good",
        ownershipKind: "external",
        physicalGarmentId: garmentId,
      }),
    ).toBe(true);
    expect(
      isWardrobeItemSelfScanEligible({
        condition: "good",
        ownershipKind: "retailer_purchased",
      }),
    ).toBe(true);
    expect(
      isWardrobeItemSelfScanEligible({
        condition: "good",
        ownershipKind: "external",
      }),
    ).toBe(false);
    expect(
      isWardrobeItemSelfScanEligible({
        condition: "retired",
        ownershipKind: "retailer_purchased",
        orderLineId: asId<"OrderLineId">(
          "44444444-4444-4444-8444-444444444444",
        ),
      }),
    ).toBe(false);
  });

  it("recommends alteration handoff without writing official observations", () => {
    const handoff = recommendFitServiceHandoff({
      sizeChangeReported: true,
      fitPerception: "slightly_tight",
      freshnessStatus: "stale",
      notes: "Waistband digs in",
    });
    expect(handoff.serviceHandoffKind).toBe("alteration_fitting");
    expect(handoff.appointmentType).toBe("alteration_fitting");
    expect(handoff.writesOfficialObservation).toBe(false);
    expect(handoff.provenance).toBe("self_reported");
    expect(handoff.advisorContext).toContain("not an official measurement");
  });

  it("marks self-scan provenance as never official", () => {
    expect(
      wardrobeSelfScanNeverWritesOfficialObservation({
        provenance: "self_reported",
      }),
    ).toBe(true);
  });
});

describe("lifecycle state and longevity guidance", () => {
  it("projects wear/rest/clean/repair and dismissed guidance", () => {
    const state = projectLifecycleState([
      event({ eventKind: "worn", occurredAt: "2026-07-20T10:00:00.000Z" }),
      event({ eventKind: "cleaned", occurredAt: "2026-03-01T10:00:00.000Z" }),
      event({
        eventKind: "guidance_dismissed",
        occurredAt: "2026-07-21T10:00:00.000Z",
        guidanceKind: "rotate_rest",
      }),
    ]);
    expect(state.lastWornAt).toBe("2026-07-20T10:00:00.000Z");
    expect(state.lastCleanedAt).toBe("2026-03-01T10:00:00.000Z");
    expect(state.dismissedGuidanceKinds).toEqual(["rotate_rest"]);
  });

  it("produces dismissible stewardship guidance without forced replacement", () => {
    const guidance = deriveLongevityGuidance({
      categoryCode: "suit",
      condition: "fair",
      careState: "due_soon",
      wearFrequency: "frequently",
      acquiredAt: "2024-07-01T00:00:00.000Z",
      lifecycle: {
        lastWornAt: "2026-07-29T10:00:00.000Z",
        dismissedGuidanceKinds: [],
      },
      nowIso: "2026-07-30T12:00:00.000Z",
    });
    expect(guidance.length).toBeGreaterThan(0);
    expect(guidance.every((item) => item.dismissible)).toBe(true);
    expect(guidance.every((item) => item.forcesReplacement === false)).toBe(
      true,
    );
    expect(guidance.some((item) => item.kind === "age_stewardship")).toBe(true);
    expect(guidance.some((item) => item.kind === "repair_suggested")).toBe(
      true,
    );
  });

  it("omits dismissed guidance kinds", () => {
    const guidance = deriveLongevityGuidance({
      categoryCode: "shirt",
      condition: "good",
      careState: "current",
      wearFrequency: "regularly",
      lifecycle: {
        lastWornAt: "2026-07-29T10:00:00.000Z",
        dismissedGuidanceKinds: ["rotate_rest"],
      },
      nowIso: "2026-07-30T12:00:00.000Z",
    });
    expect(guidance.some((item) => item.kind === "rotate_rest")).toBe(false);
  });
});

describe("secure wardrobe evidence paths", () => {
  it("builds and validates retailer/item scoped object paths", () => {
    const path = buildWardrobeEvidenceObjectPath({
      retailerId,
      wardrobeItemId,
      objectName: "scan photo 1.jpg",
    });
    expect(path.startsWith(`${retailerId}/${wardrobeItemId}/`)).toBe(true);
    expect(
      isSecureWardrobeEvidencePath({
        storagePath: path,
        retailerId,
        wardrobeItemId,
      }),
    ).toBe(true);
    expect(
      isSecureWardrobeEvidencePath({
        storagePath: `${retailerId}/other-item/file.jpg`,
        retailerId,
        wardrobeItemId,
      }),
    ).toBe(false);
    expect(
      isSecureWardrobeEvidencePath({
        storagePath: `${retailerId}/${wardrobeItemId}/../escape.jpg`,
        retailerId,
        wardrobeItemId,
      }),
    ).toBe(false);
  });

  it("rejects insecure upload meta", () => {
    const parsed = wardrobeAttachmentUploadMetaSchema.safeParse({
      wardrobeItemId,
      retailerId,
      storagePath: "wrong/path/file.jpg",
      fileName: "file.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 1024,
    });
    expect(parsed.success).toBe(false);
  });
});

describe("lifecycle and self-scan schemas", () => {
  it("requires guidance kind only when dismissing", () => {
    expect(
      recordWardrobeLifecycleEventInputSchema.safeParse({
        wardrobeItemId,
        eventKind: "guidance_dismissed",
      }).success,
    ).toBe(false);
    expect(
      recordWardrobeLifecycleEventInputSchema.safeParse({
        wardrobeItemId,
        eventKind: "guidance_dismissed",
        guidanceKind: "care_due",
      }).success,
    ).toBe(true);
    expect(
      recordWardrobeLifecycleEventInputSchema.safeParse({
        wardrobeItemId,
        eventKind: "worn",
        guidanceKind: "care_due",
      }).success,
    ).toBe(false);
  });

  it("accepts self-scan with optional paired appointment window", () => {
    expect(
      submitWardrobeSelfScanInputSchema.safeParse({
        wardrobeItemId,
        notes: "Feeling tight at the waist",
        sizeChangeReported: true,
      }).success,
    ).toBe(true);
    expect(
      submitWardrobeSelfScanInputSchema.safeParse({
        wardrobeItemId,
        appointmentStartsAt: "2026-08-01T10:00:00.000Z",
      }).success,
    ).toBe(false);
  });
});
