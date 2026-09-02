import {
  asId,
  type CustomerId,
  type PaidCareBooking,
  type PaidCareBookingId,
  type PaidCareBookingStatus,
  type PaidCareFulfilmentMethod,
  type PaidCarePaymentChoice,
  type PaidCarePaymentStatus,
  type PaidCarePricingStatus,
  type PaidCareServiceKind,
  type PaidCareServicePrice,
  type PricedPaidCareServiceKind,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type PriceRow = Database["public"]["Tables"]["paid_care_service_prices"]["Row"];
type BookingRow = Database["public"]["Tables"]["paid_care_bookings"]["Row"];

function toPrice(row: PriceRow): PaidCareServicePrice {
  return {
    id: asId<"PaidCareServicePriceId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    serviceKind: row.service_kind as PricedPaidCareServiceKind,
    operationCode: row.operation_code,
    label: row.label,
    amountMinorUnits: row.amount_minor_units,
    currency: row.currency,
    displayOrder: row.display_order,
    active: row.active,
  };
}

function toBooking(row: BookingRow): PaidCareBooking {
  return {
    id: asId<"PaidCareBookingId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    serviceKind: row.service_kind as PaidCareServiceKind,
    garmentDescription: row.garment_description,
    quantity: row.quantity,
    ...(row.operation_code ? { operationCode: row.operation_code } : {}),
    ...(row.operation_label ? { operationLabel: row.operation_label } : {}),
    ...(row.unit_amount_minor_units !== null
      ? { unitAmountMinorUnits: row.unit_amount_minor_units }
      : {}),
    ...(row.total_amount_minor_units !== null
      ? { totalAmountMinorUnits: row.total_amount_minor_units }
      : {}),
    ...(row.currency ? { currency: row.currency } : {}),
    pricingStatus: row.pricing_status as PaidCarePricingStatus,
    pickupMethod: row.pickup_method as PaidCareFulfilmentMethod,
    returnMethod: row.return_method as PaidCareFulfilmentMethod,
    ...(row.preferred_window ? { preferredWindow: row.preferred_window } : {}),
    ...(row.notes ? { notes: row.notes } : {}),
    paymentChoice: row.payment_choice as PaidCarePaymentChoice,
    paymentStatus: row.payment_status as PaidCarePaymentStatus,
    status: row.status as PaidCareBookingStatus,
    ...(row.qr_token ? { qrToken: row.qr_token } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PaidCareServicePriceRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findForRetailer(
    retailerId: RetailerId,
    serviceKind: PricedPaidCareServiceKind,
  ): Promise<PaidCareServicePrice[]> {
    const { data, error } = await this.client
      .from("paid_care_service_prices")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("service_kind", serviceKind)
      .eq("active", true)
      .is("deleted_at", null)
      .order("display_order", { ascending: true });
    if (error) throw error;
    return data.map(toPrice);
  }
}

export interface CreatePaidCareBookingInput {
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
  readonly qrToken?: string;
}

export class PaidCareBookingRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async create(input: CreatePaidCareBookingInput): Promise<PaidCareBooking> {
    const { data, error } = await this.client
      .from("paid_care_bookings")
      .insert({
        retailer_id: input.retailerId,
        customer_id: input.customerId,
        service_kind: input.serviceKind,
        garment_description: input.garmentDescription,
        quantity: input.quantity,
        operation_code: input.operationCode ?? null,
        operation_label: input.operationLabel ?? null,
        unit_amount_minor_units: input.unitAmountMinorUnits ?? null,
        total_amount_minor_units: input.totalAmountMinorUnits ?? null,
        currency: input.currency ?? null,
        pricing_status: input.pricingStatus,
        pickup_method: input.pickupMethod,
        return_method: input.returnMethod,
        preferred_window: input.preferredWindow ?? null,
        notes: input.notes ?? null,
        payment_choice: input.paymentChoice,
        payment_status: input.paymentStatus,
        qr_token: input.qrToken ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toBooking(data);
  }

  async findByCustomer(customerId: CustomerId): Promise<PaidCareBooking[]> {
    const { data, error } = await this.client
      .from("paid_care_bookings")
      .select("*")
      .eq("customer_id", customerId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toBooking);
  }

  async findByQrToken(qrToken: string): Promise<PaidCareBooking | null> {
    const { data, error } = await this.client
      .from("paid_care_bookings")
      .select("*")
      .eq("qr_token", qrToken)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return data ? toBooking(data) : null;
  }

  async findById(id: PaidCareBookingId): Promise<PaidCareBooking | null> {
    const { data, error } = await this.client
      .from("paid_care_bookings")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return data ? toBooking(data) : null;
  }
}
