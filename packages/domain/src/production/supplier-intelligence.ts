/**
 * Supplier/atelier intelligence and support operations (MTM-101 /
 * PHASE 12.4).
 *
 * This item's non-goals are unusually specific — "no invented supplier
 * data, undocumented factory write-back or black-box MinorityReport claim"
 * — and they shape the whole module:
 *
 * - Every supplier fact carries a source authority and an observation
 *   time. `resolveSupplierFact` refuses to answer from an unknown source
 *   and marks a stale answer as stale rather than presenting it as
 *   current. Reusing Stage 8's `source_authority_policies` concept rather
 *   than inventing a second notion of "who is allowed to say this".
 * - Conflicts between two authorities are surfaced, never silently
 *   resolved by picking the newer one. Two suppliers disagreeing about
 *   stock is information, not noise.
 * - Nothing here writes to a factory. `describeFactoryWriteBack` returns a
 *   refusal object; there is no code path that submits.
 * - An exception (delay, shortage) must name an owner and cite the facts
 *   that produced it. An exception nobody owns is a notification.
 */

export const SUPPLIER_FACT_KINDS = [
  "material_availability",
  "trim_availability",
  "lead_time_days",
  "minimum_order_quantity",
  "price_minor_units",
  "discontinued",
] as const;
export type SupplierFactKind = (typeof SUPPLIER_FACT_KINDS)[number];

export interface SupplierFact {
  readonly kind: SupplierFactKind;
  readonly supplierKey: string;
  readonly materialKey: string;
  readonly value: string;
  /** Which registered authority asserted this. */
  readonly sourceAuthorityKey: string;
  readonly observedAt: string;
  /** Version of the supplier feed/document this came from. */
  readonly sourceVersion: string;
}

export type SupplierFactResolution =
  | {
      readonly ok: true;
      readonly fact: SupplierFact;
      readonly stale: boolean;
      readonly ageHours: number;
    }
  | {
      readonly ok: false;
      readonly reason: "no_fact" | "unknown_authority" | "authority_conflict";
      readonly conflicting?: readonly SupplierFact[];
    };

const DEFAULT_STALENESS_HOURS = 72;

/**
 * Resolves one supplier fact. Three refusals matter more than the happy
 * path:
 *
 * - An unregistered authority is refused outright. "Someone emailed us a
 *   spreadsheet" is not a source, and treating it as one is exactly the
 *   invented supplier data the non-goal forbids.
 * - Two registered authorities disagreeing returns `authority_conflict`
 *   with both facts attached, rather than quietly preferring the newer.
 *   Which supplier is right is a human question with commercial
 *   consequences.
 * - A fact older than the staleness window is returned but flagged, never
 *   silently presented as current.
 */
export function resolveSupplierFact(args: {
  readonly facts: readonly SupplierFact[];
  readonly kind: SupplierFactKind;
  readonly materialKey: string;
  readonly registeredAuthorityKeys: readonly string[];
  readonly asOf: string;
  readonly stalenessHours?: number;
}): SupplierFactResolution {
  const candidates = args.facts.filter(
    (fact) => fact.kind === args.kind && fact.materialKey === args.materialKey,
  );
  if (candidates.length === 0) return { ok: false, reason: "no_fact" };

  const registered = candidates.filter((fact) =>
    args.registeredAuthorityKeys.includes(fact.sourceAuthorityKey),
  );
  if (registered.length === 0)
    return { ok: false, reason: "unknown_authority" };

  const distinctValues = new Set(registered.map((fact) => fact.value));
  const distinctAuthorities = new Set(
    registered.map((fact) => fact.sourceAuthorityKey),
  );
  if (distinctValues.size > 1 && distinctAuthorities.size > 1) {
    return {
      ok: false,
      reason: "authority_conflict",
      conflicting: [...registered].sort((a, b) =>
        a.sourceAuthorityKey.localeCompare(b.sourceAuthorityKey),
      ),
    };
  }

  const newest = [...registered].sort(
    (a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt),
  )[0]!;
  const ageHours =
    (Date.parse(args.asOf) - Date.parse(newest.observedAt)) / (1000 * 60 * 60);
  return {
    ok: true,
    fact: newest,
    stale: ageHours > (args.stalenessHours ?? DEFAULT_STALENESS_HOURS),
    ageHours: Number(ageHours.toFixed(2)),
  };
}

export interface FabricButtonRule {
  readonly fabricKey: string;
  readonly allowedButtonKeys: readonly string[];
  readonly note: string;
}

export type PairingCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: "no_rule_for_fabric" | "pairing_not_allowed";
      readonly allowedButtonKeys?: readonly string[];
      readonly note?: string;
    };

