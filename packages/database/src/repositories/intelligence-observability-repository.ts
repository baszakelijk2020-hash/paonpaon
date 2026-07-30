/**
 * Aggregate intelligence observability (CLI-009 / PHASE 7.8).
 * Counts and versions only — no customer content browsing.
 */

import {
  projectIntelligenceHealth,
  type IntelligenceHealthSnapshot,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";

export class IntelligenceObservabilityRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async projectPlatformHealth(args?: {
    readonly now?: string;
  }): Promise<IntelligenceHealthSnapshot> {
    const now = args?.now ?? new Date().toISOString();
    const since24h = new Date(
      Date.parse(now) - 24 * 60 * 60 * 1000,
    ).toISOString();
    const since7d = new Date(
      Date.parse(now) - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const [
      eventsResult,
      correctionsResult,
      opportunitiesResult,
      incorrectResult,
      projectorResult,
      lagResult,
    ] = await Promise.all([
      this.client
        .from("behavioral_events")
        .select("id", { count: "exact", head: true })
        .gte("occurred_at", since24h),
      this.client
        .from("customer_fact_corrections")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since7d),
      this.client
        .from("clienteling_opportunities")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since7d)
        .is("deleted_at", null),
      this.client
        .from("clienteling_opportunities")
        .select("id", { count: "exact", head: true })
        .eq("status", "incorrect")
        .gte("updated_at", since7d)
        .is("deleted_at", null),
      this.client
        .from("clienteling_opportunities")
        .select("projector_version")
        .gte("created_at", since7d)
        .is("deleted_at", null)
        .limit(500),
      this.client
        .from("behavioral_events")
        .select("occurred_at, received_at")
        .gte("occurred_at", since24h)
        .not("received_at", "is", null)
        .order("received_at", { ascending: false })
        .limit(200),
    ]);

    if (eventsResult.error) throw eventsResult.error;
    if (correctionsResult.error) throw correctionsResult.error;
    if (opportunitiesResult.error) throw opportunitiesResult.error;
    if (incorrectResult.error) throw incorrectResult.error;
    if (projectorResult.error) throw projectorResult.error;
    if (lagResult.error) throw lagResult.error;

    const versionCounts = new Map<string, number>();
    for (const row of projectorResult.data ?? []) {
      const version = row.projector_version ?? "unknown";
      versionCounts.set(version, (versionCounts.get(version) ?? 0) + 1);
    }

    const lags = (lagResult.data ?? [])
      .map((row) => {
        if (!row.received_at) return null;
        return (
          (Date.parse(row.received_at) - Date.parse(row.occurred_at)) / 1000
        );
      })
      .filter((value): value is number => value !== null && value >= 0)
      .sort((a, b) => a - b);

    const p95Index = lags.length > 0 ? Math.floor(lags.length * 0.95) : -1;
    const ingestionLagSecondsP95 =
      p95Index >= 0 ? (lags[p95Index] ?? null) : null;

    return projectIntelligenceHealth({
      generatedAt: now,
      eventCount24h: eventsResult.count ?? 0,
      ingestionLagSecondsP95,
      correctionCount7d: correctionsResult.count ?? 0,
      opportunityCount7d: opportunitiesResult.count ?? 0,
      incorrectOpportunityCount7d: incorrectResult.count ?? 0,
      suppressedInsightCount7d: 0,
      projectorVersionCounts: [...versionCounts.entries()].map(
        ([version, count]) => ({ version, count }),
      ),
    });
  }
}
