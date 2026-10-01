import type { PricedOperation } from "./paid-care-flow";

export const ALTERATION_PRICE_MENU: readonly PricedOperation[] = [
  {
    code: "alteration-trouser-hems",
    label: "Trouser hems",
    amountMinorUnits: 2500,
    currency: "EUR",
  },
  {
    code: "alteration-trouser-waist",
    label: "Trouser waist adjustment",
    amountMinorUnits: 3500,
    currency: "EUR",
  },
  {
    code: "alteration-jacket-sleeves",
    label: "Jacket sleeve length",
    amountMinorUnits: 4500,
    currency: "EUR",
  },
  {
    code: "alteration-jacket-waist",
    label: "Jacket waist adjustment",
    amountMinorUnits: 5500,
    currency: "EUR",
  },
  {
    code: "alteration-shirt-sleeves",
    label: "Shirt sleeve length",
    amountMinorUnits: 3000,
    currency: "EUR",
  },
  {
    code: "alteration-zip",
    label: "Zip replacement",
    amountMinorUnits: 2800,
    currency: "EUR",
  },
];
