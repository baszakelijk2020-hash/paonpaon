/**
 * Internal community, contribution and support (WFM-107 / PHASE 11.4).
 *
 * Four capabilities that share one constraint: none of them may become a
 * measurement of the employee.
 *
 * - Announcements are audience-scoped, and an acknowledgement is a receipt
 *   ("I have read the fire-door change"), never a participation metric.
 *   `summarizeCommunityReach` therefore reports whether a message reached
 *   its audience and returns the list of people who have NOT seen it — an
 *   operational gap a manager closes — and exposes no per-person totals.
 * - Learning contributions are moderated and versioned. An approved
 *   version is immutable; improving it means submitting the next version,
 *   so a reader can always tell which text was actually approved.
 * - Service-recovery budget requests separate requester from approver and
 *   never move money. The item's non-goal is explicit that no payout
 *   design exists yet; this records an internal authorisation only.
 * - Support resources are a read-only catalogue with NO usage log at all.
 *   See `SUPPORT_RESOURCE_PRIVACY_NOTE`.
 */

export const ANNOUNCEMENT_SCOPES = ["retailer", "branch"] as const;
export type AnnouncementScope = (typeof ANNOUNCEMENT_SCOPES)[number];

export interface AnnouncementAudience {
  readonly scope: AnnouncementScope;
  /** Required when scope is "branch". */
  readonly branchId?: string;
  /** Empty means every role. */
  readonly roles: readonly string[];
}

export interface StaffViewer {
  readonly staffId: string;
  readonly branchId?: string;
  readonly role: string;
}

/**
 * Whether one staff member is in an announcement's audience. Role list
 * empty means "everyone", which is different from "nobody" — an empty
 * audience would silently hide an HQ safety notice.
 */
export function isInAnnouncementAudience(args: {
  readonly audience: AnnouncementAudience;
  readonly viewer: StaffViewer;
}): boolean {
  const { audience, viewer } = args;
  if (audience.scope === "branch") {
    if (!audience.branchId) return false;
    if (audience.branchId !== viewer.branchId) return false;
  }
  if (audience.roles.length === 0) return true;
  return audience.roles.includes(viewer.role);
}

export interface CommunityReach {
  readonly audienceSize: number;
  readonly acknowledgedCount: number;
  /** Who still has not seen it. The point of the whole summary. */
  readonly outstandingStaffIds: readonly string[];
}

/**
 * Reach of ONE announcement. Deliberately scoped to a single message: an
 * "engagement rate per employee across all announcements" is the activity
 * leaderboard this item forbids, and the way to make that impossible is to
 * offer no function that spans messages.
 */
export function summarizeCommunityReach(args: {
  readonly audience: AnnouncementAudience;
  readonly staff: readonly StaffViewer[];
  readonly acknowledgedStaffIds: readonly string[];
}): CommunityReach {
  const inAudience = args.staff.filter((viewer) =>
    isInAnnouncementAudience({ audience: args.audience, viewer }),
  );
  const acknowledged = new Set(args.acknowledgedStaffIds);
  const outstanding = inAudience
    .filter((viewer) => !acknowledged.has(viewer.staffId))
    .map((viewer) => viewer.staffId)
    .sort();
  return {
    audienceSize: inAudience.length,
    acknowledgedCount: inAudience.length - outstanding.length,
    outstandingStaffIds: outstanding,
  };
}

export const CONTRIBUTION_STATES = [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "withdrawn",
] as const;
export type ContributionState = (typeof CONTRIBUTION_STATES)[number];

export type ContributionCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "self_moderation_not_allowed"
        | "not_awaiting_moderation"
        | "rejection_requires_reason"
        | "approved_version_is_immutable"
        | "body_too_short"
        | "version_not_incremented";
    };

const CONTRIBUTION_MIN_BODY = 40;

export function checkContributionSubmission(args: {
  readonly body: string;
  readonly state: ContributionState;
  readonly version: number;
  readonly latestApprovedVersion?: number;
}): ContributionCheck {
  if (args.state === "approved") {
    return { ok: false, reason: "approved_version_is_immutable" };
  }
  if (args.body.trim().length < CONTRIBUTION_MIN_BODY) {
    return { ok: false, reason: "body_too_short" };
  }
  if (args.version <= (args.latestApprovedVersion ?? 0)) {
    return { ok: false, reason: "version_not_incremented" };
  }
  return { ok: true };
}

/**
 * Moderation. Self-moderation is refused for the same reason self-review
 * is elsewhere in Stage 11: RLS proves the caller is a manager, not that
 * the work under review is someone else's.
 */
