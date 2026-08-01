/**
 * Append-only stock ledger (INV-101 / INV-102 / PHASE 13.1).
 *
 * There is no balance to edit. A balance is a projection over an
 * append-only entry list, which is why "without silent balance edits" is
 * achievable at all: the only way to change a number is to add an entry
 * that says who changed it, by how much and why, and the only way to undo
 * one is a reversal entry citing the original.
 *
 * `projectBalance` is the single definition of on-hand, reserved and
 * available. Anything that computes availability differently — a cached
 * column, a POS-local counter — is a second truth and will eventually
 * oversell.
 */

export const LEDGER_ENTRY_KINDS = [
  "receipt",
  "sale",
  "reservation",
  "reservation_release",
  "transfer_out",
  "transfer_in",
  "count_adjustment",
  "reversal",
] as const;
export type LedgerEntryKind = (typeof LEDGER_ENTRY_KINDS)[number];

export interface LedgerEntry {
  readonly entryId: string;
  readonly variantId: string;
  readonly locationId: string;
  readonly kind: LedgerEntryKind;
  /** Signed. Positive adds to the pool the kind affects, negative removes. */
  readonly quantity: number;
  readonly occurredAt: string;
  /** Set on `reversal`; names the entry being undone. */
  readonly reversesEntryId?: string;
  /** Caller-supplied dedupe key. Two entries with the same key are the
   * same event delivered twice, not two events. */
  readonly idempotencyKey?: string;
}

export interface StockBalance {
  readonly onHand: number;
  readonly reserved: number;
  /** onHand - reserved. Never negative in a consistent ledger; if it is,
   * something oversold and the caller needs to know rather than see a
   * clamped zero. */
  readonly available: number;
}

/**
 * Kinds that move physical stock, and their sign. A reservation does not
 * appear here: reserving does not move a garment, it promises one.
 */
const ON_HAND_SIGN: Partial<Record<LedgerEntryKind, number>> = {
  receipt: 1,
  transfer_in: 1,
  sale: -1,
  transfer_out: -1,
  count_adjustment: 1,
};

const RESERVED_SIGN: Partial<Record<LedgerEntryKind, number>> = {
  reservation: 1,
  reservation_release: -1,
};

/**
 * Projects a balance. Reversals are applied by inverting the entry they
 * cite, so a reversal cannot be mis-signed by the caller: the ledger knows
 * what it is undoing.
 *
 * Duplicate idempotency keys are collapsed here as well as at the write
 * boundary. Deduping only on write means a replayed webhook that arrives
 * during a network partition silently double-counts.
 */
export function projectBalance(entries: readonly LedgerEntry[]): StockBalance {
  const byId = new Map(entries.map((entry) => [entry.entryId, entry]));
  const seenKeys = new Set<string>();
  let onHand = 0;
  let reserved = 0;

  for (const entry of entries) {
    if (entry.idempotencyKey) {
      if (seenKeys.has(entry.idempotencyKey)) continue;
      seenKeys.add(entry.idempotencyKey);
    }
    if (entry.kind === "reversal") {
      const original = entry.reversesEntryId
        ? byId.get(entry.reversesEntryId)
        : undefined;
      if (!original) continue;
      onHand -= (ON_HAND_SIGN[original.kind] ?? 0) * original.quantity;
      reserved -= (RESERVED_SIGN[original.kind] ?? 0) * original.quantity;
      continue;
    }
    // A reversed entry is still applied here and then subtracted by its
    // reversal, rather than being skipped. That keeps the ledger a literal
    // running total of what was recorded, so replaying it line by line
    // while debugging a variance shows the mistake AND the correction
    // instead of quietly hiding both.
    onHand += (ON_HAND_SIGN[entry.kind] ?? 0) * entry.quantity;
    reserved += (RESERVED_SIGN[entry.kind] ?? 0) * entry.quantity;
  }

  return { onHand, reserved, available: onHand - reserved };
}

export type ReservationCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: "insufficient_available" | "quantity_not_positive";
      readonly available?: number;
    };

/**
 * The oversell guard. Checks against *available*, not on-hand: two
 * customers reserving the last jacket is the failure mode, and on-hand
 * says yes to both.
 */
export function checkReservation(args: {
  readonly balance: StockBalance;
  readonly requestedQuantity: number;
}): ReservationCheck {
  if (
    !Number.isInteger(args.requestedQuantity) ||
    args.requestedQuantity <= 0
  ) {
    return { ok: false, reason: "quantity_not_positive" };
  }
  if (args.requestedQuantity > args.balance.available) {
    return {
      ok: false,
      reason: "insufficient_available",
      available: args.balance.available,
    };
  }
  return { ok: true };
}

export const SCAN_MODES = [
  "receiving",
  "transfer_out",
  "count",
  "lookup",
] as const;
export type ScanMode = (typeof SCAN_MODES)[number];

export type ScanResolution =
  | {
      readonly ok: true;
      readonly variantId: string;
      readonly writes: boolean;
    }
  | {
      readonly ok: false;
      readonly reason: "unknown_barcode" | "mode_requires_open_session";
    };

