import type { ConsentSnapshot, CustomerConsentRecord } from "./consent";
import type {
  InteractionEvent,
  InteractionEventType,
} from "./interaction-event";
import {
  computeRetentionExpiresAt,
  computeWithdrawalRetentionDeadline,
  isRetentionExpired,
} from "./retention";

export type ConsentState = "granted" | "never_granted" | "withdrawn";

export function consentState(
  record: CustomerConsentRecord | null | undefined,
): ConsentState {
  if (!record?.grantedAt) return "never_granted";
  if (record.withdrawnAt) return "withdrawn";
  return "granted";
}

export function isConsentGranted(
  record: CustomerConsentRecord | null | undefined,
): boolean {
  return consentState(record) === "granted";
}

export function buildConsentSnapshot(
  record: CustomerConsentRecord | null | undefined,
  recordedAt: string,
): ConsentSnapshot {
  const state = consentState(record);
  return {
    purpose: record?.purpose ?? "personalization",
    granted: state === "granted",
    basis:
      state === "granted"
        ? "explicit_opt_in"
        : state === "withdrawn"
          ? "withdrawn"
          : "never_granted",
    recordedAt,
    version: 1,
  };
}

export function buildLegacyConsentSnapshot(
  recordedAt: string,
): ConsentSnapshot {
  return {
    purpose: "personalization",
    granted: true,
    basis: "legacy_implicit",
    recordedAt,
    version: 1,
  };
}

export interface CaptureEligibilityInput {
  readonly interactionType: InteractionEventType;
  readonly consentRecords: readonly CustomerConsentRecord[];
  readonly capturedAt: string;
}

export interface CaptureEligibilityResult {
  readonly allowed: boolean;
  readonly reason?: string;
  readonly consentSnapshot?: ConsentSnapshot;
}

/** Fail closed when personalization consent is absent or withdrawn. */
export function assessCaptureEligibility(
  input: CaptureEligibilityInput,
): CaptureEligibilityResult {
  const purpose = "personalization" as const;
  const record = input.consentRecords.find(
    (candidate) => candidate.purpose === purpose,
  );
  const snapshot = buildConsentSnapshot(record ?? null, input.capturedAt);

  if (!snapshot.granted) {
    return {
      allowed: false,
      reason:
        consentState(record) === "withdrawn"
          ? "Personalization consent withdrawn"
          : "Personalization consent required",
    };
  }

  return { allowed: true, consentSnapshot: snapshot };
}

/** Advisor-visible events require a granted snapshot and must not be expired
 * or anonymized. Withdrawal hides future advisor use immediately. */
export function isAdvisorVisibleEvent(
  event: InteractionEvent,
  consentRecords: readonly CustomerConsentRecord[],
  nowIso: string,
): boolean {
  if (event.anonymizedAt) return false;
  if (!event.consentSnapshot.granted) return false;
  if (event.purpose !== "personalization") return false;

  const current = consentRecords.find(
    (record) => record.purpose === event.purpose,
  );
  if (current?.withdrawnAt) {
    const deadline =
      current.retentionDeadlineAt ??
      computeWithdrawalRetentionDeadline(current.withdrawnAt);
    if (new Date(nowIso).getTime() > new Date(deadline).getTime()) {
      return false;
    }
  }

  const expiresAt =
    event.retentionExpiresAt ??
    computeRetentionExpiresAt(event.retentionClass, event.occurredAt);
  return !isRetentionExpired(expiresAt, nowIso);
}

export function filterAdvisorVisibleEvents(
  events: readonly InteractionEvent[],
  consentRecords: readonly CustomerConsentRecord[],
  nowIso: string,
): InteractionEvent[] {
  return events.filter((event) =>
    isAdvisorVisibleEvent(event, consentRecords, nowIso),
  );
}
