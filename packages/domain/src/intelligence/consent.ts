/**
 * Purpose-specific consent for personalization intelligence (CUST-001,
 * CUST-003, ADR-061 / PHASE 3.1). Marketing and location stay separate from
 * personalization; withdrawal stops new use without erasing durable business
 * records.
 */

import type {
  CustomerConsentEventId,
  CustomerId,
  RetailerId,
  UserId,
} from "../shared/branded-id";

export const CONSENT_PURPOSES = [
  "personalization",
  "marketing",
  "location",
] as const;

export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export const CONSENT_STATUSES = ["granted", "denied", "withdrawn"] as const;

export type ConsentStatus = (typeof CONSENT_STATUSES)[number];

export const CONSENT_BASES = [
  "explicit_opt_in",
  "explicit_opt_out",
  "legitimate_interest_anonymous",
  "service_necessary",
] as const;

export type ConsentBasis = (typeof CONSENT_BASES)[number];

/** Default retention for personalization interaction signals (days). */
export const PERSONALIZATION_SIGNAL_RETENTION_DAYS = 365;

export interface PurposeConsentState {
  readonly purpose: ConsentPurpose;
  readonly status: ConsentStatus;
  readonly grantedAt?: string;
  readonly withdrawnAt?: string;
}

/**
 * Per-retailer-relationship consent state. Personalization, marketing, and
 * location never share a single boolean.
 */
export interface CustomerConsentState {
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly personalization: PurposeConsentState;
  readonly marketing: PurposeConsentState;
  readonly location: PurposeConsentState;
  readonly updatedAt: string;
}

/** Immutable snapshot stamped onto every interaction event at capture time. */
export interface ConsentSnapshot {
  readonly personalization: ConsentStatus;
  readonly marketing: ConsentStatus;
  readonly location: ConsentStatus;
  readonly capturedAt: string;
  readonly basis: ConsentBasis;
}

export interface CustomerConsentEvent {
  readonly id: CustomerConsentEventId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly purpose: ConsentPurpose;
  readonly status: ConsentStatus;
  readonly previousStatus?: ConsentStatus;
  readonly actorUserId?: UserId;
  readonly reason?: string;
  readonly createdAt: string;
}

export function purposeConsentStatus(args: {
  readonly optIn: boolean;
  readonly withdrawnAt?: string | null;
}): ConsentStatus {
  if (args.withdrawnAt) return "withdrawn";
  return args.optIn ? "granted" : "denied";
}

export function buildConsentSnapshot(args: {
  readonly state: CustomerConsentState;
  readonly basis: ConsentBasis;
  readonly capturedAt: string;
}): ConsentSnapshot {
  return {
    personalization: args.state.personalization.status,
    marketing: args.state.marketing.status,
    location: args.state.location.status,
    capturedAt: args.capturedAt,
    basis: args.basis,
  };
}

export function isPurposeGranted(
  state: CustomerConsentState,
  purpose: ConsentPurpose,
): boolean {
  return state[purpose].status === "granted";
}

/**
 * Signed-in personalization capture requires explicit personalization
 * opt-in. Withdrawn and denied both fail closed.
 */
export function mayCapturePersonalizationForCustomer(
  state: CustomerConsentState,
): boolean {
  return isPurposeGranted(state, "personalization");
}

/**
 * Anonymous session signals are modeled but not persisted until a
 * jurisdiction documents a lawful basis (PHASE 3.1 hard blocker).
 */
export function mayPersistAnonymousInteraction(args: {
  readonly jurisdictionAllowsAnonymous: boolean;
  readonly basis: ConsentBasis;
}): boolean {
  return (
    args.jurisdictionAllowsAnonymous &&
    args.basis === "legitimate_interest_anonymous"
  );
}

/**
 * Withdrawal stops new personalization use. Durable orders/messages remain;
 * personalization signals enter anonymization/retention handling.
 */
export function withdrawalEffect(purpose: ConsentPurpose): {
  readonly stopNewUse: boolean;
  readonly anonymizePersonalizationSignals: boolean;
  readonly eraseDurableBusinessRecords: boolean;
} {
  return {
    stopNewUse: true,
    anonymizePersonalizationSignals: purpose === "personalization",
    eraseDurableBusinessRecords: false,
  };
}

export function retentionExpiresAt(args: {
  readonly occurredAt: string;
  readonly retentionDays?: number;
}): string {
  const days = args.retentionDays ?? PERSONALIZATION_SIGNAL_RETENTION_DAYS;
  const occurred = Date.parse(args.occurredAt);
  if (Number.isNaN(occurred)) {
    throw new Error("Invalid occurredAt for retention expiry");
  }
  return new Date(occurred + days * 24 * 60 * 60 * 1000).toISOString();
}

export function isRetentionExpired(args: {
  readonly retentionExpiresAt: string;
  readonly now: string;
}): boolean {
  return Date.parse(args.now) >= Date.parse(args.retentionExpiresAt);
}

/**
 * Advisors may only use same-retailer events that still have a customer
 * linkage, are not anonymized, and have not expired.
 */
export function isAdvisorVisiblePersonalizationEvent(args: {
  readonly eventRetailerId: RetailerId;
  readonly advisorRetailerId: RetailerId;
  readonly customerId?: CustomerId;
  readonly anonymizedAt?: string | null;
  readonly retentionExpiresAt: string;
  readonly now: string;
  readonly personalizationConsent: ConsentStatus;
}): boolean {
  if (args.eventRetailerId !== args.advisorRetailerId) return false;
  if (!args.customerId) return false;
  if (args.anonymizedAt) return false;
  if (isRetentionExpired(args)) return false;
  return args.personalizationConsent === "granted";
}

/**
 * Anonymous sessions must never be retroactively linked to a customer
 * identity without an explicit authorization path (none in 3.1).
 */
export function mayLinkAnonymousSessionToCustomer(): boolean {
  return false;
}
