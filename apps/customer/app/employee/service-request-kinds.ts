import type { CorporateExceptionKind } from "@paon/domain";

/** The kinds a wearer may raise themselves — never leaver_return
 * (an entitlement event a person cannot self-declare) or
 * entitlement_dispute/service_required (staff-adjudicated). Not in
 * `actions.ts`: a "use server" module may only export async functions,
 * and a plain constant exported from one is silently unusable by a
 * client component that imports it. */
export const WEARER_RAISABLE_EXCEPTION_KINDS: readonly CorporateExceptionKind[] =
  [
    "damaged",
    "missing",
    "fit_issue",
    "alteration_request",
    "replacement_request",
  ];