/**
 * Fabric/button pairing. A missing rule is `no_rule_for_fabric`, NOT
 * "allowed" — an unruled fabric means nobody has decided yet, and
 * defaulting to permissive turns silence into approval.
 */
export function checkFabricButtonPairing(args: {
  readonly rules: readonly FabricButtonRule[];
  readonly fabricKey: string;
  readonly buttonKey: string;
}): PairingCheck {
  const rule = args.rules.find((entry) => entry.fabricKey === args.fabricKey);
  if (!rule) return { ok: false, reason: "no_rule_for_fabric" };
  if (!rule.allowedButtonKeys.includes(args.buttonKey)) {
    return {
      ok: false,
      reason: "pairing_not_allowed",
      allowedButtonKeys: rule.allowedButtonKeys,
      note: rule.note,
    };
  }
  return { ok: true };
}

export const SUPPLY_EXCEPTION_KINDS = [
  "order_overdue",
  "material_shortage",
  "material_discontinued",
  "lead_time_increased",
] as const;
export type SupplyExceptionKind = (typeof SUPPLY_EXCEPTION_KINDS)[number];

export interface SupplyException {
  readonly kind: SupplyExceptionKind;
  readonly materialKey: string;
  readonly ownerStaffId: string;
  readonly detail: string;
  /** The facts that produced it. Never empty. */
  readonly citations: readonly {
    readonly sourceAuthorityKey: string;
    readonly sourceVersion: string;
    readonly observedAt: string;
  }[];
}

export type ExceptionCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        "owner_required" | "citation_required" | "detail_required";
    };

/**
 * An exception must name a human owner and cite the facts behind it. An
 * unowned exception is a notification, and an uncited one is the black box
 * this item's non-goal names directly.
 */
export function checkSupplyException(
  exception: Omit<SupplyException, "kind"> & {
    readonly kind: SupplyExceptionKind;
  },
): ExceptionCheck {
  if (exception.ownerStaffId.trim().length === 0) {
    return { ok: false, reason: "owner_required" };
  }
  if (exception.citations.length === 0) {
    return { ok: false, reason: "citation_required" };
  }
  if (exception.detail.trim().length < 10) {
    return { ok: false, reason: "detail_required" };
  }
  return { ok: true };
}

export const COMPLAINT_STATES = [
  "raised",
  "investigating",
  "supplier_notified",
  "customer_recovered",
  "closed",
] as const;
export type ComplaintState = (typeof COMPLAINT_STATES)[number];

const COMPLAINT_GRAPH: Readonly<
  Record<ComplaintState, readonly ComplaintState[]>
> = {
  raised: ["investigating"],
  investigating: ["supplier_notified", "customer_recovered"],
  supplier_notified: ["customer_recovered"],
  customer_recovered: ["closed"],
  closed: [],
};

export type ComplaintCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "transition_not_allowed"
        | "evidence_required"
        | "close_requires_outcome"
        | "close_requires_customer_recovery";
    };

/**
 * A complaint closes only after the customer has actually been recovered.
 * The graph makes `closed` reachable from exactly one state, so a supplier
 * credit alone cannot close a case — the customer is not the supplier's
 * accounting entry.
 */
export function checkComplaintTransition(args: {
  readonly from: ComplaintState;
  readonly to: ComplaintState;
  readonly evidenceRefs?: readonly string[];
  readonly outcomeNote?: string;
}): ComplaintCheck {
  if (!COMPLAINT_GRAPH[args.from].includes(args.to)) {
    if (args.to === "closed") {
      return { ok: false, reason: "close_requires_customer_recovery" };
    }
    return { ok: false, reason: "transition_not_allowed" };
  }
  if (
    args.to === "supplier_notified" &&
    (args.evidenceRefs ?? []).length === 0
  ) {
    // Telling a supplier their work was defective without attaching what
    // you saw is a claim, not a case.
    return { ok: false, reason: "evidence_required" };
  }
  if (args.to === "closed" && (args.outcomeNote ?? "").trim().length === 0) {
    return { ok: false, reason: "close_requires_outcome" };
  }
  return { ok: true };
}

/**
 * Factory write-back. There is no implementation and there should not be
 * one until a documented API exists — the non-goal says "no undocumented
 * factory write-back" and the honest form of that is a function that
 * returns why it will not, rather than a TODO somebody later fills in.
 */
export function describeFactoryWriteBack(): {
  readonly supported: false;
  readonly reason: string;
} {
  return {
    supported: false,
    reason:
      "No documented supplier write-back API is available. Submission stays " +
      "manual and is recorded as an outbound task, not as an automated push.",
  };
}
