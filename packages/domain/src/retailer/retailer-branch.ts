/**
 * Retailer branches / stores with IANA timezone (CLI-006 / PHASE 7.5).
 */

import type { RetailerBranchId, RetailerId } from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

export const BRANCH_PRESENTATION_MODES = ["map", "globe"] as const;
export type BranchPresentationMode = (typeof BRANCH_PRESENTATION_MODES)[number];

export interface BranchOpeningHoursEntry {
  readonly day:
    | "monday"
    | "tuesday"
    | "wednesday"
    | "thursday"
    | "friday"
    | "saturday"
    | "sunday";
  readonly closed: boolean;
  readonly opens?: string;
  readonly closes?: string;
}

export interface BranchContactAction {
  readonly type: "call" | "email" | "book" | "directions";
  readonly label: string;
  readonly value: string;
}

export interface BranchImage {
  readonly url: string;
  readonly alt: string;
  readonly rightsNote?: string;
}

/**
 * FT-11 Location Finder: the public-facing location facts a retailer
 * maintains for a branch. `published` is opt-in and data-minimal — an
 * unpublished branch must never surface in the customer-facing finder.
 */
export interface RetailerBranch extends Timestamps {
  readonly id: RetailerBranchId;
  readonly retailerId: RetailerId;
  readonly name: string;
  readonly timezone: string;
  readonly isDefault: boolean;
  readonly storeType: string | null;
  readonly addressLine1: string | null;
  readonly addressLine2: string | null;
  readonly city: string | null;
  readonly region: string | null;
  readonly postalCode: string | null;
  readonly country: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly phone: string | null;
  readonly contactEmail: string | null;
  readonly openingHours: readonly BranchOpeningHoursEntry[];
  readonly services: readonly string[];
  readonly contactActions: readonly BranchContactAction[];
  readonly filterCategories: readonly string[];
  readonly imagery: readonly BranchImage[];
  readonly presentationMode: BranchPresentationMode;
  readonly published: boolean;
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