/**
 * Resolves a scan. `lookup` never writes — the mode exists so that
 * checking what something is cannot accidentally receive it, which is the
 * classic warehouse scanner mistake.
 */
export function resolveScan(args: {
  readonly barcode: string;
  readonly mode: ScanMode;
  readonly barcodeToVariant: ReadonlyMap<string, string>;
  readonly hasOpenSession: boolean;
}): ScanResolution {
  const variantId = args.barcodeToVariant.get(args.barcode.trim());
  if (!variantId) return { ok: false, reason: "unknown_barcode" };
  if (args.mode === "lookup") return { ok: true, variantId, writes: false };
  if (!args.hasOpenSession) {
    return { ok: false, reason: "mode_requires_open_session" };
  }
  return { ok: true, variantId, writes: true };
}

export interface CountLine {
  readonly variantId: string;
  readonly countedQuantity: number;
}

export interface CountVariance {
  readonly variantId: string;
  readonly expectedQuantity: number;
  readonly countedQuantity: number;
  readonly varianceQuantity: number;
  readonly requiresRecount: boolean;
}

export interface CountReconciliation {
  readonly variances: readonly CountVariance[];
  readonly recountRequired: boolean;
  /** Variants the counter never scanned. Absent from a blind count is not
   * the same as counted-as-zero, and treating it as zero would write off
   * stock nobody looked for. */
  readonly uncountedVariantIds: readonly string[];
}

const RECOUNT_ABSOLUTE_THRESHOLD = 2;
const RECOUNT_RELATIVE_THRESHOLD = 0.1;

/**
 * Reconciles a blind count against the ledger projection. Produces
 * variances only — it writes nothing. Posting a count directly to a
 * balance is exactly the silent edit this item forbids; the adjustment is
 * a separate, reasoned entry a human makes after seeing this.
 */
export function reconcileBlindCount(args: {
  readonly expected: ReadonlyMap<string, number>;
  readonly counted: readonly CountLine[];
}): CountReconciliation {
  const countedByVariant = new Map(
    args.counted.map((line) => [line.variantId, line.countedQuantity]),
  );
  const variances: CountVariance[] = [];

  for (const [variantId, countedQuantity] of countedByVariant) {
    const expectedQuantity = args.expected.get(variantId) ?? 0;
    const varianceQuantity = countedQuantity - expectedQuantity;
    if (varianceQuantity === 0) continue;
    const magnitude = Math.abs(varianceQuantity);
    variances.push({
      variantId,
      expectedQuantity,
      countedQuantity,
      varianceQuantity,
      requiresRecount:
        magnitude >= RECOUNT_ABSOLUTE_THRESHOLD ||
        (expectedQuantity > 0 &&
          magnitude / expectedQuantity >= RECOUNT_RELATIVE_THRESHOLD),
    });
  }

  const uncountedVariantIds = [...args.expected.keys()]
    .filter((variantId) => !countedByVariant.has(variantId))
    .sort();

  return {
    variances: variances.sort((a, b) => a.variantId.localeCompare(b.variantId)),
    recountRequired: variances.some((variance) => variance.requiresRecount),
    uncountedVariantIds,
  };
}

export type AdjustmentCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "reason_required"
        | "recount_outstanding"
        | "no_count_session"
        | "adjustment_exceeds_variance";
    };

/**
 * An adjustment must come from a count session, must not exceed what the
 * count actually found, and must say why. The third condition is what
 * makes shrinkage analysable later instead of being a pile of unexplained
 * corrections.
 */
export function checkCountAdjustment(args: {
  readonly countSessionId?: string;
  readonly variance?: CountVariance;
  readonly adjustmentQuantity: number;
  readonly reason: string;
  readonly recountOutstanding: boolean;
}): AdjustmentCheck {
  if (!args.countSessionId) return { ok: false, reason: "no_count_session" };
  if (args.recountOutstanding) {
    return { ok: false, reason: "recount_outstanding" };
  }
  if (args.reason.trim().length < 5) {
    return { ok: false, reason: "reason_required" };
  }
  if (
    args.variance &&
    Math.abs(args.adjustmentQuantity) > Math.abs(args.variance.varianceQuantity)
  ) {
    return { ok: false, reason: "adjustment_exceeds_variance" };
  }
  return { ok: true };
}

export type TransferCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        "same_location" | "insufficient_available" | "quantity_not_positive";
    };

/**
 * A transfer is two entries, not one: `transfer_out` at the origin and
 * `transfer_in` at the destination. Modelling it as a single "move" row
 * makes in-transit stock invisible — it has left one shop and not arrived
 * at the other, and both facts are true at once.
 */
export function checkTransfer(args: {
  readonly fromLocationId: string;
  readonly toLocationId: string;
  readonly quantity: number;
  readonly originBalance: StockBalance;
}): TransferCheck {
  if (args.fromLocationId === args.toLocationId) {
    return { ok: false, reason: "same_location" };
  }
  if (!Number.isInteger(args.quantity) || args.quantity <= 0) {
    return { ok: false, reason: "quantity_not_positive" };
  }
  if (args.quantity > args.originBalance.available) {
    return { ok: false, reason: "insufficient_available" };
  }
  return { ok: true };
}
