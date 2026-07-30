/**
 * Honeymoon Phase order journey repository (PHASE 10.2 / CMP-106).
 */

import {
  asId,
  projectHoneymoonMilestones,
  type HoneymoonMilestoneDraft,
  type HoneymoonMilestoneKind,
  type HoneymoonMilestoneStatus,
  type HoneymoonActionKind,
  type OrderId,
  type OrderStatus,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

type EnrollmentRow =
  Database["public"]["Tables"]["order_honeymoon_enrollments"]["Row"];
type MilestoneRow =
  Database["public"]["Tables"]["order_honeymoon_milestones"]["Row"];

export interface OrderHoneymoonEnrollment {
  readonly id: string;
  readonly orderId: OrderId;
  readonly retailerId: string;
  readonly customerId: string;
  readonly campaignId?: string;
  readonly libraryVersionId?: string;
  readonly status: "active" | "completed" | "withdrawn";
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface OrderHoneymoonMilestone {
  readonly id: string;
  readonly enrollmentId: string;
  readonly retailerId: string;
  readonly kind: HoneymoonMilestoneKind;
  readonly status: HoneymoonMilestoneStatus;
  readonly title: string;
  readonly explanation: string;
  readonly actionKind: HoneymoonActionKind;
  readonly actionHref?: string;
  readonly dueAt?: string;
  readonly stockTruth?: string;
  readonly leadTimeTruth?: string;
  readonly suppressReason?: string;
  readonly displayOrder: number;
  readonly completedAt?: string;
  readonly dismissedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

function toEnrollment(row: EnrollmentRow): OrderHoneymoonEnrollment {
  return {
    id: row.id,
    orderId: asId<"OrderId">(row.order_id),
    retailerId: row.retailer_id,
    customerId: row.customer_id,
    ...(row.campaign_id ? { campaignId: row.campaign_id } : {}),
    ...(row.library_version_id
      ? { libraryVersionId: row.library_version_id }
      : {}),
    status: row.status as OrderHoneymoonEnrollment["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toMilestone(row: MilestoneRow): OrderHoneymoonMilestone {
  return {
    id: row.id,
    enrollmentId: row.enrollment_id,
    retailerId: row.retailer_id,
    kind: row.kind as HoneymoonMilestoneKind,
    status: row.status as HoneymoonMilestoneStatus,
    title: row.title,
    explanation: row.explanation,
    actionKind: row.action_kind as HoneymoonActionKind,
    ...(row.action_href ? { actionHref: row.action_href } : {}),
    ...(row.due_at ? { dueAt: row.due_at } : {}),
    ...(row.stock_truth ? { stockTruth: row.stock_truth } : {}),
    ...(row.lead_time_truth ? { leadTimeTruth: row.lead_time_truth } : {}),
    ...(row.suppress_reason ? { suppressReason: row.suppress_reason } : {}),
    displayOrder: row.display_order,
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
    ...(row.dismissed_at ? { dismissedAt: row.dismissed_at } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function milestoneToJson(milestone: HoneymoonMilestoneDraft): Json {
  return {
    kind: milestone.kind,
    status: milestone.status,
    title: milestone.title,
    explanation: milestone.explanation,
    action_kind: milestone.actionKind,
    ...(milestone.actionHref ? { action_href: milestone.actionHref } : {}),
    ...(milestone.dueAt ? { due_at: milestone.dueAt } : {}),
    ...(milestone.stockTruth ? { stock_truth: milestone.stockTruth } : {}),
    ...(milestone.leadTimeTruth
      ? { lead_time_truth: milestone.leadTimeTruth }
      : {}),
    ...(milestone.suppressReason
      ? { suppress_reason: milestone.suppressReason }
      : {}),
    display_order: milestone.displayOrder,
  };
}

export class HoneymoonRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findEnrollmentByOrder(
    orderId: OrderId,
  ): Promise<OrderHoneymoonEnrollment | null> {
    const { data, error } = await this.client
      .from("order_honeymoon_enrollments")
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle();
    if (error) throw error;
    return data ? toEnrollment(data) : null;
  }

  async listMilestonesForOrder(
    orderId: OrderId,
  ): Promise<OrderHoneymoonMilestone[]> {
    const enrollment = await this.findEnrollmentByOrder(orderId);
    if (!enrollment) return [];

    const { data, error } = await this.client
      .from("order_honeymoon_milestones")
      .select("*")
      .eq("enrollment_id", enrollment.id)
      .order("display_order", { ascending: true });
    if (error) throw error;
    return data.map(toMilestone);
  }

  async syncMilestonesForOrder(args: {
    readonly orderId: OrderId;
    readonly orderStatus: OrderStatus;
    readonly placedAt?: string;
    readonly lines: readonly {
      readonly productVariantId: string;
      readonly sku?: string;
      readonly quantity: number;
      readonly requiresProduction: boolean;
      readonly requiresAlteration: boolean;
      readonly leadTimeDays?: number | null;
      readonly inventoryQuantity?: number | null;
    }[];
    readonly nowUtcIso: string;
    readonly recentTouchCount?: number;
    readonly cooldownUntil?: string;
  }): Promise<string> {
    const drafts = projectHoneymoonMilestones({
      orderId: args.orderId,
      orderStatus: args.orderStatus,
      ...(args.placedAt ? { placedAt: args.placedAt } : {}),
      lines: args.lines,
      nowUtcIso: args.nowUtcIso,
      recentTouchCount: args.recentTouchCount ?? 0,
      ...(args.cooldownUntil ? { cooldownUntil: args.cooldownUntil } : {}),
    });

    const payload: Json = drafts.map(milestoneToJson);
    const { data, error } = await this.client.rpc(
      "sync_order_honeymoon_milestones",
      {
        p_order_id: args.orderId,
        p_milestones: payload,
      },
    );
    if (error) throw error;
    return data;
  }

  async completeMilestone(milestoneId: string): Promise<void> {
    const { error } = await this.client.rpc("complete_honeymoon_milestone", {
      p_milestone_id: milestoneId,
    });
    if (error) throw error;
  }
}
