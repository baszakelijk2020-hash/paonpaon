import { describe, expect, it } from "vitest";

import {
  checkBudgetApproval,
  checkBudgetRequest,
  checkContributionModeration,
  checkContributionSubmission,
  checkSupportResource,
  isInAnnouncementAudience,
  summarizeCommunityReach,
  SUPPORT_RESOURCE_PRIVACY_NOTE,
} from "./community";

const staff = [
  { staffId: "a", branchId: "amsterdam", role: "sales_associate" },
  { staffId: "b", branchId: "amsterdam", role: "manager" },
  { staffId: "c", branchId: "rotterdam", role: "sales_associate" },
];

describe("isInAnnouncementAudience", () => {
  it("treats an empty role list as everyone, not nobody", () => {
    // An empty audience would silently hide an HQ safety notice.
    expect(
      isInAnnouncementAudience({
        audience: { scope: "retailer", roles: [] },
        viewer: staff[0]!,
      }),
    ).toBe(true);
  });

  it("limits a branch announcement to that branch", () => {
    const audience = {
      scope: "branch" as const,
      branchId: "amsterdam",
      roles: [],
    };
    expect(isInAnnouncementAudience({ audience, viewer: staff[0]! })).toBe(
      true,
    );
    expect(isInAnnouncementAudience({ audience, viewer: staff[2]! })).toBe(
      false,
    );
  });

  it("refuses a branch-scoped announcement that names no branch", () => {
    expect(
      isInAnnouncementAudience({
        audience: { scope: "branch", roles: [] },
        viewer: staff[0]!,
      }),
    ).toBe(false);
  });

  it("filters by role when roles are named", () => {
    const audience = { scope: "retailer" as const, roles: ["manager"] };
    expect(isInAnnouncementAudience({ audience, viewer: staff[1]! })).toBe(
      true,
    );
    expect(isInAnnouncementAudience({ audience, viewer: staff[0]! })).toBe(
      false,
    );
  });
});

describe("summarizeCommunityReach", () => {
  it("names who has not seen it rather than scoring who reads most", () => {
    const reach = summarizeCommunityReach({
      audience: { scope: "retailer", roles: [] },
      staff,
      acknowledgedStaffIds: ["a"],
    });
    expect(reach.audienceSize).toBe(3);
    expect(reach.acknowledgedCount).toBe(1);
    expect(reach.outstandingStaffIds).toEqual(["b", "c"]);
  });

  it("counts only people actually in the audience", () => {
    const reach = summarizeCommunityReach({
      audience: { scope: "branch", branchId: "rotterdam", roles: [] },
      staff,
      acknowledgedStaffIds: [],
    });
    expect(reach.audienceSize).toBe(1);
    expect(reach.outstandingStaffIds).toEqual(["c"]);
  });

  it("ignores an acknowledgement from someone outside the audience", () => {
    const reach = summarizeCommunityReach({
      audience: { scope: "branch", branchId: "rotterdam", roles: [] },
      staff,
      acknowledgedStaffIds: ["a", "b"],
    });
    expect(reach.acknowledgedCount).toBe(0);
  });

  it("exposes no cross-announcement per-person engagement field", () => {
    // The activity leaderboard this item forbids is exactly a per-employee
    // rate across messages. The summary is scoped to one announcement and
    // has no such field.
    const reach = summarizeCommunityReach({
      audience: { scope: "retailer", roles: [] },
      staff,
      acknowledgedStaffIds: [],
    });
    expect(Object.keys(reach)).toEqual([
      "audienceSize",
      "acknowledgedCount",
      "outstandingStaffIds",
    ]);
  });
});

describe("checkContributionSubmission", () => {
  const body =
    "Show the client the buttonhole before the fitting so they can veto it early.";

  it("accepts a substantive first version", () => {
    expect(
      checkContributionSubmission({ body, state: "draft", version: 1 }),
    ).toEqual({ ok: true });
  });

  it("refuses to edit an approved version in place", () => {
    // A reader must be able to tell which text was actually approved.
    expect(
      checkContributionSubmission({ body, state: "approved", version: 2 }),
    ).toEqual({ ok: false, reason: "approved_version_is_immutable" });
  });

  it("refuses a version number that would restate an approval", () => {
    expect(
      checkContributionSubmission({
        body,
        state: "draft",
        version: 2,
        latestApprovedVersion: 2,
      }),
    ).toEqual({ ok: false, reason: "version_not_incremented" });
  });

  it("refuses a body too thin to teach anyone anything", () => {
    expect(
      checkContributionSubmission({
        body: "do better",
        state: "draft",
        version: 1,
      }),
    ).toEqual({ ok: false, reason: "body_too_short" });
  });
});

