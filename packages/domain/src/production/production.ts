import type { RetailerRole } from "../identity/role";
import type { Address } from "../shared/address";
import type {
  AlterationAttachmentId,
  AlterationCategoryId,
  AlterationId,
  AlterationOperationId,
  AlterationPriceListId,
  AlterationStatusHistoryId,
  AlterationTaskId,
  AlterationTaskNoteId,
  AppointmentId,
  ChainOfCustodyEventId,
  CompletionReviewId,
  CustomerId,
  FittingObservationId,
  FittingSessionId,
  FulfillmentEventId,
  OrderLineId,
  PhysicalGarmentId,
  PriceChangeProposalId,
  ProductionOrderId,
  RetailerId,
  StaffId,
  WorkshopId,
  WorkOrderAssignmentId,
} from "../shared/branded-id";
import type { Money } from "../shared/money";
import type { Timestamps } from "../shared/timestamps";

export type ProductionStage =
  "queued" | "cutting" | "sewing" | "finishing" | "quality_check" | "complete";

/** GoCreate remains authoritative for manufacturing; this is connector-facing status only. */
export interface ProductionOrder extends Timestamps {
  readonly id: ProductionOrderId;
  readonly retailerId: RetailerId;
  readonly orderLineId: OrderLineId;
  readonly stage: ProductionStage;
  readonly workshopReference?: string;
  readonly estimatedCompletionDate?: string;
  readonly actualCompletionDate?: string;
}

export const GARMENT_CATEGORIES = [
  "suit",
  "jacket",
  "trousers",
  "waistcoat",
  "shirt",
  "overcoat",
  "coat",
  "formalwear",
  "denim",
  "knitwear",
  "leather",
  "accessories",
  "other",
] as const;

export type GarmentCategoryCode = (typeof GARMENT_CATEGORIES)[number];
export type GarmentSourceKind = "external" | "finished_mtm";
export type WorkClassification = "work_now" | "future_order_note";

export interface PhysicalGarment extends Timestamps {
  readonly id: PhysicalGarmentId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly sourceKind: GarmentSourceKind;
  readonly categoryCode: GarmentCategoryCode;
  readonly garmentType: string;
  readonly brand?: string;
  readonly description: string;
  readonly identifyingPhotoUrl?: string;
  readonly labelMetadata: Record<string, string>;
  readonly intakeCondition: string;
  readonly externalReference?: string;
  readonly orderLineId?: OrderLineId;
  readonly supplierOrderReference?: string;
  readonly identificationState: "verified" | "needs_verification";
}

export interface FittingSession extends Timestamps {
  readonly id: FittingSessionId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly appointmentId?: AppointmentId;
  readonly fittedByStaffId?: StaffId;
  readonly occurredAt: string;
  readonly notes?: string;
}

export interface FittingObservation {
  readonly id: FittingObservationId;
  readonly retailerId: RetailerId;
  readonly fittingSessionId: FittingSessionId;
  readonly physicalGarmentId: PhysicalGarmentId;
  readonly classification: WorkClassification;
  readonly area: string;
  readonly observation: string;
  readonly recordedByStaffId?: StaffId;
  readonly createdAt: string;
}

export interface AlterationCatalogueCategory {
  readonly id: AlterationCategoryId;
  readonly code: GarmentCategoryCode;
  readonly name: string;
  readonly description: string;
  readonly displayOrder: number;
  readonly enabled: boolean;
}

export interface AlterationOperation {
  readonly id: AlterationOperationId;
  readonly categoryId: AlterationCategoryId;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly defaultDurationMinutes?: number;
  readonly enabled: boolean;
  readonly effectivePrice?: Money;
}

export type AlterationPriceListKind = "retailer" | "workshop";

export interface AlterationPriceList extends Timestamps {
  readonly id: AlterationPriceListId;
  readonly retailerId: RetailerId;
  readonly workshopId?: WorkshopId;
  readonly kind: AlterationPriceListKind;
  readonly name: string;
  readonly currency: string;
  readonly effectiveFrom: string;
  readonly effectiveUntil?: string;
  readonly active: boolean;
}

export interface Workshop extends Timestamps {
  readonly id: WorkshopId;
  readonly retailerId: RetailerId;
  readonly name: string;
  readonly status: "active" | "inactive";
  readonly email?: string;
  readonly phone?: string;
  readonly address?: Address;
}

export type AlterationStatus =
  | "intake"
  | "quoted"
  | "awaiting_approval"
  | "approved"
  | "assigned"
  | "in_progress"
  | "completion_review"
  | "ready_for_pickup"
  | "out_for_delivery"
  | "completed"
  | "canceled";

export type AlterationTaskStatus =
  | "proposed"
  | "approved"
  | "assigned"
  | "in_progress"
  | "review_ready"
  | "completed"
  | "canceled";

