/**
 * PAON Métier corporate programmes (CORP-101..106 / PHASE 14.1).
 *
 * A corporate programme is an employer buying garments for its people. The
 * two non-goals shape everything: **no HR replacement** and **no
 * unrestricted health or accommodation data**.
 *
 * The first means PAON never becomes the record of employment. A wearer is
 * a person entitled to garments under a programme; there is no salary, no
 * manager hierarchy, no performance field, and a leaver is handled as an
 * *entitlement* event, not as a termination record.
 *
 * The second is why `AccommodationNote` exists and why it is deliberately
 * narrow. Someone may need a garment adapted — a longer sleeve, a seated
 * cut, a fastening they can manage one-handed. That is a garment fact and
 * it is captured as one. The reason is not asked for, has nowhere to be
 * stored, and `checkAccommodationNote` refuses text that looks like a
 * diagnosis, because a free-text field next to a fitting is exactly where
 * medical information ends up by accident.
 */

import type {
  CorporateAccountId,
  CorporateAnnouncementId,
  CorporateEntitlementVersionId,
  CorporateExceptionId,
  CorporateIssueRecordId,
  CorporateProgrammeId,
  CorporateWearerId,
  CustomerId,
  OrderId,
  RetailerId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

export const ENTITLEMENT_PERIODS = [
  "annual",
  "biennial",
  "on_joining",
] as const;
export type EntitlementPeriod = (typeof ENTITLEMENT_PERIODS)[number];

/** The employer buying garments for its people. Never PAON's employment record — see file doc. */
export interface CorporateAccount extends Timestamps {
  readonly id: CorporateAccountId;
  readonly retailerId: RetailerId;
  readonly legalName: string;
  readonly accountReference: string;
  readonly active: boolean;
}

export interface CorporateProgramme extends Timestamps {
  readonly id: CorporateProgrammeId;
  readonly retailerId: RetailerId;
  readonly accountId: CorporateAccountId;
  readonly name: string;
  readonly siteKeys: readonly string[];
  readonly active: boolean;
  /** Nullable: only set once staff has explicitly entered a contract
   * value (18.9 / BD-109). */
  readonly contractValueMinorUnits: number | null;
  readonly contractValueCurrency: string | null;
}

export interface CorporateEntitlementVersionRecord {
  readonly id: CorporateEntitlementVersionId;
  readonly retailerId: RetailerId;
  readonly programmeId: CorporateProgrammeId;
  readonly version: number;
  readonly effectiveFrom: string;
  readonly rules: readonly EntitlementRule[];
  readonly createdAt: string;
}

export interface CorporateWearer extends Timestamps {
  readonly id: CorporateWearerId;
  readonly retailerId: RetailerId;
  readonly programmeId: CorporateProgrammeId;
  readonly customerId?: CustomerId;
  readonly employeeReference: string;
  readonly displayName: string;
  readonly roleKey: string;
  readonly siteKey?: string;
  readonly joinedOn: string;
  readonly active: boolean;
  readonly garmentAdaptationNote?: string;
  /** Employee Portal login identity (PHASE 18.5) — separate from
   * `customerId`'s linked customer email; see the migration header. */
  readonly loginEmail?: string;
  readonly userId?: string;
}

/** PHASE 18.5 / BD-105: programme-scoped news for a programme's wearers.
 * Draft until `publishedAt` is set — never visible to a wearer before
 * that. PHASE 14.1 / BD-104 extended: either a retailer staff member or
 * a corporate manager (account owner) may author. Exactly one of
 * `authoredByStaffId` or `authoredByManagerId` is set. */
export interface CorporateAnnouncement {
  readonly id: CorporateAnnouncementId;
  readonly retailerId: RetailerId;
  readonly programmeId: CorporateProgrammeId;
  readonly title: string;
  readonly body: string;
  readonly authoredByStaffId?: string;
  readonly authoredByManagerId?: string;
  readonly publishedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CorporateIssueRecordEntity {
  readonly id: CorporateIssueRecordId;
  readonly retailerId: RetailerId;
  readonly wearerId: CorporateWearerId;
  readonly entitlementVersionId: CorporateEntitlementVersionId;
  readonly garmentKey: string;
  readonly quantity: number;
  readonly orderId?: OrderId;
  readonly issuedOn: string;
  readonly createdAt: string;
}

export const CORPORATE_EXCEPTION_KINDS = [
  "leaver_return",
  "service_required",
  "fit_issue",
  "entitlement_dispute",
  // Corporate service desk (PHASE 18.8 / BD-108) — extends this same
  // vocabulary rather than forking a second ticketing table.
  "damaged",
  "missing",
  "alteration_request",
  "replacement_request",
  // 18.9 (BD-109): tracked separately from damage in renewal-risk metrics.
  "repair",
] as const;
export type CorporateExceptionKind = (typeof CORPORATE_EXCEPTION_KINDS)[number];

export interface CorporateException extends Timestamps {
  readonly id: CorporateExceptionId;
  readonly retailerId: RetailerId;
  readonly programmeId: CorporateProgrammeId;
  readonly wearerId?: CorporateWearerId;
  readonly kind: CorporateExceptionKind;
  readonly garmentKey?: string;
  readonly quantity?: number;
  readonly action?: LeaverAction;
  readonly detail: string;
  readonly resolvedAt?: string;
  /** PHASE 18.8: service-desk fields, all optional so 14.1's original
   * exceptions (leaver/service/fit/dispute) keep working unchanged. */
  readonly priority?: string;
  readonly dueAt?: string;
  readonly assignedStaffId?: string;
}

export interface EntitlementRule {
  readonly roleKey: string;
  readonly garmentKey: string;
  readonly quantity: number;
  readonly period: EntitlementPeriod;
}

export interface EntitlementVersion {
  readonly versionId: string;
  readonly version: number;
  readonly effectiveFrom: string;
  readonly rules: readonly EntitlementRule[];
}

export interface WearerIssueRecord {
  readonly garmentKey: string;
  readonly quantity: number;
  readonly issuedOn: string;
}

export interface EntitlementBalance {
  readonly garmentKey: string;
  readonly entitledQuantity: number;
  readonly issuedQuantity: number;
  readonly remainingQuantity: number;
}

function periodStart(
  period: EntitlementPeriod,
  asOf: string,
  joinedOn: string,
): string {
  const asOfDate = new Date(asOf);
  if (period === "on_joining") return joinedOn;
  const years = period === "annual" ? 1 : 2;
  const start = new Date(asOfDate);
  start.setUTCFullYear(start.getUTCFullYear() - years);
  return start.toISOString();
}

/**
 * What a wearer may still draw. Pins the entitlement *version*, so an
 * employer widening the policy next year does not retroactively make last
 * year's issues over-quota, and narrowing it does not retroactively make
 * an already-issued garment a breach.
 */
export function computeEntitlementBalance(args: {
  readonly version: EntitlementVersion;
  readonly roleKey: string;
  readonly joinedOn: string;
  readonly issues: readonly WearerIssueRecord[];
  readonly asOf: string;
}): readonly EntitlementBalance[] {
  const rules = args.version.rules.filter(
    (rule) => rule.roleKey === args.roleKey,
  );
  return rules.map((rule) => {
    const since = periodStart(rule.period, args.asOf, args.joinedOn);
    const issued = args.issues
      .filter(
        (issue) =>
          issue.garmentKey === rule.garmentKey &&
          Date.parse(issue.issuedOn) >= Date.parse(since),
      )
      .reduce((total, issue) => total + issue.quantity, 0);
    return {
      garmentKey: rule.garmentKey,
      entitledQuantity: rule.quantity,
      issuedQuantity: issued,
      remainingQuantity: Math.max(rule.quantity - issued, 0),
    };
  });
}

export type IssueCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "not_entitled_to_garment"
        | "entitlement_exhausted"
        | "wearer_not_active"
        | "programme_not_active";
      readonly remaining?: number;
    };

export function checkIssue(args: {
  readonly balances: readonly EntitlementBalance[];
  readonly garmentKey: string;
  readonly quantity: number;
  readonly wearerActive: boolean;
  readonly programmeActive: boolean;
}): IssueCheck {
  if (!args.programmeActive)
    return { ok: false, reason: "programme_not_active" };
  if (!args.wearerActive) return { ok: false, reason: "wearer_not_active" };
  const balance = args.balances.find(
    (entry) => entry.garmentKey === args.garmentKey,
  );
  if (!balance) return { ok: false, reason: "not_entitled_to_garment" };
  if (args.quantity > balance.remainingQuantity) {
    return {
      ok: false,
      reason: "entitlement_exhausted",
      remaining: balance.remainingQuantity,
    };
  }
  return { ok: true };
}

export const LEAVER_ACTIONS = [
  "return_requested",
  "returned",
  "retained_by_agreement",
  "written_off",
] as const;
export type LeaverAction = (typeof LEAVER_ACTIONS)[number];

export interface LeaverException {
  readonly wearerId: string;
  readonly garmentKey: string;
  readonly quantity: number;
  readonly action: LeaverAction;
}

/**
 * A leaver produces garment-return exceptions, nothing else. Note what is
 * absent: no termination reason, no last-working-day HR field, no notice
 * period. PAON is not the employment record, and the only fact it needs is
 * that a wearer stopped being entitled on a date.
 */
export function planLeaverExceptions(args: {
  readonly wearerId: string;
  readonly issues: readonly WearerIssueRecord[];
  readonly retainableGarmentKeys?: readonly string[];
}): readonly LeaverException[] {
  const retainable = new Set(args.retainableGarmentKeys ?? []);
  const byGarment = new Map<string, number>();
  for (const issue of args.issues) {
    byGarment.set(
      issue.garmentKey,
      (byGarment.get(issue.garmentKey) ?? 0) + issue.quantity,
    );
  }
  return [...byGarment.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([garmentKey, quantity]) => ({
      wearerId: args.wearerId,
      garmentKey,
      quantity,
      action: retainable.has(garmentKey)
        ? ("retained_by_agreement" as const)
        : ("return_requested" as const),
    }));
}

export interface ProgrammeReadiness {
  readonly wearerCount: number;
  readonly fittedCount: number;
  readonly orderedCount: number;
  readonly issuedCount: number;
  /** Wearers with nothing yet. The list an account manager actually works
   * from — a percentage tells them they are behind, a list tells them who
   * to call. */
  readonly notStartedWearerIds: readonly string[];
  readonly readyForTender: boolean;
}

export function summarizeProgrammeReadiness(args: {
  readonly wearers: readonly {
    readonly wearerId: string;
    readonly fitted: boolean;
    readonly ordered: boolean;
    readonly issued: boolean;
  }[];
}): ProgrammeReadiness {
  const fitted = args.wearers.filter((w) => w.fitted).length;
  const ordered = args.wearers.filter((w) => w.ordered).length;
  const issued = args.wearers.filter((w) => w.issued).length;
  return {
    wearerCount: args.wearers.length,
    fittedCount: fitted,
    orderedCount: ordered,
    issuedCount: issued,
    notStartedWearerIds: args.wearers
      .filter((w) => !w.fitted && !w.ordered && !w.issued)
      .map((w) => w.wearerId)
      .sort(),
    readyForTender: args.wearers.length > 0 && fitted === args.wearers.length,
  };
}

export type AccommodationCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: "looks_like_health_data" | "empty";
    };

