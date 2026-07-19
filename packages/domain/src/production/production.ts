import type {
  AlterationId,
  OrderLineId,
  ProductionOrderId,
  RetailerId,
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
  "requested" | "measured" | "in_progress" | "ready_for_fitting" | "complete";

/** Tracks a fit alteration, either on a new OrderLine or a past purchase. */
export interface Alteration extends Timestamps {
  readonly id: AlterationId;
  readonly retailerId: RetailerId;
  readonly orderLineId?: OrderLineId;
  readonly status: AlterationStatus;
  readonly tailorReference?: string;
  readonly instructions: string;
  readonly appointmentIdForFitting?: string;
  readonly dueDate?: string;
}
