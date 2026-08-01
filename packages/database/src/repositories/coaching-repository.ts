/**
 * Ceremony versions and the observation-to-coaching loop
 * (WFM-106 / PHASE 11.3).
 *
 * Publishing is append-only: `publishCeremony` never updates a published
 * row, it inserts the next version. Every observation stores the ceremony
 * version id it was made against, so "what was expected of them that day"
 * stays answerable after the ceremony changes.
 */

import {
  checkCeremonyPublish,
  checkCoachingTransition,
  checkObservation,
  selectCeremonyPrompts,
  summarizeCoachingLoop,
  type CeremonyContext,
  type CeremonyStep,
  type CeremonyVersion,
  type CoachingCheck,
  type CoachingLoopSummary,
  type CoachingState,
  type RetailerId,
  type RubricCriterionScore,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

type CeremonyRow =
  Database["public"]["Tables"]["service_ceremony_versions"]["Row"];
type ObservationRow =
  Database["public"]["Tables"]["staff_coaching_observations"]["Row"];

function toCeremony(
  row: CeremonyRow,
): CeremonyVersion & { readonly id: string } {
  return {
    id: row.id,
    ceremonyKey: row.ceremony_key,
    version: row.version,
    published: row.published,
    steps: (row.steps as unknown as CeremonyStep[]) ?? [],
  };
}

export class CoachingRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async latestPublishedCeremony(args: {
    readonly retailerId: RetailerId;
    readonly ceremonyKey: string;
  }): Promise<(CeremonyVersion & { readonly id: string }) | null> {
    const { data, error } = await this.client
      .from("service_ceremony_versions")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .eq("ceremony_key", args.ceremonyKey)
      .eq("published", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? toCeremony(data) : null;
  }

  /**
   * Publishes the next version of a ceremony. Refuses to reuse or lower a
   * version number, which would retroactively change what an existing
   * observation's citation means.
   */
  async publishCeremony(args: {
    readonly retailerId: RetailerId;
    readonly ceremonyKey: string;
    readonly steps: readonly CeremonyStep[];
  }): Promise<
    | { readonly ok: true; readonly id: string; readonly version: number }
    | Exclude<ReturnType<typeof checkCeremonyPublish>, { ok: true }>
  > {
    const latest = await this.latestPublishedCeremony(args);
    const nextVersion = (latest?.version ?? 0) + 1;

    const check = checkCeremonyPublish({
      candidate: {
        ceremonyKey: args.ceremonyKey,
        version: nextVersion,
        published: false,
        steps: args.steps,
      },
      ...(latest ? { latestPublishedVersion: latest.version } : {}),
    });
    if (!check.ok) return check;

    const { data, error } = await this.client
      .from("service_ceremony_versions")
      .insert({
        retailer_id: args.retailerId,
        ceremony_key: args.ceremonyKey,
        version: nextVersion,
        published: true,
        published_at: new Date().toISOString(),
        steps: args.steps as unknown as Json,
      })
      .select("id, version")
      .single();
    if (error) throw error;
    return { ok: true, id: data.id, version: data.version };
  }

  /** Contextual prompts for a live appointment, from the current version. */
  async promptsForContext(args: {
    readonly retailerId: RetailerId;
    readonly ceremonyKey: string;
    readonly context: CeremonyContext;
  }): Promise<readonly CeremonyStep[]> {
    const version = await this.latestPublishedCeremony(args);
    if (!version) return [];
    return selectCeremonyPrompts({ version, context: args.context });
  }

  async recordObservation(args: {
    readonly retailerId: RetailerId;
    readonly observedStaffId: string;
    readonly observerStaffId: string;
    readonly scores: readonly RubricCriterionScore[];
    readonly observedOn: string;
    readonly ceremonyVersionId?: string;
    readonly appointmentId?: string;
  }): Promise<{ readonly ok: true; readonly id: string } | CoachingCheck> {
    const check = checkObservation(args);
    if (!check.ok) return check;

    const { data, error } = await this.client
      .from("staff_coaching_observations")
      .insert({
        retailer_id: args.retailerId,
        observed_staff_id: args.observedStaffId,
        observer_staff_id: args.observerStaffId,
        observed_on: args.observedOn,
        state: "observed",
        scores: args.scores as unknown as Json,
        ...(args.ceremonyVersionId
          ? { ceremony_version_id: args.ceremonyVersionId }
          : {}),
        ...(args.appointmentId ? { appointment_id: args.appointmentId } : {}),
      })
      .select("id")
      .single();
    if (error) throw error;
    return { ok: true, id: data.id };
  }

  /**
   * Advances the loop one step. Re-reads current state first so two managers
   * with the same page open cannot both advance the same record, and applies
   * the same guard as a `.eq("state", …)` predicate on the write.
   */
  async advanceLoop(args: {
    readonly retailerId: RetailerId;
    readonly observationId: string;
    readonly next: CoachingState;
    readonly agreedAction?: string;
    readonly outcomeNote?: string;
  }): Promise<{ readonly ok: true } | CoachingCheck> {
    const { data: current, error } = await this.client
      .from("staff_coaching_observations")
      .select("state")
      .eq("id", args.observationId)
      .eq("retailer_id", args.retailerId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    if (!current) throw new Error("Observation not found");

    const check = checkCoachingTransition({
      current: current.state as CoachingState,
      next: args.next,
      ...(args.agreedAction ? { agreedAction: args.agreedAction } : {}),
      ...(args.outcomeNote ? { outcomeNote: args.outcomeNote } : {}),
    });
    if (!check.ok) return check;

    const { error: updateError } = await this.client
      .from("staff_coaching_observations")
      .update({
        state: args.next,
        ...(args.agreedAction
          ? { agreed_action: args.agreedAction.trim() }
          : {}),
        ...(args.outcomeNote ? { outcome_note: args.outcomeNote.trim() } : {}),
      })
      .eq("id", args.observationId)
      .eq("retailer_id", args.retailerId)
      .eq("state", current.state);
    if (updateError) throw updateError;
    return { ok: true };
  }

  async listObservations(args: {
    readonly retailerId: RetailerId;
    readonly limit?: number;
  }): Promise<readonly ObservationRow[]> {
    const { data, error } = await this.client
      .from("staff_coaching_observations")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .is("deleted_at", null)
      .order("observed_on", { ascending: false })
      .limit(args.limit ?? 100);
    if (error) throw error;
    return data ?? [];
  }

  /** Loop health, not a scoreboard — see the domain module's docblock. */
  async summarizeLoop(args: {
    readonly retailerId: RetailerId;
    readonly asOf: string;
  }): Promise<CoachingLoopSummary> {
    const rows = await this.listObservations({ retailerId: args.retailerId });
    return summarizeCoachingLoop({
      asOf: args.asOf,
      observations: rows.map((row) => ({
        observedStaffId: row.observed_staff_id,
        state: row.state as CoachingState,
        observedOn: `${row.observed_on}T00:00:00.000Z`,
      })),
    });
  }
}
