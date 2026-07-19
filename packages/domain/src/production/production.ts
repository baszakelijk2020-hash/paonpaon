import type {
  AlterationId,
  AlterationUpdateId,
  AppointmentId,
  CustomerId,
  OrderLineId,
  ProductionOrderId,
  RetailerId,
  StaffId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

export type ProductionStage =
  "queued" | "cutting" | "sewing" | "finishing" | "quality_check" | "complete";

/** Tracks manufacturing of one made-to-order OrderLine. */
export interface ProductionOrder extends Timestamps {
  readonly id: ProductionOrderId;
  readonly retailerId: RetailerId;
  readonly orderLineId: OrderLineId;
  readonly stage: ProductionStage;
  readonly workshopReference?: string;
  readonly estimatedCompletionDate?: string;
  readonly actualCompletionDate?: string;
}

export type AlterationStatus =
  | "requested"
  | "measured"
  | "in_progress"
  | "ready_for_fitting"
  | "ready_for_pickup"
  | "complete";

/**
 * Tracks a fit alteration, either on a new OrderLine or a past purchase.
 * `customerId` is required (not derived transitively through
 * `orderLineId`) because an alteration on a past purchase may exist with
 * no `orderLineId` at all (see docs/DOMAIN_MODEL.md "Order vs.
 * Production vs. Alteration") — there must always be a direct way to
 * know whose alteration this is.
 */
export interface Alteration extends Timestamps {
  readonly id: AlterationId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly orderLineId?: OrderLineId;
  readonly status: AlterationStatus;
  readonly tailorReference?: string;
  readonly instructions: string;
  readonly appointmentIdForFitting?: AppointmentId;
  readonly dueDate?: string;
}

/**
 * An append-only note/status entry on an Alteration — how a customer
 * "sees updates" (docs/PRODUCT.md "Customer Portal" > Alteration
 * tracking) and how retailer staff record what happened at each step,
 * without needing a separate revision-history mechanism bolted onto
 * `Alteration` itself.
 */
export interface AlterationUpdate {
  readonly id: AlterationUpdateId;
  readonly alterationId: AlterationId;
  readonly retailerId: RetailerId;
  readonly status: AlterationStatus;
  readonly note?: string;
  readonly staffId?: StaffId;
  readonly createdAt: string;
}
