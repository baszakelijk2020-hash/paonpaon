import {
  asId,
  money,
  type Alteration,
  type AlterationId,
  type CreateAlterationInput,
  type CurrencyCode,
  type RetailerId,
  type WorkerAlterationWorkOrder,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type WorkOrderRow =
  Database["public"]["Tables"]["alteration_work_orders"]["Row"];
type WorkerWorkOrderRow =
  Database["public"]["Views"]["worker_alteration_work_orders"]["Row"];

function toDomain(row: WorkOrderRow): Alteration {
  return {
    id: asId<"AlterationId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    physicalGarmentId: asId<"PhysicalGarmentId">(row.physical_garment_id),
    ...(row.fitting_session_id
      ? { fittingSessionId: asId<"FittingSessionId">(row.fitting_session_id) }
      : {}),
    workOrderNumber: row.work_order_number,
    status: row.status,
    originalQuote: money(
      row.original_quote_amount_minor_units,
      row.original_quote_currency as CurrencyCode,
    ),
    ...(row.agreed_total_amount_minor_units !== null &&
    row.agreed_total_currency
      ? {
          agreedTotal: money(
            row.agreed_total_amount_minor_units,
            row.agreed_total_currency as CurrencyCode,
          ),
        }
      : {}),
    ...(row.due_date ? { dueDate: row.due_date } : {}),
    ...(row.customer_notification_ready_at
      ? { customerNotificationReadyAt: row.customer_notification_ready_at }
      : {}),
    ...(row.customer_notified_at
      ? { customerNotifiedAt: row.customer_notified_at }
      : {}),
    ...(row.canceled_at ? { canceledAt: row.canceled_at } : {}),
    ...(row.cancellation_reason
      ? { cancellationReason: row.cancellation_reason }
      : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function workerToDomain(row: WorkerWorkOrderRow): WorkerAlterationWorkOrder {
  return {
    id: asId<"AlterationId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    physicalGarmentId: asId<"PhysicalGarmentId">(row.physical_garment_id),
    workOrderNumber: row.work_order_number,
    status: row.status,
    garmentCategoryCode: row.category_code,
    garmentType: row.garment_type,
    ...(row.brand ? { brand: row.brand } : {}),
    garmentDescription: row.description,
    intakeCondition: row.intake_condition,
    ...(row.due_date ? { dueDate: row.due_date } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class AlterationRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findById(id: AlterationId): Promise<Alteration | null> {
    const { data, error } = await this.client
      .from("alteration_work_orders")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return data ? toDomain(data) : null;
  }

  async findByRetailer(retailerId: RetailerId): Promise<Alteration[]> {
    const { data, error } = await this.client
      .from("alteration_work_orders")
      .select("*")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toDomain);
  }

  async findAssignedToWorker(): Promise<WorkerAlterationWorkOrder[]> {
    const { data, error } = await this.client
      .from("worker_alteration_work_orders")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(workerToDomain);
  }

  async findByIdForWorker(
    id: AlterationId,
  ): Promise<WorkerAlterationWorkOrder | null> {
    const { data, error } = await this.client
      .from("worker_alteration_work_orders")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? workerToDomain(data) : null;
  }

  /** Transactional garment + fitting + observation + task + quote intake. */
  async createIntake(input: CreateAlterationInput): Promise<AlterationId> {
    const { data, error } = await this.client.rpc("create_alteration_intake", {
      p_customer_id: input.customerId,
      p_appointment_id: input.appointmentId ?? null,
      p_source_kind: input.sourceKind,
      p_category_code: input.categoryCode,
      p_garment_type: input.garmentType,
      p_brand: input.brand ?? null,
      p_description: input.description,
      p_identifying_photo_url: input.identifyingPhotoUrl ?? null,
      p_label_metadata: input.labelMetadata,
      p_intake_condition: input.intakeCondition,
      p_external_reference: input.externalReference ?? null,
      p_order_line_id: input.orderLineId ?? null,
      p_supplier_order_reference: input.supplierOrderReference ?? null,
      p_due_date: input.dueDate ?? null,
      p_observations: input.observations,
      p_tasks: input.tasks,
    });
    if (error) throw error;
    return asId<"AlterationId">(data);
  }
}
