import type { CustomerId, RetailerId } from "../shared/branded-id";

/** Purpose-specific consent per ADR-061. Marketing comms opt-in remains on
 * `CustomerPreferences`; this record governs intelligence use. */
export type ConsentPurpose = "personalization" | "marketing" | "location";

export const CONSENT_PURPOSES = [
  "personalization",
  "marketing",
  "location",
] as const satisfies readonly ConsentPurpose[];

export type ConsentBasis =
  | "explicit_opt_in"
  | "never_granted"
  | "withdrawn"
  | "legacy_implicit";

/** Immutable snapshot embedded on each interaction event at capture time. */
export interface ConsentSnapshot {
  readonly purpose: ConsentPurpose;
  readonly granted: boolean;
  readonly basis: ConsentBasis;
  readonly recordedAt: string;
  readonly version: 1;
}

export interface CustomerConsentRecord {
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly purpose: ConsentPurpose;
  readonly grantedAt: string | null;
  readonly withdrawnAt: string | null;
  readonly retentionDeadlineAt: string | null;
}

export interface UpsertCustomerConsentInput {
  readonly purpose: ConsentPurpose;
  readonly granted: boolean;
}
