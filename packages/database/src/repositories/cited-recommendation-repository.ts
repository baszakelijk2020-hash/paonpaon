/**
 * Advanced cited intelligence (PHASE 14.2). Thin persistence plus one real
 * projector — `computeTemporalHotspot` — over the pure checks in
 * `@paon/domain`'s `intelligence/cited-recommendation.ts`.
 */

import {
  assessRenewalRisk,
  buildRecommendation,
  computeCorporateProgrammeMetrics,
  findBusiestSlot,
  findMostCommonLookGap,
  findMostFlaggedFitArea,
  findMostUnderstaffedDay,
  planRecompute,
  resolveGarmentCategoryFromConcepts,
  shouldCreateRenewalTask,
  type CitedRecommendation,
  type RecommendationBuild,
  type RecommendationKind,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

import { AppointmentRepository } from "./appointment-repository";
import { CorporateRepository } from "./corporate-repository";
import { CustomerRepository } from "./customer-repository";
import { MetadataRepository } from "./metadata-repository";
import { PhysicalGarmentRepository } from "./physical-garment-repository";
import { ProductRepository } from "./product-repository";
import { ProductVariantRepository } from "./product-variant-repository";
import { StaffRosterRepository } from "./staff-roster-repository";
import { WardrobeRepository } from "./wardrobe-repository";

type RecommendationRow =
  Database["public"]["Tables"]["cited_recommendations"]["Row"];

const TEMPORAL_HOTSPOT_PROJECTOR_VERSION = "temporal-hotspot-v1";
const HOTSPOT_WINDOW_DAYS = 90;
const COMPLETE_LOOK_PROJECTOR_VERSION = "complete-look-v1";
const MAX_CATALOGUE_PRODUCTS_SCANNED = 30;
const FIT_RISK_PROJECTOR_VERSION = "fit-risk-v1";
const FIT_RISK_WINDOW_DAYS = 90;
const STAFFING_RISK_PROJECTOR_VERSION = "staffing-risk-v1";
const STAFFING_RISK_WINDOW_DAYS = 90;

/** Postgres `time` column, "HH:MM:SS" — staff_shifts never crosses
 * midnight (its own check constraint enforces end_time > start_time),
 * so plain hour/minute arithmetic is exact. */
function timeStringToHours(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) + (minutes ?? 0) / 60;
}

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
   * The `complete_look` projector. For each customer of a retailer,
   * determines which garment categories they own zero active items in
   * but the retailer's catalogue carries. Collects all gaps across
   * customers and finds the most common missing category, then stores
   * a fully cited recommendation. Withdraws any prior live `complete_look`
   * recommendation first, so repeated recomputes supersede rather than
   * pile up duplicate findings.
   */
  async computeCompleteLook(args: {
    readonly retailerId: RetailerId;
    readonly asOf?: string;
  }): Promise<
    | { readonly ok: true; readonly id: string }
    | Exclude<RecommendationBuild, { readonly ok: true }>
    | { readonly ok: false; readonly reason: "no_customers_or_gaps" }
  > {
    const asOf = args.asOf ?? new Date().toISOString();

    // Fetch all customers for the retailer
    const customers = await new CustomerRepository(this.client).findByRetailer(
      args.retailerId,
    );

    // Build the catalogue categories once for the retailer
    const metadataRepo = new MetadataRepository(this.client);
    const garmentConcepts = await metadataRepo.findVisibleConcepts(
      args.retailerId,
      "garment_type",
    );
    const categoryByConceptId = resolveGarmentCategoryFromConcepts({
      concepts: garmentConcepts.map((concept) => ({
        id: concept.id,
        kind: concept.kind,
        slug: concept.slug,
        label: concept.canonicalName,
      })),
    });

    const products = (
      await new ProductRepository(this.client).findByRetailer(args.retailerId)
    )
      .filter((product) => product.status === "active")
      .slice(0, MAX_CATALOGUE_PRODUCTS_SCANNED);
    const variantRepo = new ProductVariantRepository(this.client);

    // Collect available categories in the catalogue
    const availableCatalogueCategories = new Set<string>();
    for (const product of products) {
      const acceptedConceptIds =
        await metadataRepo.findAcceptedConceptIdsForProduct(
          args.retailerId,
          product.id,
        );
      const categoryCode = acceptedConceptIds
        .map((conceptId) => categoryByConceptId.get(conceptId))
        .find((category): category is NonNullable<typeof category> =>
          Boolean(category),
        );
      if (!categoryCode) continue;

      const variants = await variantRepo.findByProduct(product.id);
      const inStock = variants.some((variant) => variant.inventoryQuantity > 0);
      if (inStock) {
        availableCatalogueCategories.add(categoryCode);
      }
    }

    // Check if we have any customers or catalogue candidates
    if (customers.length === 0 || availableCatalogueCategories.size === 0) {
      await this.withdrawLiveOfKind(
        args.retailerId,
        "complete_look",
        "Recomputed with no customers or catalogue gaps to analyze.",
      );
      return { ok: false, reason: "no_customers_or_gaps" };
    }

    // For each customer, find their gaps
    const wardrobeRepo = new WardrobeRepository(this.client);
    const allGaps: string[][] = [];

    for (const customer of customers) {
      const items = await wardrobeRepo.findByCustomer(customer.id);

      // Collect categories the customer owns (active items only)
      const ownedCategories = new Set<string>();
      for (const item of items) {
        if (item.deletedAt) continue;
        if (item.retiredAt) continue;
        ownedCategories.add(item.categoryCode);
      }

      // Find gaps: categories in catalogue but not owned by customer
      const customerGaps: string[] = [];
      for (const category of availableCatalogueCategories) {
        if (!ownedCategories.has(category)) {
          customerGaps.push(category);
        }
      }

      if (customerGaps.length > 0) {
        allGaps.push(customerGaps);
      }
    }

    // Find the most common gap
    const best = findMostCommonLookGap(allGaps);
    if (!best) {
      await this.withdrawLiveOfKind(
        args.retailerId,
        "complete_look",
        "Recomputed with no gaps found in customer wardrobes.",
      );
      return { ok: false, reason: "no_customers_or_gaps" };
    }

    const statement = `${best.customerCount} of ${customers.length} customers have no owned or in-stock ${best.categoryCode} — your most common wardrobe gap.`;

    const result = buildRecommendation({
      kind: "complete_look",
      statement,
      sources: [
        {
          sourceRef: "wardrobe_items+products",
          projectorVersion: COMPLETE_LOOK_PROJECTOR_VERSION,
          observedRows: customers.length,
        },
      ],
      window: { from: new Date(0).toISOString(), to: asOf },
      sampleSize: best.customerCount,
      derivedFromFactIds: [],
    });

    await this.withdrawLiveOfKind(
      args.retailerId,
      "complete_look",
      "Superseded by a newer computation.",
    );
    return this.store(args.retailerId, result);
  }

  /**
   * The `fit_risk` projector. Reads real fitting observations (excluding
   * `future_order_note` — an advisor explicitly deferring work is not a
   * risk signal), finds the garment area most often flagged `work_now`,
   * and stores a fully cited recommendation naming exactly how many
   * flagged observations fed it. Withdraws any prior live `fit_risk`
   * recommendation first, same supersede-not-pile-up pattern as every
   * other projector here.
   */
  async computeFitRisk(args: {
    readonly retailerId: RetailerId;
    readonly asOf?: string;
    readonly windowDays?: number;
  }): Promise<
    | { readonly ok: true; readonly id: string }
    | Exclude<RecommendationBuild, { readonly ok: true }>
    | { readonly ok: false; readonly reason: "no_fitting_observations" }
  > {
    const asOf = args.asOf ?? new Date().toISOString();
    const windowDays = args.windowDays ?? FIT_RISK_WINDOW_DAYS;
    const to = new Date(asOf);
    const from = new Date(to.getTime() - windowDays * 86_400_000);

    const observations = await new PhysicalGarmentRepository(
      this.client,
    ).findObservationsByRetailer(args.retailerId, {
      sinceIso: from.toISOString(),
    });
    if (observations.length === 0) {
      await this.withdrawLiveOfKind(
        args.retailerId,
        "fit_risk",
        "Recomputed with no fitting observations in the window.",
      );
      return { ok: false, reason: "no_fitting_observations" };
    }

    const best = findMostFlaggedFitArea(
      observations.map((observation) => ({
        area: observation.area,
        workNow: observation.classification === "work_now",
      })),
    );
    if (!best) {
      await this.withdrawLiveOfKind(
        args.retailerId,
        "fit_risk",
        "Recomputed with no work_now observations in the window.",
      );
      return { ok: false, reason: "no_fitting_observations" };
    }

    const flaggedIds = observations
      .filter(
        (observation) =>
          observation.classification === "work_now" &&
          observation.area.trim().toLowerCase() === best.area,
      )
      .map((observation) => observation.id);

    const statement = `${best.flagCount} of the last ${windowDays} days' ${observations.length} fitting observations flagged the ${best.area} for immediate work — your most common fit issue.`;

    const result = buildRecommendation({
      kind: "fit_risk",
      statement,
      sources: [
        {
          sourceRef: "fitting_observations",
          projectorVersion: FIT_RISK_PROJECTOR_VERSION,
          observedRows: observations.length,
        },
      ],
      window: { from: from.toISOString(), to: to.toISOString() },
      sampleSize: best.flagCount,
      derivedFromFactIds: flaggedIds,
    });

    await this.withdrawLiveOfKind(
      args.retailerId,
      "fit_risk",
      "Superseded by a newer computation.",
    );
    return this.store(args.retailerId, result);
  }

  /**
   * The `staffing_risk` projector. Compares real booked-appointment demand
   * against real scheduled staff-hours, bucketed by day of week over a
   * 90-day window, and finds the day with the highest demand-per-staff-hour
   * ratio — the day most likely to be genuinely understaffed, not merely
   * the busiest day in isolation (that claim already belongs to
   * `temporal_hotspot`). Stores a fully cited recommendation naming both
   * real numbers. Withdraws any prior live `staffing_risk` recommendation
   * first, same supersede-not-pile-up pattern as every other projector.
   */
  async computeStaffingRisk(args: {
    readonly retailerId: RetailerId;
    readonly asOf?: string;
    readonly windowDays?: number;
  }): Promise<
    | { readonly ok: true; readonly id: string }
    | Exclude<RecommendationBuild, { readonly ok: true }>
    | { readonly ok: false; readonly reason: "no_appointments_in_window" }
  > {
    const asOf = args.asOf ?? new Date().toISOString();
    const windowDays = args.windowDays ?? STAFFING_RISK_WINDOW_DAYS;
    const to = new Date(asOf);
    const from = new Date(to.getTime() - windowDays * 86_400_000);

    const appointments = (
      await new AppointmentRepository(this.client).findByRetailer(
        args.retailerId,
      )
    ).filter((appointment) => {
      if (
        appointment.status === "canceled" ||
        appointment.status === "no_show"
      ) {
        return false;
      }
      const startsAt = Date.parse(appointment.startsAt);
      return startsAt >= from.getTime() && startsAt <= to.getTime();
    });
    if (appointments.length === 0) {
      await this.withdrawLiveOfKind(
        args.retailerId,
        "staffing_risk",
        "Recomputed with no appointments in the window.",
      );
      return { ok: false, reason: "no_appointments_in_window" };
    }

    const shifts = await new StaffRosterRepository(
      this.client,
    ).findShiftsByRetailer(args.retailerId, {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    });

    const appointmentCountByDay = new Map<number, number>();
    for (const appointment of appointments) {
      const dayOfWeek = new Date(appointment.startsAt).getUTCDay();
      appointmentCountByDay.set(
        dayOfWeek,
        (appointmentCountByDay.get(dayOfWeek) ?? 0) + 1,
      );
    }

    const staffHoursByDay = new Map<number, number>();
    for (const shift of shifts) {
      const dayOfWeek = new Date(`${shift.shiftDate}T00:00:00Z`).getUTCDay();
      const hours = timeStringToHours(shift.endTime) - timeStringToHours(shift.startTime);
      staffHoursByDay.set(
        dayOfWeek,
        (staffHoursByDay.get(dayOfWeek) ?? 0) + hours,
      );
    }

    const days = [...appointmentCountByDay.entries()].map(
      ([dayOfWeek, appointmentCount]) => ({
        dayOfWeek,
        appointmentCount,
        staffHours: staffHoursByDay.get(dayOfWeek) ?? 0,
      }),
    );

    const best = findMostUnderstaffedDay(days);
    if (!best) {
      await this.withdrawLiveOfKind(
        args.retailerId,
        "staffing_risk",
        "Recomputed with no understaffed day found in the window.",
      );
      return { ok: false, reason: "no_appointments_in_window" };
    }

    const coverageClause =
      best.staffHours > 0
        ? `only ${best.staffHours.toFixed(1)} scheduled staff-hour${best.staffHours === 1 ? "" : "s"}`
        : "no scheduled staff-hours at all";
    const statement = `${DAY_NAMES[best.dayOfWeek]}s carry ${best.appointmentCount} of the last ${windowDays} days' appointments against ${coverageClause} — your most understaffed day.`;

    const result = buildRecommendation({
      kind: "staffing_risk",
      statement,
      sources: [
        {
          sourceRef: "appointments+staff_shifts",
          projectorVersion: STAFFING_RISK_PROJECTOR_VERSION,
          observedRows: appointments.length,
        },
      ],
      window: { from: from.toISOString(), to: to.toISOString() },
      sampleSize: best.appointmentCount,
      derivedFromFactIds: [],
    });

    await this.withdrawLiveOfKind(
      args.retailerId,
      "staffing_risk",
      "Superseded by a newer computation.",
    );
    return this.store(args.retailerId, result);
  }

  /**
   * Withdraws only the live `corporate_renewal_risk` recommendation for
   * ONE programme — `withdrawLiveOfKind` withdraws every recommendation
   * of a kind for the whole retailer, which is wrong here: a retailer
   * can run several corporate programmes, each needing its own live
   * renewal signal untouched by another programme's recompute. Scoped
   * by a `corporate_programme:<id>` marker in `sources[].sourceRef`
   * rather than a new column on a table every other recommendation kind
   * also uses.
   */
  private async withdrawLiveRenewalRiskForProgramme(
    retailerId: RetailerId,
    programmeId: string,
    reason: string,
  ): Promise<void> {
    const live = await this.listLive({
      retailerId,
      kind: "corporate_renewal_risk",
    });
    const marker = `corporate_programme:${programmeId}`;
    const toWithdraw = live.filter((row) => {
      const sources = row.sources as unknown as { sourceRef: string }[];
      return sources.some((s) => s.sourceRef === marker);
    });
    for (const row of toWithdraw) {
      const { error } = await this.client
        .from("cited_recommendations")
        .update({
          withdrawn_at: new Date().toISOString(),
          withdrawn_reason: reason,
        })
        .eq("id", row.id)
        .eq("retailer_id", retailerId)
        .is("withdrawn_at", null);
      if (error) throw error;
    }
  }

  /**
   * The `corporate_renewal_risk` projector (PHASE 18.9 / BD-109). Reads
   * live wearer/issue/exception counts for one programme, scores risk
   * with the plain, published `assessRenewalRisk` formula, and stores a
   * fully cited recommendation — citing the exact wearer ids the score
   * was computed from. Auto-creates a `corporate_renewal_tasks` row
   * when risk is medium/high and no task is already open (the unique
   * index on `programme_id where status='open'` is the actual
   * enforcement against duplicates, not this check alone).
   */
  async computeCorporateRenewalRisk(args: {
    readonly retailerId: RetailerId;
    readonly programmeId: string;
    readonly asOf?: string;
  }): Promise<
    | { readonly ok: true; readonly id: string; readonly taskCreated: boolean }
    | Exclude<RecommendationBuild, { readonly ok: true }>
    | { readonly ok: false; readonly reason: "no_wearers_in_programme" }
  > {
    const asOf = args.asOf ?? new Date().toISOString();
    const corporateRepo = new CorporateRepository(this.client);
    const wearers = await corporateRepo.findWearersByProgramme(
      args.programmeId,
    );
    if (wearers.length === 0) {
      await this.withdrawLiveRenewalRiskForProgramme(
        args.retailerId,
        args.programmeId,
        "Recomputed with no wearers in the programme.",
      );
      return { ok: false, reason: "no_wearers_in_programme" };
    }

    const issuesByWearer = await Promise.all(
      wearers.map((w) => corporateRepo.findIssuesByWearer(w.id)),
    );
    const fulfilledWearerCount = issuesByWearer.filter(
      (issues) => issues.length > 0,
    ).length;
    const exceptions = await corporateRepo.findExceptionsByProgramme(
      args.programmeId,
    );
    const damageEventCount = exceptions.filter((e) =>
      ["damaged", "missing", "replacement_request"].includes(e.kind),
    ).length;
    const repairEventCount = exceptions.filter(
      (e) => e.kind === "repair",
    ).length;
    const programme = await corporateRepo.findProgrammeById(args.programmeId);

    const metrics = computeCorporateProgrammeMetrics({
      wearerCount: wearers.length,
      activeWearerCount: wearers.filter((w) => w.active).length,
      fulfilledWearerCount,
      damageEventCount,
      repairEventCount,
      contractValueMinorUnits: programme?.contractValueMinorUnits ?? null,
      contractValueCurrency: programme?.contractValueCurrency ?? null,
    });
    const risk = assessRenewalRisk(metrics);

    const statement = `${Math.round(metrics.participationRate * 100)}% active, ${Math.round(metrics.fulfilmentRate * 100)}% fulfilled, ${damageEventCount} damage/replacement event${damageEventCount === 1 ? "" : "s"}, ${repairEventCount} repair event${repairEventCount === 1 ? "" : "s"} across ${wearers.length} wearers — renewal risk ${risk.level} (score ${risk.score}/100).`;

    const result = buildRecommendation({
      kind: "corporate_renewal_risk",
      statement,
      sources: [
        {
          sourceRef: `corporate_programme:${args.programmeId}`,
          projectorVersion: "corporate-renewal-risk-v1",
          observedRows: wearers.length,
        },
      ],
      window: {
        from: new Date(0).toISOString(),
        to: asOf,
      },
      sampleSize: wearers.length,
      derivedFromFactIds: wearers.map((w) => w.id),
    });
    await this.withdrawLiveRenewalRiskForProgramme(
      args.retailerId,
      args.programmeId,
      "Superseded by a newer computation.",
    );
    const stored = await this.store(args.retailerId, result);
    if (!stored.ok) return stored;

    let taskCreated = false;
    const { data: openTask } = await this.client
      .from("corporate_renewal_tasks")
      .select("id")
      .eq("programme_id", args.programmeId)
      .eq("status", "open")
      .maybeSingle();
    if (
      shouldCreateRenewalTask({ level: risk.level, hasOpenTask: !!openTask })
    ) {
      const { error: taskError } = await this.client
        .from("corporate_renewal_tasks")
        .insert({
          retailer_id: args.retailerId,
          programme_id: args.programmeId,
          reason: statement,
        });
      if (taskError) throw taskError;
      taskCreated = true;
    }

    return { ok: true, id: stored.id, taskCreated };
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
