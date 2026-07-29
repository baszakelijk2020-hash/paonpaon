/** Retention classes governing interaction-event lifecycle per ADR-061. */
export type RetentionClass =
  "personalization_standard" | "legacy_analytics" | "anonymous_session";

export const RETENTION_CLASSES = [
  "personalization_standard",
  "legacy_analytics",
  "anonymous_session",
] as const satisfies readonly RetentionClass[];

/** Standard personalization evidence retention (24 months). */
export const PERSONALIZATION_RETENTION_DAYS = 730;

/** Grace period after withdrawal before anonymization begins. */
export const WITHDRAWAL_ANONYMIZATION_DAYS = 90;

/** Anonymous session signals when lawful (7 days). */
export const ANONYMOUS_SESSION_RETENTION_DAYS = 7;

export function retentionDaysForClass(retentionClass: RetentionClass): number {
  switch (retentionClass) {
    case "personalization_standard":
      return PERSONALIZATION_RETENTION_DAYS;
    case "legacy_analytics":
      return PERSONALIZATION_RETENTION_DAYS;
    case "anonymous_session":
      return ANONYMOUS_SESSION_RETENTION_DAYS;
  }
}

export function addDays(isoTimestamp: string, days: number): string {
  const date = new Date(isoTimestamp);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

export function computeRetentionExpiresAt(
  retentionClass: RetentionClass,
  occurredAt: string,
): string {
  return addDays(occurredAt, retentionDaysForClass(retentionClass));
}

export function computeWithdrawalRetentionDeadline(
  withdrawnAt: string,
): string {
  return addDays(withdrawnAt, WITHDRAWAL_ANONYMIZATION_DAYS);
}

export function isRetentionExpired(
  retentionExpiresAt: string | undefined,
  nowIso: string,
): boolean {
  if (!retentionExpiresAt) return false;
  return new Date(retentionExpiresAt).getTime() <= new Date(nowIso).getTime();
}
