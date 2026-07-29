/**
 * MorningRoutine delivery subscriptions, audit, and retailer controls
 * (PHASE 4.5).
 */

import {
  asId,
  type MorningRoutineDeliveryAudit,
  type MorningRoutineDeliveryAuditId,
  type MorningRoutineDeliveryChannel,
  type MorningRoutineDeliveryFrequency,
  type MorningRoutineDeliveryOutcome,
  type MorningRoutineEligibleProduct,
  type MorningRoutineRetailerDeliverySettings,
  type MorningRoutineSubscription,
  type MorningRoutineSubscriptionId,
  type MorningRoutineSuppressionReason,
  type UpsertMorningRoutineSubscriptionInput,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type SubscriptionRow =
  Database["public"]["Tables"]["morning_routine_subscriptions"]["Row"];
type AuditRow =
  Database["public"]["Tables"]["morning_routine_delivery_audits"]["Row"];
type EligibleRow =
  Database["public"]["Tables"]["morning_routine_eligible_products"]["Row"];

function toSubscription(row: SubscriptionRow): MorningRoutineSubscription {
  return {
    id: asId<"MorningRoutineSubscriptionId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    optedIn: row.opted_in,
    ...(row.opted_in_at ? { optedInAt: row.opted_in_at } : {}),
    ...(row.opted_out_at ? { optedOutAt: row.opted_out_at } : {}),
    frequency: row.frequency as MorningRoutineDeliveryFrequency,
    timezone: row.timezone,
    ...(row.quiet_start_minute !== null && row.quiet_end_minute !== null
      ? {
          quietHours: {
            startMinute: row.quiet_start_minute,
            endMinute: row.quiet_end_minute,
          },
        }
      : {}),
    channels: row.channels as MorningRoutineDeliveryChannel[],
    preferredLocalHour: row.preferred_local_hour,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toAudit(row: AuditRow): MorningRoutineDeliveryAudit {
  return {
    id: asId<"MorningRoutineDeliveryAuditId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    ...(row.selection_id
      ? { selectionId: asId<"MorningRoutineSelectionId">(row.selection_id) }
      : {}),
    forDate: row.for_date,
    outcome: row.outcome as MorningRoutineDeliveryOutcome,
    ...(row.suppression_reason
      ? {
          suppressionReason:
            row.suppression_reason as MorningRoutineSuppressionReason,
        }
      : {}),
    ...(row.notification_id
      ? { notificationId: asId<"NotificationId">(row.notification_id) }
      : {}),
    scheduledFor: row.scheduled_for,
    createdAt: row.created_at,
  };
}

function toEligible(row: EligibleRow): MorningRoutineEligibleProduct {
  return {
    retailerId: asId<"RetailerId">(row.retailer_id),
    productId: asId<"ProductId">(row.product_id),
    active: row.active,
    ...(row.created_by_staff_id
      ? { createdByStaffId: asId<"StaffId">(row.created_by_staff_id) }
      : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class MorningRoutineDeliveryRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findSubscriptionByCustomer(
    customerId: string,
  ): Promise<MorningRoutineSubscription | null> {
    const { data, error } = await this.client
      .from("morning_routine_subscriptions")
      .select("*")
      .eq("customer_id", customerId)
      .maybeSingle();
    if (error) throw error;
    return data ? toSubscription(data) : null;
  }

  async upsertSubscription(
    input: UpsertMorningRoutineSubscriptionInput,
  ): Promise<MorningRoutineSubscriptionId> {
    const { data, error } = await this.client.rpc(
      "upsert_morning_routine_subscription",
      {
        p_retailer_id: input.retailerId,
        p_customer_id: input.customerId,
        p_opted_in: input.optedIn,
        p_frequency: input.frequency,
        p_timezone: input.timezone,
        p_preferred_local_hour: input.preferredLocalHour,
        p_channels: [...input.channels],
        ...(input.quietStartMinute !== undefined
          ? { p_quiet_start_minute: input.quietStartMinute }
          : {}),
        ...(input.quietEndMinute !== undefined
          ? { p_quiet_end_minute: input.quietEndMinute }
          : {}),
      },
    );
    if (error) throw error;
    return asId<"MorningRoutineSubscriptionId">(data);
  }

  async listOptedInSubscriptions(
    limit = 200,
  ): Promise<MorningRoutineSubscription[]> {
    const { data, error } = await this.client
      .from("morning_routine_subscriptions")
      .select("*")
      .eq("opted_in", true)
      .order("updated_at", { ascending: true })
      .limit(limit);
    if (error) throw error;
    return data.map(toSubscription);
  }

  async hasSuccessfulDelivery(
    customerId: string,
    forDate: string,
  ): Promise<boolean> {
    const { data, error } = await this.client
      .from("morning_routine_delivery_audits")
      .select("id")
      .eq("customer_id", customerId)
      .eq("for_date", forDate)
      .in("outcome", ["queued_in_app", "queued_email"])
      .limit(1);
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  }

  async recordDeliveryAudit(args: {
    readonly retailerId: string;
    readonly customerId: string;
    readonly forDate: string;
    readonly outcome: MorningRoutineDeliveryOutcome;
    readonly scheduledFor: string;
    readonly selectionId?: string;
    readonly suppressionReason?: MorningRoutineSuppressionReason;
    readonly notificationId?: string;
  }): Promise<MorningRoutineDeliveryAuditId> {
    const { data, error } = await this.client.rpc(
      "record_morning_routine_delivery_audit",
      {
        p_retailer_id: args.retailerId,
        p_customer_id: args.customerId,
        p_for_date: args.forDate,
        p_outcome: args.outcome,
        p_scheduled_for: args.scheduledFor,
        ...(args.selectionId ? { p_selection_id: args.selectionId } : {}),
        ...(args.suppressionReason
          ? { p_suppression_reason: args.suppressionReason }
          : {}),
        ...(args.notificationId
          ? { p_notification_id: args.notificationId }
          : {}),
      },
    );
    if (error) throw error;
    return asId<"MorningRoutineDeliveryAuditId">(data);
  }

  async enqueueDeliveryNotification(args: {
    readonly retailerId: string;
    readonly customerId: string;
    readonly title: string;
    readonly body: string;
    readonly channel: MorningRoutineDeliveryChannel;
    readonly actionHref?: string;
  }): Promise<string> {
    const { data, error } = await this.client.rpc(
      "enqueue_morning_routine_delivery_notification",
      {
        p_retailer_id: args.retailerId,
        p_customer_id: args.customerId,
        p_title: args.title,
        p_body: args.body,
        p_channel: args.channel,
        ...(args.actionHref ? { p_action_href: args.actionHref } : {}),
      },
    );
    if (error) throw error;
    return data;
  }

  async listDeliveryAuditsForCustomer(
    customerId: string,
    limit = 20,
  ): Promise<MorningRoutineDeliveryAudit[]> {
    const { data, error } = await this.client
      .from("morning_routine_delivery_audits")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data.map(toAudit);
  }

  async listEligibleProducts(
    retailerId: string,
  ): Promise<MorningRoutineEligibleProduct[]> {
    const { data, error } = await this.client
      .from("morning_routine_eligible_products")
      .select("*")
      .eq("retailer_id", retailerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toEligible);
  }

  async listActiveEligibleProductIds(retailerId: string): Promise<Set<string>> {
    const { data, error } = await this.client
      .from("morning_routine_eligible_products")
      .select("product_id")
      .eq("retailer_id", retailerId)
      .eq("active", true);
    if (error) throw error;
    return new Set(data.map((row) => row.product_id));
  }

  async setEligibleProduct(args: {
    readonly retailerId: string;
    readonly productId: string;
    readonly active: boolean;
    readonly staffId?: string;
  }): Promise<void> {
    const { error } = await this.client
      .from("morning_routine_eligible_products")
      .upsert(
        {
          retailer_id: args.retailerId,
          product_id: args.productId,
          active: args.active,
          ...(args.staffId ? { created_by_staff_id: args.staffId } : {}),
        },
        { onConflict: "retailer_id,product_id" },
      );
    if (error) throw error;
  }

  async getRetailerSettings(
    retailerId: string,
  ): Promise<MorningRoutineRetailerDeliverySettings | null> {
    const { data, error } = await this.client
      .from("morning_routine_retailer_settings")
      .select("*")
      .eq("retailer_id", retailerId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      retailerId: asId<"RetailerId">(data.retailer_id),
      paused: data.paused,
      updatedAt: data.updated_at,
    };
  }

  async setRetailerPaused(retailerId: string, paused: boolean): Promise<void> {
    const { error } = await this.client
      .from("morning_routine_retailer_settings")
      .upsert(
        { retailer_id: retailerId, paused },
        { onConflict: "retailer_id" },
      );
    if (error) throw error;
  }
}