export interface Alteration extends Timestamps {
  readonly id: AlterationId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly physicalGarmentId: PhysicalGarmentId;
  readonly fittingSessionId?: FittingSessionId;
  readonly workOrderNumber: string;
  readonly status: AlterationStatus;
  readonly originalQuote: Money;
  readonly agreedTotal?: Money;
  readonly dueDate?: string;
  readonly customerNotificationReadyAt?: string;
  readonly customerNotifiedAt?: string;
  readonly canceledAt?: string;
  readonly cancellationReason?: string;
}

/** Least-privilege work-order projection exposed to an assigned worker. */
export interface WorkerAlterationWorkOrder {
  readonly id: AlterationId;
  readonly retailerId: RetailerId;
  readonly physicalGarmentId: PhysicalGarmentId;
  readonly workOrderNumber: string;
  readonly status: AlterationStatus;
  readonly garmentCategoryCode: GarmentCategoryCode;
  readonly garmentType: string;
  readonly brand?: string;
  readonly garmentDescription: string;
  readonly intakeCondition: string;
  readonly dueDate?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CustomerAlterationSummary {
  readonly id: AlterationId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly workOrderNumber: string;
  readonly status: AlterationStatus;
  readonly garmentCategoryCode: GarmentCategoryCode;
  readonly garmentType: string;
  readonly brand?: string;
  readonly garmentDescription: string;
  readonly agreedTotal?: Money;
  readonly dueDate?: string;
  readonly customerNotificationReadyAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AlterationTask extends Timestamps {
  readonly id: AlterationTaskId;
  readonly alterationId: AlterationId;
  readonly retailerId: RetailerId;
  readonly operationId?: AlterationOperationId;
  readonly title: string;
  readonly instructions?: string;
  readonly classification: WorkClassification;
  readonly status: AlterationTaskStatus;
  readonly originalQuote: Money;
  readonly agreedPrice?: Money;
  readonly assignedWorkerId?: StaffId;
}

/** Assigned task projection with customer and pricing data removed. */
export interface WorkerAlterationTask {
  readonly id: AlterationTaskId;
  readonly alterationId: AlterationId;
  readonly retailerId: RetailerId;
  readonly operationId?: AlterationOperationId;
  readonly title: string;
  readonly instructions?: string;
  readonly classification: "work_now";
  readonly status: AlterationTaskStatus;
  readonly assignedWorkerId: StaffId;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AlterationTaskNote {
  readonly id: AlterationTaskNoteId;
  readonly alterationId: AlterationId;
  readonly taskId: AlterationTaskId;
  readonly retailerId: RetailerId;
  readonly note: string;
  readonly actorStaffId?: StaffId;
  readonly createdAt: string;
}

export interface AlterationStatusHistory {
  readonly id: AlterationStatusHistoryId;
  readonly alterationId: AlterationId;
  readonly retailerId: RetailerId;
  readonly fromStatus?: AlterationStatus;
  readonly toStatus: AlterationStatus;
  readonly note?: string;
  readonly actorStaffId?: StaffId;
  readonly actorUserId?: string;
  readonly customerVisible: boolean;
  readonly createdAt: string;
}

/** Compatibility name for status-timeline consumers from the foundation slice. */
export type AlterationUpdate = AlterationStatusHistory;

export interface WorkOrderAssignment extends Timestamps {
  readonly id: WorkOrderAssignmentId;
  readonly alterationId: AlterationId;
  readonly retailerId: RetailerId;
  readonly workshopId: WorkshopId;
  readonly assignedWorkerId?: StaffId;
  readonly assignedByStaffId: StaffId;
  readonly targetCompletionDate?: string;
  readonly active: boolean;
}

export interface PriceChangeProposal extends Timestamps {
  readonly id: PriceChangeProposalId;
  readonly alterationId: AlterationId;
  readonly taskId?: AlterationTaskId;
  readonly retailerId: RetailerId;
  readonly originalAmount: Money;
  readonly proposedAmount: Money;
  readonly explanation: string;
  readonly evidenceAttachmentId?: AlterationAttachmentId;
  readonly status: "pending" | "approved" | "rejected" | "withdrawn";
  readonly proposedByStaffId: StaffId;
  readonly decidedByStaffId?: StaffId;
  readonly decidedAt?: string;
  readonly decisionReason?: string;
}

/** Append-only — every original quote, proposal, approval, rejection,
 * withdrawal and price-list change on an alteration, in order. The
 * audit trail a retailer reviews to confirm a workshop's invoice
 * matches what was actually proposed and approved. Never updated or
 * deleted (see the migration comment for `alteration_pricing_history`). */
export interface AlterationPricingHistoryEntry {
  readonly id: string;
  readonly alterationId: AlterationId;
  readonly taskId?: AlterationTaskId;
  readonly retailerId: RetailerId;
  readonly eventType:
    | "original_quote"
    | "proposal"
    | "approval"
    | "rejection"
    | "withdrawal"
    | "price_list_change";
  readonly amount: Money;
  readonly reason?: string;
  readonly actorStaffId?: StaffId;
  readonly createdAt: string;
}

export interface AlterationAttachment {
  readonly id: AlterationAttachmentId;
  readonly retailerId: RetailerId;
  readonly alterationId?: AlterationId;
  readonly taskId?: AlterationTaskId;
  readonly observationId?: FittingObservationId;
  readonly proposalId?: PriceChangeProposalId;
  readonly physicalGarmentId?: PhysicalGarmentId;
  readonly kind: "intake" | "label" | "evidence" | "progress" | "completion";
  readonly storageBucket: string;
  readonly storagePath: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly uploadedByStaffId?: StaffId;
  readonly createdAt: string;
}

export interface ChainOfCustodyEvent {
  readonly id: ChainOfCustodyEventId;
  readonly alterationId: AlterationId;
  readonly retailerId: RetailerId;
  readonly eventType:
    | "received"
    | "handed_to_workshop"
    | "returned_to_retailer"
    | "released_to_customer"
    | "delivery_dispatch"
    | "delivery_complete";
  readonly fromParty?: string;
  readonly toParty?: string;
  readonly conditionNote?: string;
  readonly actorStaffId?: StaffId;
  readonly occurredAt: string;
}

export interface CompletionReview extends Timestamps {
  readonly id: CompletionReviewId;
  readonly alterationId: AlterationId;
  readonly retailerId: RetailerId;
  readonly status: "pending" | "approved" | "changes_requested";
  readonly notes?: string;
  readonly reviewedByStaffId?: StaffId;
  readonly reviewedAt?: string;
}

export interface FulfillmentEvent extends Timestamps {
  readonly id: FulfillmentEventId;
  readonly alterationId: AlterationId;
  readonly retailerId: RetailerId;
  readonly actorStaffId?: StaffId;
  readonly method: "pickup" | "delivery";
  readonly status:
    "scheduled" | "ready" | "dispatched" | "completed" | "canceled";
  readonly scheduledAt?: string;
  readonly completedAt?: string;
  readonly deliveryAddress?: Address;
  readonly releasedToName?: string;
  readonly verificationNote?: string;
}

export const ALTERATION_TASK_STATUS_LABELS: Record<
  AlterationTaskStatus,
  string
> = {
  proposed: "Proposed",
  approved: "Approved",
  assigned: "Assigned",
  in_progress: "In progress",
  review_ready: "Ready for review",
  completed: "Completed",
  canceled: "Cancelled",
};

export const WORK_CLASSIFICATION_LABELS: Record<WorkClassification, string> = {
  work_now: "Now",
  future_order_note: "Future order",
};

export const ALTERATION_STATUS_LABELS: Record<AlterationStatus, string> = {
  intake: "Intake",
  quoted: "Quoted",
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  assigned: "Assigned",
  in_progress: "In progress",
  completion_review: "Completion review",
  ready_for_pickup: "Ready for collection",
  out_for_delivery: "Out for delivery",
  completed: "Completed",
  canceled: "Cancelled",
};

export const ALTERATION_STATUS_TRANSITIONS: Readonly<
  Record<AlterationStatus, readonly AlterationStatus[]>
> = {
  intake: ["quoted", "canceled"],
  quoted: ["awaiting_approval", "approved", "canceled"],
  awaiting_approval: ["approved", "canceled"],
  approved: ["assigned", "canceled"],
  assigned: ["in_progress", "canceled"],
  in_progress: ["completion_review", "canceled"],
  completion_review: [
    "in_progress",
    "ready_for_pickup",
    "out_for_delivery",
    "canceled",
  ],
  ready_for_pickup: ["completed", "canceled"],
  out_for_delivery: ["completed", "canceled"],
  completed: [],
  canceled: [],
};

export function canTransitionAlteration(
  from: AlterationStatus,
  to: AlterationStatus,
): boolean {
  return ALTERATION_STATUS_TRANSITIONS[from].includes(to);
}

export function canRetailerRoleTransitionAlteration(
  role: RetailerRole,
  from: AlterationStatus,
  to: AlterationStatus,
): boolean {
  if (!canTransitionAlteration(from, to)) return false;
  if (["owner", "admin", "manager"].includes(role)) return true;
  if (role === "production_staff") {
    return to !== "approved" && to !== "assigned";
  }
  if (role === "sales_associate") {
    return (
      ["intake", "quoted", "awaiting_approval"].includes(from) &&
      ["quoted", "awaiting_approval", "canceled"].includes(to)
    );
  }
  if (role === "workshop_manager" || role === "worker") {
    return to === "in_progress" || to === "completion_review";
  }
  return false;
}
