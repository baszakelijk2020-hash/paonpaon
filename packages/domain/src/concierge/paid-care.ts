/**
 * My Appointments paid-care services (Customer Environment Rebuild V3
 * §6.1): dry-cleaning pickup, shoe repair & maintenance, alteration.
 *
 * Deliberately separate from `concierge/service-plan.ts`'s
 * ServiceBooking — that model requires an active ServiceMembership
 * (a paid concierge plan). A paid-care booking here is pay-per-use with
 * no membership prerequisite.
 */

import type {
  CustomerId,
  PaidCareBookingId,
  PaidCareServicePriceId,
  RetailerId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

export const PAID_CARE_SERVICE_KINDS = [
  "dry_cleaning",
  "shoe_repair",
  "alteration",
] as const;

export type PaidCareServiceKind = (typeof PAID_CARE_SERVICE_KINDS)[number];

export const PAID_CARE_SERVICE_KIND_LABELS: Record<
  PaidCareServiceKind,
  string
> = {
  dry_cleaning: "Dry-cleaning pickup",
  shoe_repair: "Shoe repair & maintenance",
  alteration: "Alteration",
};

/** The two kinds this schema prices directly. Alteration reuses the
 * existing alteration catalogue/price list instead. */
export const PRICED_PAID_CARE_SERVICE_KINDS = [
  "dry_cleaning",
  "shoe_repair",
] as const;

export type PricedPaidCareServiceKind =
  (typeof PRICED_PAID_CARE_SERVICE_KINDS)[number];

export const PAID_CARE_FULFILMENT_METHODS = [
  "home",
  "office",
  "store",
] as const;
export type PaidCareFulfilmentMethod =
  (typeof PAID_CARE_FULFILMENT_METHODS)[number];

export const PAID_CARE_FULFILMENT_METHOD_LABELS: Record<
  PaidCareFulfilmentMethod,
  string
> = {
  home: "Home",
  office: "Office",
  store: "Store",
};

export const PAID_CARE_PAYMENT_CHOICES = ["pay_now", "pay_at_pickup"] as const;
export type PaidCarePaymentChoice = (typeof PAID_CARE_PAYMENT_CHOICES)[number];

export const PAID_CARE_PAYMENT_STATUSES = [
  "unpaid",
  "demo_authorized",
  "due_at_pickup",
] as const;
export type PaidCarePaymentStatus = (typeof PAID_CARE_PAYMENT_STATUSES)[number];

export const PAID_CARE_BOOKING_STATUSES = [
  "requested",
  "confirmed",
  "in_progress",
  "fulfilled",
  "canceled",
] as const;
export type PaidCareBookingStatus = (typeof PAID_CARE_BOOKING_STATUSES)[number];

export const PAID_CARE_PRICING_STATUSES = [
  "priced",
  "confirmed_by_advisor",
] as const;
export type PaidCarePricingStatus = (typeof PAID_CARE_PRICING_STATUSES)[number];

export const ALTERATION_BOOKING_BRANCHES = [
  "know_exactly_what_needs_changing",
  "ask_advisor_with_self_scan",
  "assess_in_store",
] as const;
export type AlterationBookingBranch =
  (typeof ALTERATION_BOOKING_BRANCHES)[number];

export interface PaidCareServicePrice {
  readonly id: PaidCareServicePriceId;
  readonly retailerId: RetailerId;
  readonly serviceKind: PricedPaidCareServiceKind;
  readonly operationCode: string;
  readonly label: string;
  readonly amountMinorUnits: number;
  readonly currency: string;
  readonly displayOrder: number;
  readonly active: boolean;
}

export interface PaidCareBooking extends Timestamps {
  readonly id: PaidCareBookingId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly serviceKind: PaidCareServiceKind;
  readonly garmentDescription: string;
  readonly quantity: number;
  readonly operationCode?: string;
  readonly operationLabel?: string;
  readonly unitAmountMinorUnits?: number;
  readonly totalAmountMinorUnits?: number;
  readonly currency?: string;
  readonly pricingStatus: PaidCarePricingStatus;
  readonly pickupMethod: PaidCareFulfilmentMethod;
  readonly returnMethod: PaidCareFulfilmentMethod;
  readonly preferredWindow?: string;
  readonly notes?: string;
  readonly paymentChoice: PaidCarePaymentChoice;
  readonly paymentStatus: PaidCarePaymentStatus;
  readonly status: PaidCareBookingStatus;
  readonly qrToken?: string;
}

/** QR receipts exist only for store pickup (contract §6.1) — home/office
 * confirmations never carry one. */
export function paidCareBookingQualifiesForQr(params: {
  readonly returnMethod: PaidCareFulfilmentMethod;
}): boolean {
  return params.returnMethod === "store";
}

export function totalPaidCareAmountMinorUnits(params: {
  readonly unitAmountMinorUnits: number;
  readonly quantity: number;
}): number {
  return params.unitAmountMinorUnits * params.quantity;
}
