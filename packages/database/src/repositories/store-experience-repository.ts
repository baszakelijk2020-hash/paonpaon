/**
 * Instrumented physical-store sessions (PHASE 16.4). Thin persistence over
 * `@paon/domain`'s `checkSessionOutcome` and `checkComparison` — scoped to
 * the manual-fallback path: opening a session, recording guided
 * construction comparisons, and closing it to a customer-approved look.
 * No zone/observation-adapter wiring here; that half is genuinely
 * hardware-dependent and stays `blocked_external`, unlike this one.
 */

import {
  checkComparison,
  checkSessionOutcome,
  type ComparisonCheck,
  type RetailerId,
  type SessionLinkCheck,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type SessionRow = Database["public"]["Tables"]["store_sessions"]["Row"];
type ComparisonRow =
  Database["public"]["Tables"]["store_comparison_records"]["Row"];

export interface StoreSession {
  readonly id: string;
  readonly retailerId: RetailerId;
  readonly customerId: string | null;
  readonly advisorStaffId: string | null;
  readonly customerApprovedLookRef: string | null;
  readonly deviceFailed: boolean;
  readonly manualFallbackUsed: boolean;
  readonly outcomeNote: string | null;
  readonly closedAt: string | null;
  readonly createdAt: string;
}

export interface ComparisonEntry {
  readonly id: string;
  readonly sessionId: string;
  readonly constructionKind: "half_canvas" | "full_canvas" | "handmade";
  readonly customerPreferred: boolean;
  readonly notedReason: string | null;
}

function sessionToDomain(row: SessionRow): StoreSession {
  return {
    id: row.id,
    retailerId: row.retailer_id as RetailerId,
    customerId: row.customer_id,
    advisorStaffId: row.advisor_staff_id,
    customerApprovedLookRef: row.customer_approved_look_ref,
    deviceFailed: row.device_failed,
    manualFallbackUsed: row.manual_fallback_used,
    outcomeNote: row.outcome_note,
    closedAt: row.closed_at,
    createdAt: row.created_at,
  };
}

function comparisonToDomain(row: ComparisonRow): ComparisonEntry {
  return {
    id: row.id,
    sessionId: row.session_id,
    constructionKind:
      row.construction_kind as ComparisonEntry["constructionKind"],
    customerPreferred: row.customer_preferred,
    notedReason: row.noted_reason,
  };
}

export class StoreExperienceRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async openSession(args: {
    readonly retailerId: RetailerId;
    readonly customerId?: string;
    readonly advisorStaffId: string;
    readonly appointmentId?: string;
  }): Promise<StoreSession> {
    const { data, error } = await this.client
      .from("store_sessions")
      .insert({
        retailer_id: args.retailerId,
        advisor_staff_id: args.advisorStaffId,
        ...(args.customerId ? { customer_id: args.customerId } : {}),
        ...(args.appointmentId ? { appointment_id: args.appointmentId } : {}),
      })
      .select("*")
      .single();
    if (error) throw error;
    return sessionToDomain(data);
  }

  async listSessions(retailerId: RetailerId): Promise<readonly StoreSession[]> {
    const { data, error } = await this.client
      .from("store_sessions")
      .select("*")
      .eq("retailer_id", retailerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(sessionToDomain);
  }

  /**
   * One garment tried in a guided comparison. `customerPreferred` entries
   * must name why — "chose full canvas" is a sale, "chose full canvas
   * because the chest felt softer" is something the next advisor can use.
   */
  async recordComparisonEntry(args: {
    readonly retailerId: RetailerId;
    readonly sessionId: string;
    readonly constructionKind: ComparisonEntry["constructionKind"];
    readonly customerPreferred: boolean;
    readonly notedReason?: string;
  }): Promise<
    { readonly ok: true; readonly entry: ComparisonEntry } | ComparisonCheck
  > {
    if (args.customerPreferred) {
      const check = checkComparison({
        records: [
          {
            constructionKind: args.constructionKind,
            customerPreferred: true,
            notedReason: args.notedReason ?? "",
          },
        ],
      });
      if (!check.ok) return check;
    }

    const { data, error } = await this.client
      .from("store_comparison_records")
      .insert({
        retailer_id: args.retailerId,
        session_id: args.sessionId,
        construction_kind: args.constructionKind,
        customer_preferred: args.customerPreferred,
        ...(args.notedReason?.trim()
          ? { noted_reason: args.notedReason.trim() }
          : {}),
      })
      .select("*")
      .single();
    if (error) throw error;
    return { ok: true, entry: comparisonToDomain(data) };
  }

  async listComparisonEntries(args: {
    readonly retailerId: RetailerId;
    readonly sessionId: string;
  }): Promise<readonly ComparisonEntry[]> {
    const { data, error } = await this.client
      .from("store_comparison_records")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .eq("session_id", args.sessionId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(comparisonToDomain);
  }

  /**
   * Closes a session to a customer-approved look. A device failure with no
   * manual fallback is refused — the acceptance criterion is that a paper
   * session is as valid as a mirror session, never that a failure is
   * silently dropped.
   */
  async closeSession(args: {
    readonly retailerId: RetailerId;
    readonly sessionId: string;
    readonly customerApprovedLookRef: string;
    readonly advisorStaffId: string;
    readonly deviceFailed: boolean;
    readonly manualFallbackUsed: boolean;
    readonly outcomeNote?: string;
  }): Promise<
    { readonly ok: true; readonly session: StoreSession } | SessionLinkCheck
  > {
    const check = checkSessionOutcome({
      customerApprovedLookRef: args.customerApprovedLookRef,
      advisorStaffId: args.advisorStaffId,
      deviceFailed: args.deviceFailed,
      manualFallbackUsed: args.manualFallbackUsed,
    });
    if (!check.ok) return check;

    const { data, error } = await this.client
      .from("store_sessions")
      .update({
        customer_approved_look_ref: args.customerApprovedLookRef,
        device_failed: args.deviceFailed,
        manual_fallback_used: args.manualFallbackUsed,
        ...(args.outcomeNote?.trim()
          ? { outcome_note: args.outcomeNote.trim() }
          : {}),
        closed_at: new Date().toISOString(),
      })
      .eq("id", args.sessionId)
      .eq("retailer_id", args.retailerId)
      .select("*")
      .single();
    if (error) throw error;
    return { ok: true, session: sessionToDomain(data) };
  }
}
