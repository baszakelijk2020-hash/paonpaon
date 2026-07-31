/**
 * Honeymoon Phase programme repository (PHASE 10.2 / CMP-106).
 */

import {
  asId,
  deriveHoneymoonActions,
  type HoneymoonAction,
  type HoneymoonLineTruth,
  type OrderStatus,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type ProgrammeRow = Database["public"]["Tables"]["honeymoon_programmes"]["Row"];
type ActionRow =
  Database["public"]["Tables"]["honeymoon_programme_actions"]["Row"];

export interface HoneymoonProgrammeRecord {
  readonly id: string;
  readonly retailerId: RetailerId;
  readonly customerId: string;
  readonly orderId: string;
  readonly status: string;
  readonly actions: readonly HoneymoonAction[];
}

function toAction(row: ActionRow): HoneymoonAction {
  return {
    kind: row.kind as HoneymoonAction["kind"],
    title: row.title,
    dueHint: row.due_hint,
    suppressed: row.suppressed,
    requiresPaymentApproval: false,
    ...(row.suppression_reason
      ? { suppressionReason: row.suppression_reason }
      : {}),
  };
}

export class HoneymoonProgrammeRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findByOrder(
    retailerId: RetailerId,
    orderId: string,
  ): Promise<HoneymoonProgrammeRecord | null> {
    const { data, error } = await this.client
      .from("honeymoon_programmes")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("order_id", orderId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const { data: actions, error: actionsError } = await this.client
      .from("honeymoon_programme_actions")
      .select("*")
      .eq("programme_id", data.id)
      .eq("retailer_id", retailerId)
      .order("kind", { ascending: true });
    if (actionsError) throw actionsError;

    return {
      id: data.id,
      retailerId: asId<"RetailerId">(data.retailer_id),
      customerId: data.customer_id,
      orderId: data.order_id,
      status: data.status,
      actions: actions.map(toAction),
    };
  }

  async ensureForOrder(args: {
    readonly retailerId: RetailerId;
    readonly customerId: string;
    readonly orderId: string;
    readonly orderStatus: OrderStatus;
    readonly lines: readonly HoneymoonLineTruth[];
    readonly contactPressureActive: boolean;
    readonly libraryVersionId?: string;
  }): Promise<HoneymoonProgrammeRecord> {
    const existing = await this.findByOrder(args.retailerId, args.orderId);
    const derived = deriveHoneymoonActions({
      orderStatus: args.orderStatus,
      lines: args.lines,
      contactPressureActive: args.contactPressureActive,
    });

    let programme: ProgrammeRow;
    if (existing) {
      const { data, error } = await this.client
        .from("honeymoon_programmes")
        .update({
          status: derived.every((action) => action.suppressed)
            ? "suppressed"
            : "active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .eq("retailer_id", args.retailerId)
        .select("*")
        .single();
      if (error) throw error;
      programme = data;

      for (const action of derived) {
        await this.client.from("honeymoon_programme_actions").upsert(
          {
            programme_id: programme.id,
            retailer_id: args.retailerId,
            kind: action.kind,
            title: action.title,
            due_hint: action.dueHint,
            suppressed: action.suppressed,
            suppression_reason: action.suppressionReason ?? null,
            requires_payment_approval: false,
          },
          { onConflict: "programme_id,kind" },
        );
      }
    } else {
      const { data, error } = await this.client
        .from("honeymoon_programmes")
        .insert({
          retailer_id: args.retailerId,
          customer_id: args.customerId,
          order_id: args.orderId,
          status: "active",
          ...(args.libraryVersionId
            ? { library_version_id: args.libraryVersionId }
            : {}),
        })
        .select("*")
        .single();
      if (error) throw error;
      programme = data;

      const { error: actionsError } = await this.client
        .from("honeymoon_programme_actions")
        .insert(
          derived.map((action) => ({
            programme_id: programme.id,
            retailer_id: args.retailerId,
            kind: action.kind,
            title: action.title,
            due_hint: action.dueHint,
            suppressed: action.suppressed,
            suppression_reason: action.suppressionReason ?? null,
            requires_payment_approval: false,
          })),
        );
      if (actionsError) throw actionsError;
    }

    const refreshed = await this.findByOrder(args.retailerId, args.orderId);
    if (!refreshed) throw new Error("Honeymoon programme missing after ensure");
    return refreshed;
  }
}
