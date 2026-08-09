/**
 * The real AI sales-roleplay conversation partner (PHASE 17.8 / ADV-108).
 * Layers on top of `AcademyRepository`'s existing grading loop rather than
 * a second one — `academy_roleplay_grades.roleplay_session_id` links a
 * grade to the real transcript it was reviewed from.
 *
 * Every write goes through the three RPCs added by migration
 * `20260809190000`, which re-derive caller identity, session ownership and
 * turn ordering server-side, same "client cannot bypass the Server Action"
 * defense-in-depth posture as `enqueue_wardrobe_visualization_job` and
 * `reserve_virtual_try_on_generation`.
 */

import type { AcademyRoleplayPersona, RetailerId } from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type SessionRow =
  Database["public"]["Tables"]["academy_roleplay_sessions"]["Row"];
type MessageRow =
  Database["public"]["Tables"]["academy_roleplay_messages"]["Row"];

export type AcademyRoleplaySessionStatus = "active" | "completed" | "abandoned";

export interface AcademyRoleplaySession {
  readonly id: string;
  readonly retailerId: RetailerId;
  readonly staffId: string;
  readonly personaKey: AcademyRoleplayPersona;
  readonly status: AcademyRoleplaySessionStatus;
  readonly turnCount: number;
  readonly startedAt: string;
  readonly endedAt: string | null;
}

export interface AcademyRoleplayMessage {
  readonly id: string;
  readonly sessionId: string;
  readonly turnIndex: number;
  readonly speaker: "advisor" | "persona";
  readonly content: string;
  readonly createdAt: string;
}

function toSession(row: SessionRow): AcademyRoleplaySession {
  return {
    id: row.id,
    retailerId: row.retailer_id as RetailerId,
    staffId: row.staff_id,
    personaKey: row.persona_key as AcademyRoleplayPersona,
    status: row.status as AcademyRoleplaySessionStatus,
    turnCount: row.turn_count,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  };
}

function toMessage(row: MessageRow): AcademyRoleplayMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    turnIndex: row.turn_index,
    speaker: row.speaker as "advisor" | "persona",
    content: row.content,
    createdAt: row.created_at,
  };
}

export class AcademyRoleplayRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  /** Starts a new session, or resumes the caller's existing active one for
   * this retailer — the RPC itself enforces one active session per staff
   * member, not this method. */
  async startSession(args: {
    readonly retailerId: RetailerId;
    readonly personaKey: AcademyRoleplayPersona;
  }): Promise<AcademyRoleplaySession> {
    const { data, error } = await this.client.rpc(
      "start_academy_roleplay_session",
      {
        p_retailer_id: args.retailerId,
        p_persona_key: args.personaKey,
      },
    );
    if (error) throw error;
    return toSession(data);
  }

  /** Appends the advisor's real line and the AI's real reply together,
   * atomically, in order. Callers must already have a real reply from the
   * provider (`runAcademyRoleplayTurn`) before calling this — it never
   * calls a provider itself. */
  async submitTurn(args: {
    readonly sessionId: string;
    readonly advisorText: string;
    readonly personaText: string;
  }): Promise<readonly AcademyRoleplayMessage[]> {
    const { data, error } = await this.client.rpc(
      "submit_academy_roleplay_turn",
      {
        p_session_id: args.sessionId,
        p_advisor_text: args.advisorText,
        p_persona_text: args.personaText,
      },
    );
    if (error) throw error;
    return (data ?? []).map(toMessage);
  }

  async endSession(args: {
    readonly sessionId: string;
    readonly status: "completed" | "abandoned";
  }): Promise<AcademyRoleplaySession> {
    const { data, error } = await this.client.rpc(
      "end_academy_roleplay_session",
      {
        p_session_id: args.sessionId,
        p_status: args.status,
      },
    );
    if (error) throw error;
    return toSession(data);
  }

  async findSessionById(
    sessionId: string,
  ): Promise<AcademyRoleplaySession | null> {
    const { data, error } = await this.client
      .from("academy_roleplay_sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();
    if (error) throw error;
    return data ? toSession(data) : null;
  }

  /** The calling staff member's current active session, if one exists —
   * the schema itself guarantees at most one. */
  async findActiveSessionForStaff(
    staffId: string,
  ): Promise<AcademyRoleplaySession | null> {
    const { data, error } = await this.client
      .from("academy_roleplay_sessions")
      .select("*")
      .eq("staff_id", staffId)
      .eq("status", "active")
      .maybeSingle();
    if (error) throw error;
    return data ? toSession(data) : null;
  }

  async findMessagesBySession(
    sessionId: string,
  ): Promise<readonly AcademyRoleplayMessage[]> {
    const { data, error } = await this.client
      .from("academy_roleplay_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("turn_index", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(toMessage);
  }

  /** Completed sessions for a staff member, most recent first — the pool a
   * grading form can attach a real transcript from. */
  async findCompletedSessionsForStaff(args: {
    readonly retailerId: RetailerId;
    readonly staffId: string;
  }): Promise<readonly AcademyRoleplaySession[]> {
    const { data, error } = await this.client
      .from("academy_roleplay_sessions")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .eq("staff_id", args.staffId)
      .eq("status", "completed")
      .order("started_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toSession);
  }

  /** Every completed session across the retailer, most recent first — the
   * pool a manager's grading form picks a real transcript from. Staff
   * match against the graded staff member is validated by the caller
   * (`AcademyRepository.recordRoleplayGrade`), not here. */
  async findCompletedSessionsForRetailer(
    retailerId: RetailerId,
  ): Promise<readonly AcademyRoleplaySession[]> {
    const { data, error } = await this.client
      .from("academy_roleplay_sessions")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("status", "completed")
      .order("started_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toSession);
  }
}
