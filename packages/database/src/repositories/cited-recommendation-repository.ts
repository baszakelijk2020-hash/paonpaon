/**
 * Advanced cited intelligence (PHASE 14.2). Thin persistence plus one real
 * projector — `computeTemporalHotspot` — over the pure checks in
 * `@paon/domain`'s `intelligence/cited-recommendation.ts`.
 */

import {
  buildRecommendation,
  findBusiestSlot,
  planRecompute,
  type CitedRecommendation,
  type RecommendationBuild,
  type RecommendationKind,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

import { AppointmentRepository } from "./appointment-repository";

type RecommendationRow =
  Database["public"]["Tables"]["cited_recommendations"]["Row"];

const TEMPORAL_HOTSPOT_PROJECTOR_VERSION = "temporal-hotspot-v1";
const HOTSPOT_WINDOW_DAYS = 90;

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

function hourLabel(hour: number): string {
  const period = hour < 12 ? "am" : "pm";
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelveHour}${period}`;
}

export class CitedRecommendationRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async listLive(args: {
    readonly retailerId: RetailerId;
    readonly kind?: RecommendationKind;
  }): Promise<readonly RecommendationRow[]> {
    let query = this.client
      .from("cited_recommendations")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .is("withdrawn_at", null);
    if (args.kind) query = query.eq("kind", args.kind);
    const { data, error } = await query.order("created_at", {
      ascending: false,
    });
    if (error) throw error;
    return data ?? [];
  }

  /**
   * Withdraws every live recommendation of one kind. Used before storing a
   * fresh recompute of that same kind: a recommendation is withdrawn, not
   * edited, so superseding it on recompute means explicitly retiring the
   * old row rather than leaving it live alongside the new one — otherwise
   * a dashboard button a manager presses repeatedly would silently pile up
   * duplicate findings forever.
   */
  private async withdrawLiveOfKind(
    retailerId: RetailerId,
    kind: RecommendationKind,
    reason: string,
  ): Promise<void> {
    const { error } = await this.client
      .from("cited_recommendations")
      .update({
        withdrawn_at: new Date().toISOString(),
        withdrawn_reason: reason,
      })
      .eq("retailer_id", retailerId)
      .eq("kind", kind)
      .is("withdrawn_at", null);
    if (error) throw error;
  }

  private async store(
    retailerId: RetailerId,
    result: RecommendationBuild,
  ): Promise<
    | { readonly ok: true; readonly id: string }
    | Exclude<RecommendationBuild, { ok: true }>
  > {
    if (!result.ok) return result;
    const rec = result.recommendation;
    const { data, error } = await this.client
      .from("cited_recommendations")
      .insert({
        retailer_id: retailerId,
        kind: rec.kind,
        statement: rec.statement,
        sources: rec.sources as unknown as Json,
        window_from: rec.window.from,
        window_to: rec.window.to,
        sample_size: rec.sampleSize,
        confidence: rec.confidence,
        derived_from_fact_ids: [...rec.derivedFromFactIds],
      })
      .select("id")
      .single();
    if (error) throw error;
    return { ok: true, id: data.id };
  }

  /**
   * The `temporal_hotspot` projector. Reads real appointments (excluding
   * cancellations and no-shows — a slot nobody actually kept is not a
   * hotspot), finds the busiest day/hour bucket, and stores a fully cited
   * recommendation naming exactly how many appointments it saw and how
   * many of them fed this specific finding. Withdraws any prior live
   * `temporal_hotspot` recommendation first, so repeated recomputes
   * supersede rather than pile up duplicate findings.
   */
  async computeTemporalHotspot(args: {
    readonly retailerId: RetailerId;
    readonly asOf?: string;
    readonly windowDays?: number;
  }): Promise<
    | { readonly ok: true; readonly id: string }
    | Exclude<RecommendationBuild, { readonly ok: true }>
    | { readonly ok: false; readonly reason: "no_appointments_in_window" }
  > {
    const asOf = args.asOf ?? new Date().toISOString();
    const windowDays = args.windowDays ?? HOTSPOT_WINDOW_DAYS;
    const to = new Date(asOf);
    const from = new Date(to.getTime() - windowDays * 86_400_000);

    const all = await new AppointmentRepository(this.client).findByRetailer(
      args.retailerId,
    );
    const inWindow = all.filter((appointment) => {
      if (
        appointment.status === "canceled" ||
        appointment.status === "no_show"
      ) {
        return false;
      }
      const startsAt = Date.parse(appointment.startsAt);
      return startsAt >= from.getTime() && startsAt <= to.getTime();
    });
    if (inWindow.length === 0) {
      await this.withdrawLiveOfKind(
        args.retailerId,
        "temporal_hotspot",
        "Recomputed with no appointments in the window.",
      );
      return { ok: false, reason: "no_appointments_in_window" };
    }

    const busiest = findBusiestSlot(
      inWindow.map((appointment) => appointment.startsAt),
    );
    if (!busiest) return { ok: false, reason: "no_appointments_in_window" };

    const inBucket = inWindow.filter((appointment) => {
      const date = new Date(appointment.startsAt);
      return (
        date.getUTCDay() === busiest.dayOfWeek &&
        date.getUTCHours() === busiest.hour
      );
    });

    const statement = `${DAY_NAMES[busiest.dayOfWeek]}s around ${hourLabel(busiest.hour)} (UTC) carry ${busiest.count} of the last ${windowDays} days' ${inWindow.length} appointments — your busiest single slot.`;

    const result = buildRecommendation({
      kind: "temporal_hotspot",
      statement,
      sources: [
        {
          sourceRef: "appointments",
          projectorVersion: TEMPORAL_HOTSPOT_PROJECTOR_VERSION,
          observedRows: inWindow.length,
        },
      ],
      window: { from: from.toISOString(), to: to.toISOString() },
      sampleSize: busiest.count,
      derivedFromFactIds: inBucket.map((appointment) => appointment.id),
    });
    await this.withdrawLiveOfKind(
      args.retailerId,
      "temporal_hotspot",
      "Superseded by a newer computation.",
    );
    return this.store(args.retailerId, result);
  }

  /**
   * Withdraws every live recommendation whose citations include a
   * corrected or deleted fact. Never edits a recommendation in place —
   * restating a past claim would hide that it was ever made — so a
   * genuinely still-true finding is recomputed as a fresh row instead.
   */
  async withdrawStale(args: {
    readonly retailerId: RetailerId;
    readonly correctedFactIds: readonly string[];
    readonly reason: string;
  }): Promise<{ readonly withdrawnCount: number }> {
    const live = await this.listLive({ retailerId: args.retailerId });
    const plan = planRecompute({
      correctedFactIds: [...args.correctedFactIds],
      recommendations: live.map((row) => ({
        kind: row.kind as RecommendationKind,
        derivedFromFactIds: row.derived_from_fact_ids,
      })),
    });
    if (plan.noOp) return { withdrawnCount: 0 };

    const toWithdraw = live.filter((row) =>
      row.derived_from_fact_ids.some((id) =>
        args.correctedFactIds.includes(id),
      ),
    );
    for (const row of toWithdraw) {
      const { error } = await this.client
        .from("cited_recommendations")
        .update({
          withdrawn_at: new Date().toISOString(),
          withdrawn_reason: args.reason.trim(),
        })
        .eq("id", row.id)
        .eq("retailer_id", args.retailerId)
        .is("withdrawn_at", null);
      if (error) throw error;
    }
    return { withdrawnCount: toWithdraw.length };
  }
}

export type { CitedRecommendation };