describe("checkContributionModeration", () => {
  const base = {
    state: "submitted" as const,
    authorStaffId: "a",
    moderatorStaffId: "b",
    nextState: "approved" as const,
  };

  it("approves a colleague's submission", () => {
    expect(checkContributionModeration(base)).toEqual({ ok: true });
  });

  it("refuses self-moderation", () => {
    expect(
      checkContributionModeration({ ...base, moderatorStaffId: "a" }),
    ).toEqual({ ok: false, reason: "self_moderation_not_allowed" });
  });

  it("refuses a rejection with no reason", () => {
    // An anonymous veto teaches the contributor nothing.
    expect(
      checkContributionModeration({ ...base, nextState: "rejected" }),
    ).toEqual({ ok: false, reason: "rejection_requires_reason" });
  });

  it("refuses moderating something not submitted", () => {
    expect(checkContributionModeration({ ...base, state: "draft" })).toEqual({
      ok: false,
      reason: "not_awaiting_moderation",
    });
  });
});

describe("checkBudgetRequest", () => {
  const base = {
    amountMinorUnits: 5000,
    perRequestCapMinorUnits: 25000,
    reason: "Re-press and courier a jacket we returned creased.",
    customerId: "customer-1",
  };

  it("accepts a capped, reasoned, customer-linked request", () => {
    expect(checkBudgetRequest(base)).toEqual({ ok: true });
  });

  it("refuses an amount above the cap", () => {
    expect(checkBudgetRequest({ ...base, amountMinorUnits: 25001 })).toEqual({
      ok: false,
      reason: "amount_above_cap",
    });
  });

  it("refuses a fractional or negative amount", () => {
    expect(checkBudgetRequest({ ...base, amountMinorUnits: 0 })).toEqual({
      ok: false,
      reason: "amount_not_positive",
    });
    expect(checkBudgetRequest({ ...base, amountMinorUnits: 12.5 })).toEqual({
      ok: false,
      reason: "amount_not_positive",
    });
  });

  it("refuses a budget line attached to no customer or order", () => {
    // Unattached, this is petty cash — a different thing with different
    // controls.
    const { customerId: _omitted, ...withoutContext } = base;
    expect(checkBudgetRequest(withoutContext)).toEqual({
      ok: false,
      reason: "no_service_context",
    });
  });
});

describe("checkBudgetApproval", () => {
  it("approves when someone else signs it off", () => {
    expect(
      checkBudgetApproval({
        state: "requested",
        requesterStaffId: "a",
        approverStaffId: "b",
      }),
    ).toEqual({ ok: true });
  });

  it("refuses self-approval", () => {
    expect(
      checkBudgetApproval({
        state: "requested",
        requesterStaffId: "a",
        approverStaffId: "a",
      }),
    ).toEqual({ ok: false, reason: "self_approval_not_allowed" });
  });

  it("refuses approving an already-decided request", () => {
    expect(
      checkBudgetApproval({
        state: "approved",
        requesterStaffId: "a",
        approverStaffId: "b",
      }),
    ).toEqual({ ok: false, reason: "not_awaiting_approval" });
  });
});

describe("checkSupportResource", () => {
  it("accepts an informational resource with a contact route", () => {
    expect(
      checkSupportResource({
        key: "eap",
        title: "Employee assistance line",
        summary: "Confidential counselling, 24/7.",
        phone: "0800 000 000",
        directBookingAvailable: false,
      }),
    ).toEqual({ ok: true });
  });

  it("refuses a resource nobody can actually reach", () => {
    expect(
      checkSupportResource({
        key: "eap",
        title: "Employee assistance line",
        summary: "Confidential counselling.",
        directBookingAvailable: false,
      }),
    ).toEqual({ ok: false, reason: "no_contact_route" });
  });

  it("refuses to claim direct booking without a provider contract", () => {
    // The contract is a real blocker. A resource that claims bookability
    // without one sends someone in distress to a dead end.
    expect(
      checkSupportResource({
        key: "eap",
        title: "Employee assistance line",
        summary: "Confidential counselling.",
        phone: "0800 000 000",
        directBookingAvailable: true,
      }),
    ).toEqual({ ok: false, reason: "direct_booking_not_contracted" });
  });

  it("states in code why no usage log exists", () => {
    expect(SUPPORT_RESOURCE_PRIVACY_NOTE).toContain("not recorded anywhere");
  });
});