export function checkContributionModeration(args: {
  readonly state: ContributionState;
  readonly authorStaffId: string;
  readonly moderatorStaffId: string;
  readonly nextState: Extract<ContributionState, "approved" | "rejected">;
  readonly moderationNote?: string;
}): ContributionCheck {
  if (args.state !== "submitted") {
    return { ok: false, reason: "not_awaiting_moderation" };
  }
  if (args.authorStaffId === args.moderatorStaffId) {
    return { ok: false, reason: "self_moderation_not_allowed" };
  }
  if (
    args.nextState === "rejected" &&
    (args.moderationNote ?? "").trim().length === 0
  ) {
    // A rejection with no reason teaches the contributor nothing and reads
    // as an anonymous veto.
    return { ok: false, reason: "rejection_requires_reason" };
  }
  return { ok: true };
}

export const BUDGET_REQUEST_STATES = [
  "requested",
  "approved",
  "declined",
  "spent",
] as const;
export type BudgetRequestState = (typeof BUDGET_REQUEST_STATES)[number];

export type BudgetCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "amount_not_positive"
        | "amount_above_cap"
        | "reason_required"
        | "no_service_context"
        | "self_approval_not_allowed"
        | "not_awaiting_approval";
    };

/**
 * A service-recovery budget request. Money is NOT moved here and no
 * provider is named — this item's non-goal and ADR-062 both say a payout
 * design does not exist yet. What this records is an internal
 * authorisation to spend up to an amount, which is a real and separate
 * artefact from the payment that may later settle it.
 */
export function checkBudgetRequest(args: {
  readonly amountMinorUnits: number;
  readonly perRequestCapMinorUnits: number;
  readonly reason: string;
  readonly customerId?: string;
  readonly orderId?: string;
}): BudgetCheck {
  if (!Number.isInteger(args.amountMinorUnits) || args.amountMinorUnits <= 0) {
    return { ok: false, reason: "amount_not_positive" };
  }
  if (args.amountMinorUnits > args.perRequestCapMinorUnits) {
    return { ok: false, reason: "amount_above_cap" };
  }
  if (args.reason.trim().length < 10) {
    return { ok: false, reason: "reason_required" };
  }
  if (!args.customerId && !args.orderId) {
    // Service recovery is recovery *for someone*. An unattached budget line
    // is petty cash, which is a different thing with different controls.
    return { ok: false, reason: "no_service_context" };
  }
  return { ok: true };
}

export function checkBudgetApproval(args: {
  readonly state: BudgetRequestState;
  readonly requesterStaffId: string;
  readonly approverStaffId: string;
}): BudgetCheck {
  if (args.state !== "requested") {
    return { ok: false, reason: "not_awaiting_approval" };
  }
  if (args.requesterStaffId === args.approverStaffId) {
    return { ok: false, reason: "self_approval_not_allowed" };
  }
  return { ok: true };
}

/**
 * Why there is no support-resource usage log anywhere in this codebase.
 *
 * The item requires "confidential external support-resource handoff" and
 * forbids exposing private support use. The only implementation that
 * actually delivers that is to record nothing: an access log readable by
 * managers defeats the purpose outright, and one readable by nobody is
 * still a re-identification risk in a five-person store and would still
 * have to be disclosed. So the catalogue is readable and usage is not
 * observable — there is no table, no counter and no event.
 *
 * A test asserts the migration creates no such table, so a future
 * "engagement analytics" request has to argue with this note first.
 */
export const SUPPORT_RESOURCE_PRIVACY_NOTE =
  "Support-resource usage is deliberately not recorded anywhere. " +
  "A confidential handoff that leaves an audit trail is not confidential.";

export interface SupportResource {
  readonly key: string;
  readonly title: string;
  readonly summary: string;
  readonly externalUrl?: string;
  readonly phone?: string;
  /** Direct booking needs a signed provider contract; until then the
   * resource is informational and this stays false. */
  readonly directBookingAvailable: boolean;
}

export type SupportResourceCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: "no_contact_route" | "direct_booking_not_contracted";
    };

export function checkSupportResource(
  resource: SupportResource,
): SupportResourceCheck {
  if (!resource.externalUrl && !resource.phone) {
    return { ok: false, reason: "no_contact_route" };
  }
  if (resource.directBookingAvailable) {
    // Guarded rather than merely documented: the contract is a real
    // blocker, and a resource that claims bookability without one would
    // send an employee in distress to a dead end.
    return { ok: false, reason: "direct_booking_not_contracted" };
  }
  return { ok: true };
}
