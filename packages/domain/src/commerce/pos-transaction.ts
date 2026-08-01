/**
 * Omnichannel POS, mixed carts and returns (PHASE 13.3).
 *
 * Three things this module refuses to do, each because the alternative
 * quietly breaks something later:
 *
 * 1. It never stores or accepts a card number, PAN fragment or CVC. There
 *    is no field for one. A payment is a *provider reference* — an opaque
 *    string from whoever actually took the money — and ADR-062 has not yet
 *    activated any provider, so `checkPaymentCapture` refuses until one is
 *    named as activated. The non-goal is "no raw card storage or custom
 *    lending"; the way to honour it is to have nowhere to put a card.
 * 2. It never deletes a sale line on return. A return is a new,
 *    linked transaction. Editing the original would erase the fact that a
 *    sale happened, which both the stock ledger and the accounts need.
 * 3. It never nets a mixed cart into one number. RTW, alteration service
 *    and MTM deposit behave differently on return — a service already
 *    performed is not refundable the way an unworn shirt is — so they stay
 *    separate lines with separate return rules.
 */

export const CART_LINE_KINDS = ["rtw", "alteration_service", "mtm"] as const;
export type CartLineKind = (typeof CART_LINE_KINDS)[number];

export interface CartLine {
  readonly lineId: string;
  readonly kind: CartLineKind;
  readonly variantId?: string;
  readonly quantity: number;
  readonly unitPriceMinorUnits: number;
  /** Only meaningful for `rtw`: services and MTM are not stock. */
  readonly reservesStock: boolean;
}

export interface CartTotals {
  readonly subtotalMinorUnits: number;
  /** Per kind, because a refund decision needs them apart. */
  readonly byKindMinorUnits: Readonly<Record<CartLineKind, number>>;
  readonly lineCount: number;
}

export function totalCart(lines: readonly CartLine[]): CartTotals {
  const byKind: Record<CartLineKind, number> = {
    rtw: 0,
    alteration_service: 0,
    mtm: 0,
  };
  let subtotal = 0;
  for (const line of lines) {
    const amount = line.unitPriceMinorUnits * line.quantity;
    subtotal += amount;
    byKind[line.kind] += amount;
  }
  return {
    subtotalMinorUnits: subtotal,
    byKindMinorUnits: byKind,
    lineCount: lines.length,
  };
}

export const TRANSACTION_STATES = [
  "open",
  "suspended",
  "quoted",
  "awaiting_payment",
  "completed",
  "voided",
] as const;
export type TransactionState = (typeof TRANSACTION_STATES)[number];

const TRANSACTION_GRAPH: Readonly<
  Record<TransactionState, readonly TransactionState[]>
> = {
  open: ["suspended", "quoted", "awaiting_payment", "voided"],
  suspended: ["open", "voided"],
  quoted: ["open", "awaiting_payment", "voided"],
  awaiting_payment: ["completed", "open", "voided"],
  completed: [],
  voided: [],
};

export type TransactionCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "transition_not_allowed"
        | "completed_is_final"
        | "void_requires_reason"
        | "empty_cart";
    };

/**
 * `completed` has no exits. A completed sale is never re-opened, voided or
 * edited — the correction is a return or an exchange, which is a new
 * linked transaction. This is what keeps stock and financial history
 * survivable, which is the item's own acceptance criterion.
 */
export function checkTransactionTransition(args: {
  readonly from: TransactionState;
  readonly to: TransactionState;
  readonly lineCount: number;
  readonly voidReason?: string;
}): TransactionCheck {
  if (args.from === "completed") {
    return { ok: false, reason: "completed_is_final" };
  }
  if (!TRANSACTION_GRAPH[args.from].includes(args.to)) {
    return { ok: false, reason: "transition_not_allowed" };
  }
  if (args.to === "voided" && (args.voidReason ?? "").trim().length === 0) {
    return { ok: false, reason: "void_requires_reason" };
  }
  if (
    (args.to === "awaiting_payment" || args.to === "quoted") &&
    args.lineCount === 0
  ) {
    return { ok: false, reason: "empty_cart" };
  }
  return { ok: true };
}

export type PaymentCaptureCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "provider_not_activated"
        | "provider_reference_required"
        | "amount_mismatch"
        | "card_data_not_accepted";
    };

/**
 * Records that a payment happened elsewhere. Refuses in four ways, and the
 * last one matters most: if a caller passes anything that looks like card
 * data, the whole capture is rejected rather than the field being dropped.
 * Silently discarding it would let a caller believe it was stored
 * somewhere, and encourage them to keep sending it.
 */
