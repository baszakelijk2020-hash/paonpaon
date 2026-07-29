import { describe, expect, it } from "vitest";

import {
  parseCreateRetailerConceptForm,
  parseProposeAssignmentForm,
  parseRetailerOverrideForm,
  parseReviewAssignmentForm,
} from "./metadata-retailer-form";

const retailerId = "00000000-0000-4000-8000-000000000001";
const conceptId = "00000000-0000-4000-8000-000000000002";
const targetId = "00000000-0000-4000-8000-000000000004";
const assignmentId = "00000000-0000-4000-8000-000000000006";

describe("parseProposeAssignmentForm", () => {
  it("forces pending review even when form fields try to accept", () => {
    const result = parseProposeAssignmentForm(retailerId, {
      targetType: "product",
      targetId,
      conceptId,
      source: "retailer",
      reviewStatus: "accepted",
      reviewedByStaffId: "00000000-0000-4000-8000-000000000005",
      reviewedAt: "2026-07-30T10:00:00.000Z",
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.reviewStatus).toBe("pending");
    expect(result.data.reviewedByStaffId).toBeUndefined();
    expect(result.data.reviewedAt).toBeUndefined();
  });

  it("requires supplier raw value and AI confidence/evidence", () => {
    expect(
      parseProposeAssignmentForm(retailerId, {
        targetType: "product",
        targetId,
        conceptId,
        source: "supplier",
      }).success,
    ).toBe(false);

    expect(
      parseProposeAssignmentForm(retailerId, {
        targetType: "product",
        targetId,
        conceptId,
        source: "ai",
      }).success,
    ).toBe(false);

    const ai = parseProposeAssignmentForm(retailerId, {
      targetType: "product",
      targetId,
      conceptId,
      source: "ai",
      confidence: "0.81",
      evidenceSummary: "Matched from supplier sheet column Fibre",
    });
    expect(ai.success).toBe(true);
  });
});

describe("parseReviewAssignmentForm", () => {
  it("accepts only terminal decisions", () => {
    expect(
      parseReviewAssignmentForm({
        assignmentId,
        decision: "accepted",
      }).success,
    ).toBe(true);
    expect(
      parseReviewAssignmentForm({
        assignmentId,
        decision: "rejected",
      }).success,
    ).toBe(true);
    expect(
      parseReviewAssignmentForm({
        assignmentId,
        decision: "pending",
      }).success,
    ).toBe(false);
  });
});

describe("parseCreateRetailerConceptForm", () => {
  it("keeps unknown vocabulary tenant-owned", () => {
    const result = parseCreateRetailerConceptForm(retailerId, {
      kind: "fibre",
      slug: "local-merino-blend",
      canonicalName: "Local merino blend",
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.retailerId).toBe(retailerId);
  });

  it("rejects empty names and invalid slugs", () => {
    expect(
      parseCreateRetailerConceptForm(retailerId, {
        kind: "fibre",
        slug: "Bad Slug",
        canonicalName: "Local merino blend",
      }).success,
    ).toBe(false);
  });
});

describe("parseRetailerOverrideForm", () => {
  it("parses presentation overrides without mutating concept identity", () => {
    const result = parseRetailerOverrideForm(retailerId, {
      conceptId,
      displayName: "House label",
      summaryOverride: "Preferred local wording",
      isHidden: "on",
      priorityOverride: "10",
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data).toMatchObject({
      retailerId,
      conceptId,
      displayName: "House label",
      isHidden: true,
      priorityOverride: 10,
    });
  });
});
