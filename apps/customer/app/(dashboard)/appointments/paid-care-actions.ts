"use server";

import { randomUUID } from "node:crypto";

import {
  AlterationCatalogueRepository,
  CustomerRepository,
  PaidCareBookingRepository,
  PaidCareServicePriceRepository,
} from "@paon/database";
import {
  asId,
  totalPaidCareAmountMinorUnits,
  type PaidCareFulfilmentMethod,
  type PaidCarePaymentChoice,
  type PaidCareServiceKind,
} from "@paon/domain";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface PaidCareBookingState {
  fieldErrors: Record<string, string>;
  formError?: string;
  success?: boolean;
  bookingId?: string;
  qrDataUrl?: string;
  totalLabel?: string;
}

const schema = z.object({
  retailerId: z.string().uuid(),
  serviceKind: z.enum(["dry_cleaning", "shoe_repair", "alteration"]),
  garmentDescription: z.string().trim().min(1).max(500),
  quantity: z.coerce.number().int().min(1).max(50),
  operationCode: z.string().optional(),
  pickupMethod: z.enum(["home", "office", "store"]),
  returnMethod: z.enum(["home", "office", "store"]),
  paymentChoice: z.enum(["pay_now", "pay_at_pickup"]),
  notes: z.string().trim().max(1000).optional(),
});

/**
 * My Appointments' paid-care flow (contract §6.1). Price is always
 * re-derived server-side from the real seeded price list (dry-cleaning/
 * shoe-repair) or the real alteration catalogue — never trusted from the
 * client. "Pay now" produces a `demo_authorized` payment status: a real,
 * complete interface with no live processor behind it yet (founder
 * direction, 2026-08-25) — it is never presented as a completed charge,
 * only as "authorized in this demo environment."
 */
export async function createPaidCareBooking(
  _prevState: PaidCareBookingState,
  formData: FormData,
): Promise<PaidCareBookingState> {
  const session = await requireSession();
  const parsed = schema.safeParse({
    retailerId: formData.get("retailerId"),
    serviceKind: formData.get("serviceKind"),
    garmentDescription: formData.get("garmentDescription"),
    quantity: formData.get("quantity"),
    operationCode: formData.get("operationCode") || undefined,
    pickupMethod: formData.get("pickupMethod"),
    returnMethod: formData.get("returnMethod"),
    paymentChoice: formData.get("paymentChoice"),
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join(".") || "form"] ??= issue.message;
    }
    return { fieldErrors };
  }

  const supabase = await getSupabaseServerClient();
  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const customer = customers.find(
    (candidate) => candidate.retailerId === parsed.data.retailerId,
  );
  if (!customer) {
    return {
      fieldErrors: {},
      formError: "No relationship with this retailer.",
    };
  }

  const retailerId = asId<"RetailerId">(parsed.data.retailerId);
  const serviceKind = parsed.data.serviceKind as PaidCareServiceKind;

  let operationLabel: string | undefined;
  let unitAmountMinorUnits: number | undefined;
  let currency: string | undefined;
  let pricingStatus: "priced" | "confirmed_by_advisor" = "confirmed_by_advisor";

  if (serviceKind === "dry_cleaning" || serviceKind === "shoe_repair") {
    if (!parsed.data.operationCode) {
      return { fieldErrors: { operationCode: "Choose an operation." } };
    }
    const prices = await new PaidCareServicePriceRepository(
      supabase,
    ).findForRetailer(retailerId, serviceKind);
    const match = prices.find(
      (price) => price.operationCode === parsed.data.operationCode,
    );
    if (!match) {
      return {
        fieldErrors: {},
        formError: "That price is no longer available.",
      };
    }
    operationLabel = match.label;
    unitAmountMinorUnits = match.amountMinorUnits;
    currency = match.currency;
    pricingStatus = "priced";
  } else {
    if (parsed.data.operationCode) {
      const catalogue = await new AlterationCatalogueRepository(
        supabase,
      ).findForRetailer(retailerId);
      const operation = catalogue.operations.find(
        (op) => op.code === parsed.data.operationCode,
      );
      if (operation?.effectivePrice) {
        operationLabel = operation.name;
        unitAmountMinorUnits = operation.effectivePrice.amountMinorUnits;
        currency = operation.effectivePrice.currency;
        pricingStatus = "priced";
      }
    }
  }

  const totalAmountMinorUnits =
    unitAmountMinorUnits !== undefined
      ? totalPaidCareAmountMinorUnits({
          unitAmountMinorUnits,
          quantity: parsed.data.quantity,
        })
      : undefined;

  const paymentChoice = parsed.data.paymentChoice as PaidCarePaymentChoice;
  const returnMethod = parsed.data.returnMethod as PaidCareFulfilmentMethod;
  const paymentStatus =
    paymentChoice === "pay_now" ? "demo_authorized" : "due_at_pickup";
  const qrToken = returnMethod === "store" ? randomUUID() : undefined;

  try {
    const booking = await new PaidCareBookingRepository(supabase).create({
      retailerId,
      customerId: customer.id,
      serviceKind,
      garmentDescription: parsed.data.garmentDescription,
      quantity: parsed.data.quantity,
      ...(parsed.data.operationCode
        ? { operationCode: parsed.data.operationCode }
        : {}),
      ...(operationLabel ? { operationLabel } : {}),
      ...(unitAmountMinorUnits !== undefined ? { unitAmountMinorUnits } : {}),
      ...(totalAmountMinorUnits !== undefined ? { totalAmountMinorUnits } : {}),
      ...(currency ? { currency } : {}),
      pricingStatus,
      pickupMethod: parsed.data.pickupMethod as PaidCareFulfilmentMethod,
      returnMethod,
      ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
      paymentChoice,
      paymentStatus,
      ...(qrToken ? { qrToken } : {}),
    });

    let qrDataUrl: string | undefined;
    if (qrToken) {
      const QRCode = await import("qrcode");
      qrDataUrl = await QRCode.toDataURL(qrToken, { margin: 1, width: 240 });
    }

    revalidatePath("/appointments");
    return {
      fieldErrors: {},
      success: true,
      bookingId: booking.id,
      ...(qrDataUrl ? { qrDataUrl } : {}),
      ...(totalAmountMinorUnits !== undefined && currency
        ? {
            totalLabel: new Intl.NumberFormat("en-GB", {
              style: "currency",
              currency,
            }).format(totalAmountMinorUnits / 100),
          }
        : {}),
    };
  } catch (error) {
    return {
      fieldErrors: {},
      formError:
        error instanceof Error ? error.message : "Could not book this service.",
    };
  }
}
