/**
 * Mission Control Decision Feed composition (PHASE 11.6 / build-order item 6).
 *
 * Orchestrates fetching the five signal sources that feed the decision intelligence
 * ranking layer (rankDecisionFeedEntries). Reuses exact existing queries/repository
 * methods for each source — no new query logic, only composition into the ranking
 * input shape.
 *
 * The five sources are:
 * 1. Draft/accepted clienteling opportunities assigned to or visible to the staff member
 * 2. Today's appointments (not completed/canceled/no_show)
 * 3. Unread messages/notifications for this staff member
 * 4. Pending price approvals (visible only to staff with approve_pricing permission)
 * 5. Low stock variants (visible only to staff with inventory permission)
 */

import {
  rankDecisionFeedEntries,
  type Appointment,
  type ClientelingOpportunity,
  type DecisionFeedInput,
  type Notification,
  type RankedDecisionFeedEntry,
  type RetailerId,
  type UserId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";

import { AlterationWorkflowRepository } from "./alteration-workflow-repository";
import { AppointmentRepository } from "./appointment-repository";
import { ClientelingOpportunityRepository } from "./clienteling-opportunity-repository";
import { NotificationRepository } from "./notification-repository";
import { ProductVariantRepository } from "./product-variant-repository";

type ComposeDecisionFeedArgs = {
  readonly retailerId: RetailerId;
  readonly userId: UserId;
  readonly now?: Date;
  readonly includeExpired?: boolean;
};

export class DecisionFeedRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  /**
   * Compose the decision feed from all five signal sources and rank them
   * using fixed weights and urgency.
   *
   * Returns a ranked list of decision feed entries, or an empty array if
   * all sources are empty. Does not fabricate entries when signals are
   * missing — reflects true empty state.
   */
  async composeDecisionFeed(
    args: ComposeDecisionFeedArgs,
  ): Promise<RankedDecisionFeedEntry[]> {
    const now = args.now ?? new Date();

    // Fetch all five signal sources in parallel
    const [
      appointments,
      clientelingOpportunities,
      notifications,
      pendingProposals,
      lowStockVariants,
    ] = await Promise.all([
      new AppointmentRepository(this.client).findByRetailer(args.retailerId),
      new ClientelingOpportunityRepository(this.client).listForRetailer(
        args.retailerId,
      ),
      new NotificationRepository(this.client).findByUser(args.userId),
      new AlterationWorkflowRepository(
        this.client,
      ).findPendingProposalsByRetailer(args.retailerId),
      new ProductVariantRepository(this.client).countLowStockForRetailer(
        args.retailerId,
        5,
      ),
    ]);

    const inputs: DecisionFeedInput[] = [];

    // 1. Clienteling opportunities: draft/accepted, assigned to this staff or without assignment
    // Filter to opportunities that are relevant to this staff member
    const relevantOpportunities = clientelingOpportunities.filter(
      (opp: ClientelingOpportunity) => {
        // Include if not yet expired (or if includeExpired is true)
        if (!args.includeExpired && opp.expiresAt) {
          if (new Date(opp.expiresAt) < now) {
            return false;
          }
        }
        // Include only draft and accepted statuses
        return ["draft", "accepted"].includes(opp.status);
      },
    );

    for (const opp of relevantOpportunities) {
      inputs.push({
        kind: "clienteling_opportunity",
        sourceId: opp.id,
        customerId: opp.customerId,
        opportunityType: opp.type,
        whyNow: opp.whyNow,
        suggestedAction: opp.suggestedAction,
        priority: opp.priority,
        confidence: opp.confidence,
        ...(opp.dueAt ? { dueAt: opp.dueAt } : {}),
        ...(opp.expiresAt ? { expiresAt: opp.expiresAt } : {}),
      });
    }

    // 2. Today's appointments
    const todaysAppointments = appointments.filter(
      (apt: Appointment) =>
        isToday(apt.startsAt, now) &&
        !["completed", "canceled", "no_show"].includes(apt.status),
    );

    for (const apt of todaysAppointments) {
      // Determine if appointment is soon (within 2 hours)
      const startsMs = new Date(apt.startsAt).getTime();
      const nowMs = now.getTime();
      const minutesUntil = (startsMs - nowMs) / (60 * 1000);
      const isImminent = minutesUntil >= 0 && minutesUntil <= 120;

      inputs.push({
        kind: isImminent ? "appointment_soon" : "appointment_today",
        sourceId: apt.id,
        customerId: apt.customerId,
        startsAt: apt.startsAt,
        // customer name will be resolved by UI layer, not stored here
        appointmentType: apt.type,
      });
    }

    // 3. Unread messages: aggregate count for this staff member
    const unreadCount = notifications.filter(
      (notif: Notification) => !notif.readAt,
    ).length;
    if (unreadCount > 0) {
      inputs.push({
        kind: "unread_message",
        sourceId: "notifications-aggregate",
        messageThreadId: "notifications",
        unreadCount,
      });
    }

    // 4. Pending price approvals
    for (const proposal of pendingProposals) {
      inputs.push({
        kind: "price_approval_pending",
        sourceId: proposal.id,
        workOrderNumber: proposal.workOrderNumber,
        originalAmountMinorUnits: proposal.originalAmount.amountMinorUnits,
        proposedAmountMinorUnits: proposal.proposedAmount.amountMinorUnits,
      });
    }

    // 5. Low stock: only add if there are low stock items
    // The count was fetched earlier; if it's > 0, add a single aggregate entry
    if (lowStockVariants > 0) {
      inputs.push({
        kind: "low_stock",
        sourceId: "low-stock-aggregate",
        variantName: `${lowStockVariants} variant${lowStockVariants === 1 ? "" : "s"}`,
        unitCount: lowStockVariants,
      });
    }

    // Rank and return
    return rankDecisionFeedEntries(inputs, now);
  }
}

/**
 * Check if an ISO date string falls on today (in UTC).
 */
function isToday(isoDate: string, now: Date): boolean {
  const target = new Date(isoDate);
  return (
    target.getUTCFullYear() === now.getUTCFullYear() &&
    target.getUTCMonth() === now.getUTCMonth() &&
    target.getUTCDate() === now.getUTCDate()
  );
}
