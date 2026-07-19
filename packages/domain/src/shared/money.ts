/**
 * Money is always an integer minor-unit amount (cents) plus an ISO 4217
 * currency code. Never a float. Retailers in this domain operate across
 * currencies, and float arithmetic on money is a defect class we forbid
 * by construction.
 */
export interface Money {
  readonly amountMinorUnits: number;
  readonly currency: CurrencyCode;
}

export type CurrencyCode =
  "USD" | "EUR" | "GBP" | "CHF" | "JPY" | "AED" | "HKD" | "SGD";

export function money(amountMinorUnits: number, currency: CurrencyCode): Money {
  return { amountMinorUnits, currency };
}

export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot add ${a.currency} to ${b.currency}`);
  }
  return money(a.amountMinorUnits + b.amountMinorUnits, a.currency);
}