export function checkPaymentCapture(args: {
  readonly activatedProviders: readonly string[];
  readonly provider: string;
  readonly providerReference?: string;
  readonly capturedMinorUnits: number;
  readonly expectedMinorUnits: number;
  readonly rawFieldNames?: readonly string[];
}): PaymentCaptureCheck {
  const forbidden = /(^|_)(pan|card_number|cardnumber|cvc|cvv|track2)($|_)/i;
  if ((args.rawFieldNames ?? []).some((name) => forbidden.test(name))) {
    return { ok: false, reason: "card_data_not_accepted" };
  }
  if (!args.activatedProviders.includes(args.provider)) {
    // ADR-062 gates provider activation. An unactivated provider means the
    // money design for it has not been approved.
    return { ok: false, reason: "provider_not_activated" };
  }
  if (!args.providerReference || args.providerReference.trim().length === 0) {
    return { ok: false, reason: "provider_reference_required" };
  }
  if (args.capturedMinorUnits !== args.expectedMinorUnits) {
    return { ok: false, reason: "amount_mismatch" };
  }
  return { ok: true };
}

export type ReturnEligibility =
  | { readonly ok: true; readonly refundableMinorUnits: number }
  | {
      readonly ok: false;
      readonly reason:
        | "window_expired"
        | "service_already_performed"
        | "mtm_is_bespoke"
        | "already_returned"
        | "not_from_completed_sale";
    };

const RTW_RETURN_WINDOW_DAYS = 30;

/**
 * Return eligibility, per line, per kind.
 *
 * MTM is refused outright rather than given a shorter window: a garment
 * cut to one person's measurements has no second buyer, and a policy that
 * pretends otherwise creates a dispute at the worst possible moment. A
 * performed alteration is likewise not refundable — the labour happened —
 * though an unperformed one is.
 */
export function checkReturnEligibility(args: {
  readonly line: CartLine;
  readonly saleCompleted: boolean;
  readonly soldOn: string;
  readonly requestedOn: string;
  readonly servicePerformed?: boolean;
  readonly alreadyReturnedQuantity?: number;
}): ReturnEligibility {
  if (!args.saleCompleted) {
    return { ok: false, reason: "not_from_completed_sale" };
  }
  if ((args.alreadyReturnedQuantity ?? 0) >= args.line.quantity) {
    return { ok: false, reason: "already_returned" };
  }
  if (args.line.kind === "mtm") {
    return { ok: false, reason: "mtm_is_bespoke" };
  }
  if (args.line.kind === "alteration_service") {
    if (args.servicePerformed) {
      return { ok: false, reason: "service_already_performed" };
    }
    return {
      ok: true,
      refundableMinorUnits: args.line.unitPriceMinorUnits * args.line.quantity,
    };
  }
  const days = Math.floor(
    (Date.parse(args.requestedOn) - Date.parse(args.soldOn)) /
      (1000 * 60 * 60 * 24),
  );
  if (days > RTW_RETURN_WINDOW_DAYS) {
    return { ok: false, reason: "window_expired" };
  }
  const remaining = args.line.quantity - (args.alreadyReturnedQuantity ?? 0);
  return {
    ok: true,
    refundableMinorUnits: args.line.unitPriceMinorUnits * remaining,
  };
}

export interface ReturnLedgerPlan {
  /** Reversal entries for stock that physically comes back. Services and
   * MTM produce none — nothing returns to a shelf. */
  readonly restockLines: readonly {
    readonly variantId: string;
    readonly quantity: number;
  }[];
  readonly refundMinorUnits: number;
  /** Always true: a return is a new linked transaction, never an edit of
   * the original sale. */
  readonly createsLinkedTransaction: true;
}

export function planReturn(args: {
  readonly lines: readonly {
    readonly line: CartLine;
    readonly refundableMinorUnits: number;
    readonly restock: boolean;
  }[];
}): ReturnLedgerPlan {
  return {
    restockLines: args.lines
      .filter((entry) => entry.restock && entry.line.variantId)
      .map((entry) => ({
        variantId: entry.line.variantId!,
        quantity: entry.line.quantity,
      })),
    refundMinorUnits: args.lines.reduce(
      (total, entry) => total + entry.refundableMinorUnits,
      0,
    ),
    createsLinkedTransaction: true,
  };
}