/**
 * Patterns that indicate someone is about to type a medical reason into a
 * garment field. Not exhaustive and not meant to be — it is a guardrail
 * that makes the accidental case fail loudly, paired with a UI that asks
 * for the adaptation rather than the cause.
 */
const HEALTH_TERMS =
  /\b(diagnos\w*|prosthe\w*|amputat\w*|wheelchair|disabilit\w*|disabled|surgery|surgical|medication|condition|illness|injur\w*|therapy|patient)\b/i;

/**
 * A garment adaptation is a garment fact: "left sleeve +40mm", "magnetic
 * fastening", "seated cut". The reason behind it is not asked for and has
 * nowhere to be stored. This refuses text that reads like a diagnosis,
 * because a free-text note beside a fitting is exactly where health data
 * ends up by accident.
 */
export function checkAccommodationNote(note: string): AccommodationCheck {
  if (note.trim().length === 0) return { ok: false, reason: "empty" };
  if (HEALTH_TERMS.test(note)) {
    return { ok: false, reason: "looks_like_health_data" };
  }
  return { ok: true };
}

export interface CorporateScopedView {
  readonly programmeId: string;
  readonly wearerCount: number;
  readonly readiness: ProgrammeReadiness;
}

/**
 * What a corporate account contact may see. Explicitly a whitelist, and
 * explicitly NOT the retailer's view: the employer sees its own programme
 * readiness, never the retailer's margins, other clients, or an
 * individual's measurements. A supervisor able to read a colleague's chest
 * measurement is the single worst failure mode in this item.
 */
export function buildCorporateScopedView(args: {
  readonly programmeId: string;
  readonly readiness: ProgrammeReadiness;
}): CorporateScopedView {
  return {
    programmeId: args.programmeId,
    wearerCount: args.readiness.wearerCount,
    readiness: args.readiness,
  };
}
