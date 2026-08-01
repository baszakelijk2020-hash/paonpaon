/**
 * Internal community, contribution and support (WFM-107 / PHASE 11.4).
 *
 * Audience filtering for announcements happens here rather than in RLS.
 * RLS scopes rows to the tenant; a branch/role predicate in the policy
 * would make an HQ announcement invisible to a staff member whose branch
 * assignment is still null, which is exactly the person most likely to be
 * new and most in need of it.
 *
 * There is no `recordSupportResourceView` and there never should be. See
 * SUPPORT_RESOURCE_PRIVACY_NOTE in @paon/domain.
 */

import {
  checkBudgetApproval,
  checkBudgetRequest,
  checkContributionModeration,
  checkContributionSubmission,
  isInAnnouncementAudience,
  summarizeCommunityReach,
  type AnnouncementAudience,
  type BudgetCheck,
  type BudgetRequestState,
  type CommunityReach,
  type ContributionCheck,
  type ContributionState,
  type RetailerId,
  type StaffViewer,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type AnnouncementRow =
  Database["public"]["Tables"]["staff_announcements"]["Row"];
type ContributionRow =
  Database["public"]["Tables"]["staff_learning_contributions"]["Row"];
type SupportRow =
  Database["public"]["Tables"]["staff_support_resources"]["Row"];

function toAudience(row: AnnouncementRow): AnnouncementAudience {
  return {
    scope: row.branch_id ? "branch" : "retailer",
    ...(row.branch_id ? { branchId: row.branch_id } : {}),
    roles: row.audience_roles,
  };
}

export class InternalCommunityRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  /** Published announcements this viewer is actually in the audience for. */
  async listAnnouncementsFor(args: {
    readonly retailerId: RetailerId;
    readonly viewer: StaffViewer;
    readonly limit?: number;
  }): Promise<readonly AnnouncementRow[]> {
    const { data, error } = await this.client
      .from("staff_announcements")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .not("published_at", "is", null)
      .is("deleted_at", null)
      .order("published_at", { ascending: false })
      .limit(args.limit ?? 50);
    if (error) throw error;
    return (data ?? []).filter((row) =>
      isInAnnouncementAudience({
        audience: toAudience(row),
        viewer: args.viewer,
      }),
    );
  }

  async publishAnnouncement(args: {
    readonly retailerId: RetailerId;
    readonly authoredByStaffId: string;
    readonly title: string;
    readonly body: string;
    readonly audienceRoles?: readonly string[];
    readonly branchId?: string;
    readonly requiresAcknowledgement?: boolean;
  }): Promise<{ readonly id: string }> {
    const { data, error } = await this.client
      .from("staff_announcements")
      .insert({
        retailer_id: args.retailerId,
        authored_by_staff_id: args.authoredByStaffId,
        title: args.title.trim(),
        body: args.body.trim(),
        audience_roles: [...(args.audienceRoles ?? [])],
        requires_acknowledgement: args.requiresAcknowledgement ?? false,
        published_at: new Date().toISOString(),
        ...(args.branchId ? { branch_id: args.branchId } : {}),
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: data.id };
  }

  /**
   * Records a read receipt. Idempotent by unique constraint: a repeated
   * page load must not inflate a reach number that is supposed to be a
   * fact about people, not about page views.
   */
  async acknowledgeAnnouncement(args: {
    readonly retailerId: RetailerId;
    readonly announcementId: string;
    readonly staffId: string;
  }): Promise<void> {
    const { error } = await this.client
      .from("staff_announcement_acknowledgements")
      .upsert(
        {
          retailer_id: args.retailerId,
          announcement_id: args.announcementId,
          staff_id: args.staffId,
        },
        { onConflict: "announcement_id,staff_id", ignoreDuplicates: true },
      );
    if (error) throw error;
  }

  /** Reach of ONE announcement — see the domain module on why not more. */
  async announcementReach(args: {
    readonly retailerId: RetailerId;
    readonly announcementId: string;
    readonly staff: readonly StaffViewer[];
  }): Promise<CommunityReach> {
    const { data: announcement, error } = await this.client
      .from("staff_announcements")
      .select("*")
      .eq("id", args.announcementId)
      .eq("retailer_id", args.retailerId)
      .maybeSingle();
    if (error) throw error;
    if (!announcement) throw new Error("Announcement not found");

    const { data: acks, error: ackError } = await this.client
      .from("staff_announcement_acknowledgements")
      .select("staff_id")
      .eq("announcement_id", args.announcementId);
    if (ackError) throw ackError;

    return summarizeCommunityReach({
      audience: toAudience(announcement),
      staff: args.staff,
      acknowledgedStaffIds: (acks ?? []).map((row) => row.staff_id),
    });
  }

  async submitContribution(args: {
    readonly retailerId: RetailerId;
    readonly authorStaffId: string;
    readonly title: string;
    readonly body: string;
  }): Promise<{ readonly ok: true; readonly id: string } | ContributionCheck> {
    const { data: prior, error: priorError } = await this.client
      .from("staff_learning_contributions")
      .select("version, state")
      .eq("retailer_id", args.retailerId)
      .eq("author_staff_id", args.authorStaffId)
      .eq("title", args.title.trim())
      .order("version", { ascending: false })
      .limit(1);
    if (priorError) throw priorError;

    const latestApproved = (prior ?? []).find(
      (row) => row.state === "approved",
    )?.version;
    const nextVersion = (prior?.[0]?.version ?? 0) + 1;

    const check = checkContributionSubmission({
      body: args.body,
      state: "draft",
      version: nextVersion,
      ...(latestApproved ? { latestApprovedVersion: latestApproved } : {}),
    });
    if (!check.ok) return check;

    const { data, error } = await this.client
      .from("staff_learning_contributions")
      .insert({
        retailer_id: args.retailerId,
        author_staff_id: args.authorStaffId,
        title: args.title.trim(),
        body: args.body.trim(),
        version: nextVersion,
        state: "submitted",
      })
      .select("id")
      .single();
    if (error) throw error;
    return { ok: true, id: data.id };
  }

  async moderateContribution(args: {
    readonly retailerId: RetailerId;
    readonly contributionId: string;
    readonly moderatorStaffId: string;
    readonly nextState: Extract<ContributionState, "approved" | "rejected">;
    readonly moderationNote?: string;
  }): Promise<{ readonly ok: true } | ContributionCheck> {
    const { data: current, error } = await this.client
      .from("staff_learning_contributions")
      .select("state, author_staff_id")
      .eq("id", args.contributionId)
      .eq("retailer_id", args.retailerId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    if (!current) throw new Error("Contribution not found");

    const check = checkContributionModeration({
      state: current.state as ContributionState,
      authorStaffId: current.author_staff_id,
      moderatorStaffId: args.moderatorStaffId,
      nextState: args.nextState,
      ...(args.moderationNote ? { moderationNote: args.moderationNote } : {}),
    });
    if (!check.ok) return check;

    const { error: updateError } = await this.client
      .from("staff_learning_contributions")
      .update({
        state: args.nextState,
        moderated_by_staff_id: args.moderatorStaffId,
        moderated_at: new Date().toISOString(),
        ...(args.moderationNote
          ? { moderation_note: args.moderationNote.trim() }
          : {}),
      })
      .eq("id", args.contributionId)
      .eq("retailer_id", args.retailerId)
      .eq("state", "submitted");
    if (updateError) throw updateError;
    return { ok: true };
  }

  async listApprovedContributions(args: {
    readonly retailerId: RetailerId;
  }): Promise<readonly ContributionRow[]> {
    const { data, error } = await this.client
      .from("staff_learning_contributions")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .eq("state", "approved")
      .is("deleted_at", null)
      .order("moderated_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async requestServiceRecoveryBudget(args: {
    readonly retailerId: RetailerId;
    readonly requestedByStaffId: string;
    readonly amountMinorUnits: number;
    readonly perRequestCapMinorUnits: number;
    readonly reason: string;
    readonly currency?: string;
    readonly customerId?: string;
    readonly orderId?: string;
  }): Promise<{ readonly ok: true; readonly id: string } | BudgetCheck> {
    const check = checkBudgetRequest(args);
    if (!check.ok) return check;

    const { data, error } = await this.client
      .from("service_recovery_budget_requests")
      .insert({
        retailer_id: args.retailerId,
        requested_by_staff_id: args.requestedByStaffId,
        amount_minor_units: args.amountMinorUnits,
        currency: args.currency ?? "EUR",
        reason: args.reason.trim(),
        state: "requested",
        ...(args.customerId ? { customer_id: args.customerId } : {}),
        ...(args.orderId ? { order_id: args.orderId } : {}),
      })
      .select("id")
      .single();
    if (error) throw error;
    return { ok: true, id: data.id };
  }

  /**
   * Approves an authorisation to spend. Moves no money: there is no
   * provider reference and no link to `public.payments`, because ADR-062
   * has not decided a payout design.
   */
  async decideServiceRecoveryBudget(args: {
    readonly retailerId: RetailerId;
    readonly requestId: string;
    readonly approverStaffId: string;
    readonly approve: boolean;
    readonly decisionNote?: string;
  }): Promise<{ readonly ok: true } | BudgetCheck> {
    const { data: current, error } = await this.client
      .from("service_recovery_budget_requests")
      .select("state, requested_by_staff_id")
      .eq("id", args.requestId)
      .eq("retailer_id", args.retailerId)
      .maybeSingle();
    if (error) throw error;
    if (!current) throw new Error("Budget request not found");

    const check = checkBudgetApproval({
      state: current.state as BudgetRequestState,
      requesterStaffId: current.requested_by_staff_id,
      approverStaffId: args.approverStaffId,
    });
    if (!check.ok) return check;

    const { error: updateError } = await this.client
      .from("service_recovery_budget_requests")
      .update({
        state: args.approve ? "approved" : "declined",
        approved_by_staff_id: args.approverStaffId,
        decided_at: new Date().toISOString(),
        ...(args.decisionNote
          ? { decision_note: args.decisionNote.trim() }
          : {}),
      })
      .eq("id", args.requestId)
      .eq("retailer_id", args.retailerId)
      .eq("state", "requested");
    if (updateError) throw updateError;
    return { ok: true };
  }

  /**
   * The support catalogue. Reading it records nothing — there is no view
   * table to write to, by design.
   */
  async listSupportResources(args: {
    readonly retailerId: RetailerId;
  }): Promise<readonly SupportRow[]> {
    const { data, error } = await this.client
      .from("staff_support_resources")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .is("deleted_at", null)
      .order("title", { ascending: true });
    if (error) throw error;
    return data ?? [];
  }
}
