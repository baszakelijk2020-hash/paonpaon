import type { Money } from "@paon/domain";

/** The one place Money is rendered as a display string across all three apps. */
export function formatMoney(money: Money, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: money.currency,
  }).format(money.amountMinorUnits / 100);
}
