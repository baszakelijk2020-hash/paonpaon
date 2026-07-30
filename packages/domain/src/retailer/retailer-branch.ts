/**
 * Retailer branches / stores with IANA timezone (CLI-006 / PHASE 7.5).
 */

import type { RetailerBranchId, RetailerId } from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

export interface RetailerBranch extends Timestamps {
  readonly id: RetailerBranchId;
  readonly retailerId: RetailerId;
  readonly name: string;
  readonly timezone: string;
  readonly isDefault: boolean;
}

/**
 * Reject empty / obviously invalid IANA timezone labels. Full Olson
 * validation is left to runtime Intl (see `isSupportedTimeZone`).
 */
export function looksLikeIanaTimeZone(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.length >= 3 &&
    trimmed.length <= 64 &&
    /^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+$|^UTC$|^Etc\/[A-Za-z0-9_+-]+$/.test(
      trimmed,
    )
  );
}

export function isSupportedTimeZone(value: string): boolean {
  if (!looksLikeIanaTimeZone(value)) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
