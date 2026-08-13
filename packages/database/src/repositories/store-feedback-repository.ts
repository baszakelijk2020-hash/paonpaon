import {
  checkStoreFeedbackContext,
  type RetailerId,
  type StoreFeedbackAudience,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type SignalRow = Database["public"]["Tables"]["store_feedback_signals"]["Row"];

export interface StoreFeedbackSignal {
  readonly id: string;
  readonly retailerId: RetailerId;
  readonly customerId: string | null;
  readonly garmentRef: string | null;
  readonly audience: StoreFeedbackAudience;
  readonly feedback: string;
  readonly status: "open" | "acknowledged" | "corrected";
  readonly correctsSignalId: string | null;
  readonly acknowledgedAt: string | null;
  readonly followUpNote: string | null;
  readonly createdAt: string;
}

function toDomain(row: SignalRow): StoreFeedbackSignal {
  return {
    id: row.id,
    retailerId: row.retailer_id as RetailerId,
    customerId: row.customer_id,
    garmentRef: row.garment_ref,
    audience: row.audience as StoreFeedbackAudience,
    feedback: row.feedback,
    status: row.status as StoreFeedbackSignal["status"],
    correctsSignalId: row.corrects_signal_id,
    acknowledgedAt: row.acknowledged_at,
    followUpNote: row.follow_up_note,
    createdAt: row.created_at,
  };
}

export class StoreFeedbackRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async capture(args: {
    readonly customerId?: string;
    readonly garmentRef?: string;
    readonly audience: StoreFeedbackAudience;
    readonly feedback: string;
    readonly idempotencyKey: string;
    readonly personalizationConsent?: "granted" | "denied" | "withdrawn";
  }): Promise<StoreFeedbackSignal> {
    // The authoritative consent check is in the SECURITY DEFINER RPC so a
    // Server Action never has to trust a browser-supplied consent value. A
    // caller that already has a consent snapshot still gets the domain's
    // fail-closed guard before the round trip.
    if (!args.customerId && !args.garmentRef?.trim()) {
      throw new Error("context_required");
    }
    if (args.personalizationConsent) {
      const check = checkStoreFeedbackContext(args);
      if (!check.ok) throw new Error(check.reason);
    }
    const { data, error } = await this.client.rpc(
      "capture_store_feedback_signal",
      {
        ...(args.customerId ? { p_customer_id: args.customerId } : {}),
        ...(args.garmentRef ? { p_garment_ref: args.garmentRef } : {}),
        p_audience: args.audience,
        p_feedback: args.feedback,
        p_idempotency_key: args.idempotencyKey,
      },
    );
    if (error) throw error;
    return toDomain(data as SignalRow);
  }

  async listOpen(
    retailerId: RetailerId,
  ): Promise<readonly StoreFeedbackSignal[]> {
    const { data, error } = await this.client
      .from("store_feedback_signals")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("status", "open")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toDomain);
  }

  async acknowledge(args: {
    readonly signalId: string;
    readonly followUpNote: string;
  }): Promise<StoreFeedbackSignal> {
    const { data, error } = await this.client.rpc(
      "acknowledge_store_feedback_signal",
      {
        p_signal_id: args.signalId,
        p_follow_up_note: args.followUpNote,
      },
    );
    if (error) throw error;
    return toDomain(data as SignalRow);
  }
}
