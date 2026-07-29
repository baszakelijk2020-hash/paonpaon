/**
 * MorningRoutine delivery subscriptions and audit (PHASE 4.5 / MR-002).
 */

import {
  asId,
  type CustomerId,
  type MorningRoutineDeliveryChannel,
  type MorningRoutineDeliveryFrequency,
  type MorningRoutineDeliveryPayload,
  type MorningRoutineDeliveryStatus,
  type MorningRoutineRetailerDeliverySettings,
  type MorningRoutineSubscription,
  type MorningRoutineSuppressionReason,
  type RetailerId,
  type UpsertMorningRoutineSubscriptionInput,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

type SubscriptionRow =
  Database["public"]["Tables"]["morning_routine_subscriptions"]["Row"];
type DeliveryRow =
  Database["public"]["Tables"]["morning_routine_deliveries"]["Row"];
type RetailerSettingsRow =
  Database["public"]["Tables"]["morning_routine_retailer_settings"]["Row"];

function asJson(value: unknown): Json {
  return value as Json;
}

function toSubscription(row: SubscriptionRow): MorningRoutineSubscription & {
  id: string;
  unsubscribeToken: string;
} {
  return {
    id: row.id,
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    deliveryOptIn: row.delivery_opt_in,
    frequency: row.frequency as MorningRoutineDeliveryFrequency,
    channels: row.channels as MorningRoutineDeliveryChannel[],
    timezone: row.timezone,
    deliveryHourLocal: row.delivery_hour_local,
    quietStartHour: row.quiet_start_hour,
    quietEndHour: row.quiet_end_hour,
    weeklyAnchorDow: row.weekly_anchor_dow,
    unsubscribeToken: row.unsubscribe_token,
    ...(row.unsubscribed_at ? { unsubscribedAt: row.unsubscribed_at } : {}),
  };
}

function toRetailerSettings(
  retailerId: string,
  row: RetailerSettingsRow | null,
): MorningRoutineRetailerDeliverySettings {
  return {
    retailerId: asId<"RetailerId">(retailerId),
    enabled: row?.enabled ?? true,
    deliveryHourLocal: row?.delivery_hour_local ?? 7,
    eligibleProductIds: row?.eligible_product_ids ?? [],
  };
}

export interface MorningRoutineDeliveryRecord {
  readonly id: string;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly selectionId?: string;
  readonly forDate: string;
  readonly channel: MorningRoutineDeliveryChannel;
  readonly status: MorningRoutineDeliveryStatus;
  readonly suppressedReason?: MorningRoutineSuppressionReason;
  readonly payload: MorningRoutineDeliveryPayload | Record<string, never>;
  readonly scheduledFor: string;
  readonly sentAt?: string;
}

function toDelivery(row: DeliveryRow): MorningRoutineDeliveryRecord {
  return {
    id: row.id,
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    ...(row.selection_id ? { selectionId: row.selection_id } : {}),
    forDate: row.for_date,
    channel: row.channel as MorningRoutineDeliveryChannel,
    status: row.status as MorningRoutineDeliveryStatus,
    ...(row.suppressed_reason
      ? {
          suppressedReason:
            row.suppressed_reason as MorningRoutineSuppressionReason,
        }
      : {}),
    payload: (row.payload ?? {}) as unknown as MorningRoutineDeliveryPayload,
    scheduledFor: row.scheduled_for,
    ...(row.sent_at ? { sentAt: row.sent_at } : {}),
  };
}

export class MorningRoutineDeliveryRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findSubscription(
    retailerId: RetailerId | string,
    customerId: CustomerId | string,
  ): Promise<
    (MorningRoutineSubscription & { unsubscribeToken: string }) | null
  > {
    const { data, error } = await this.client
      .from("morning_routine_subscriptions")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("customer_id", customerId)
      .maybeSingle();
    if (error) throw error;
    return data ? toSubscription(data) : null;
  }

  async upsertSubscription(
    input: UpsertMorningRoutineSubscriptionInput,
  ): Promise<string> {
    const { data, error } = await this.client.rpc(
      "upsert_morning_routine_subscription",
      {
        p_retailer_id: input.retailerId,
        p_customer_id: input.customerId,
        p_delivery_opt_in: input.deliveryOptIn,
        p_frequency: input.frequency,
        p_channels: input.channels,
        p_timezone: input.timezone,
        p_delivery_hour_local: input.deliveryHourLocal,
        p_quiet_start_hour: input.quietStartHour,
        p_quiet_end_hour: input.quietEndHour,
        p_weekly_anchor_dow: input.weeklyAnchorDow ?? 1,
      },
    );
    if (error) throw error;
    return String(data);
  }

  async unsubscribeByToken(token: string): Promise<string> {
    const { data, error } = await this.client.rpc(
      "unsubscribe_morning_routine_by_token",
      { p_token: token },
    );
    if (error) throw error;
    return String(data);
  }

  async listActiveSubscriptions(): Promise<
    (MorningRoutineSubscription & { unsubscribeToken: string; id: string })[]
  > {
    const { data, error } = await this.client
      .from("morning_routine_subscriptions")
      .select("*")
      .eq("delivery_opt_in", true)
      .is("unsubscribed_at", null);
    if (error) throw error;
    return data.map(toSubscription);
  }

  async listDeliveriesForCustomerDay(
    customerId: CustomerId | string,
    forDate: string,
  ): Promise<MorningRoutineDeliveryRecord[]> {
    const { data, error } = await this.client
      .from("morning_routine_deliveries")
      .select("*")
      .eq("customer_id", customerId)
      .eq("for_date", forDate);
    if (error) throw error;
    return data.map(toDelivery);
  }

  async findLastWeeklyDeliveryDate(
    customerId: CustomerId | string,
    retailerId: RetailerId | string,
  ): Promise<string | undefined> {
    const { data, error } = await this.client
      .from("morning_routine_deliveries")
      .select("for_date")
      .eq("customer_id", customerId)
      .eq("retailer_id", retailerId)
      .eq("status", "sent")
      .order("for_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data?.for_date;
  }

  async recordDelivery(args: {
    readonly retailerId: string;
    readonly customerId: string;
    readonly selectionId?: string;
    readonly forDate: string;
    readonly channel: MorningRoutineDeliveryChannel;
    readonly status: MorningRoutineDeliveryStatus;
    readonly payload: MorningRoutineDeliveryPayload | Record<string, never>;
    readonly suppressedReason?: MorningRoutineSuppressionReason;
    readonly notificationId?: string;
    readonly emailOutboxId?: string;
    readonly scheduledFor?: string;
  }): Promise<string> {
    const { data, error } = await this.client.rpc(
      "record_morning_routine_delivery",
      {
        p_retailer_id: args.retailerId,
        p_customer_id: args.customerId,
        p_selection_id: args.selectionId ?? null,
        p_for_date: args.forDate,
        p_channel: args.channel,
        p_status: args.status,
        p_payload: asJson(args.payload),
        p_suppressed_reason: args.suppressedReason ?? null,
        p_notification_id: args.notificationId ?? null,
        p_email_outbox_id: args.emailOutboxId ?? null,
        p_scheduled_for: args.scheduledFor ?? new Date().toISOString(),
      },
    );
    if (error) throw error;
    return String(data);
  }

  async createInAppNotification(args: {
    readonly retailerId: string;
    readonly customerId: string;
    readonly title: string;
    readonly body: string;
    readonly actionHref: string;
  }): Promise<string> {
    const { data, error } = await this.client.rpc(
      "create_morning_routine_in_app_notification",
      {
        p_retailer_id: args.retailerId,
        p_customer_id: args.customerId,
        p_title: args.title,
        p_body: args.body,
        p_action_href: args.actionHref,
      },
    );
    if (error) throw error;
    return String(data);
  }

  async enqueueEmail(args: {
    readonly recipientEmail: string;
    readonly subject: string;
    readonly htmlBody: string;
  }): Promise<string> {
    const { data, error } = await this.client.rpc(
      "enqueue_morning_routine_email",
      {
        p_recipient_email: args.recipientEmail,
        p_subject: args.subject,
        p_html_body: args.htmlBody,
      },
    );
    if (error) throw error;
    return String(data);
  }

  async getRetailerSettings(
    retailerId: RetailerId | string,
  ): Promise<MorningRoutineRetailerDeliverySettings> {
    const { data, error } = await this.client
      .from("morning_routine_retailer_settings")
      .select("*")
      .eq("retailer_id", retailerId)
      .maybeSingle();
    if (error) throw error;
    return toRetailerSettings(String(retailerId), data);
  }

  async upsertRetailerSettings(args: {
    readonly retailerId: string;
    readonly enabled: boolean;
    readonly deliveryHourLocal: number;
    readonly eligibleProductIds: readonly string[];
  }): Promise<string> {
    const { data, error } = await this.client.rpc(
      "upsert_morning_routine_retailer_settings",
      {
        p_retailer_id: args.retailerId,
        p_enabled: args.enabled,
        p_delivery_hour_local: args.deliveryHourLocal,
        p_eligible_product_ids: [...args.eligibleProductIds],
      },
    );
    if (error) throw error;
    return String(data);
  }
}
