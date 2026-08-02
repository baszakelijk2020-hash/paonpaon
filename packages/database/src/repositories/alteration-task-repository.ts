import {
  asId,
  money,
  type AlterationId,
  type AlterationOperationId,
  type AlterationTask,
  type AlterationTaskId,
  type AlterationTaskNote,
  type AlterationTaskStatus,
  type CurrencyCode,
  type WorkClassification,
  type WorkerAlterationTask,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type TaskRow = Database["public"]["Tables"]["alteration_tasks"]["Row"];
type WorkerTaskRow =
  Database["public"]["Views"]["worker_alteration_tasks"]["Row"];

function toDomain(row: TaskRow): AlterationTask {
  return {
    id: asId<"AlterationTaskId">(row.id),
    alterationId: asId<"AlterationId">(row.alteration_id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    ...(row.operation_id
      ? { operationId: asId<"AlterationOperationId">(row.operation_id) }
      : {}),
    title: row.title,
    ...(row.instructions ? { instructions: row.instructions } : {}),
    classification: row.classification,
    status: row.status,
    originalQuote: money(
      row.original_quote_amount_minor_units,
      row.original_quote_currency as CurrencyCode,
    ),
    ...(row.agreed_price_amount_minor_units !== null &&
    row.agreed_price_currency
      ? {
          agreedPrice: money(
            row.agreed_price_amount_minor_units,
            row.agreed_price_currency as CurrencyCode,
          ),
        }
      : {}),
    ...(row.assigned_worker_id
      ? { assignedWorkerId: asId<"StaffId">(row.assigned_worker_id) }
      : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export class AlterationTaskRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findByAlteration(
    alterationId: AlterationId,
  ): Promise<AlterationTask[]> {
    const { data, error } = await this.client
      .from("alteration_tasks")
      .select("*")
      .eq("alteration_id", alterationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data.map(toDomain);
  }

  async findByAlterationForWorker(
    alterationId: AlterationId,
  ): Promise<WorkerAlterationTask[]> {
    const { data, error } = await this.client
      .from("worker_alteration_tasks")
      .select("*")
      .eq("alteration_id", alterationId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data.map((row: WorkerTaskRow) => ({
      id: asId<"AlterationTaskId">(row.id!),
      alterationId: asId<"AlterationId">(row.alteration_id!),
      retailerId: asId<"RetailerId">(row.retailer_id!),
      ...(row.operation_id
        ? { operationId: asId<"AlterationOperationId">(row.operation_id) }
        : {}),
      title: row.title!,
      ...(row.instructions ? { instructions: row.instructions } : {}),
      classification: "work_now",
      status: row.status!,
      assignedWorkerId: asId<"StaffId">(row.assigned_worker_id!),
      createdAt: row.created_at!,
      updatedAt: row.updated_at!,
    }));
  }

  async updateStatus(
    taskId: AlterationTaskId,
    status: AlterationTaskStatus,
    note?: string,
  ): Promise<void> {
    const { error } = await this.client.rpc("update_alteration_task_status", {
      p_task_id: taskId,
      p_status: status,
      p_note: (note ?? null) as never,
    });
    if (error) throw error;
  }

  async addNote(taskId: AlterationTaskId, note: string): Promise<void> {
    const { error } = await this.client.rpc("add_alteration_task_note", {
      p_task_id: taskId,
      p_note: note,
    });
    if (error) throw error;
  }

  async addTask(params: {
    alterationId: AlterationId;
    title: string;
    classification: WorkClassification;
    instructions?: string;
    operationId?: AlterationOperationId;
    note?: string;
  }): Promise<AlterationTaskId> {
    const { data, error } = await this.client.rpc("add_alteration_task", {
      p_alteration_id: params.alterationId,
      p_title: params.title,
      p_instructions: (params.instructions ?? null) as never,
      p_classification: params.classification,
      p_operation_id: (params.operationId ?? null) as never,
      p_note: (params.note ?? null) as never,
    });
    if (error) throw error;
    return asId<"AlterationTaskId">(data as string);
  }

  async findNotesByAlteration(
    alterationId: AlterationId,
  ): Promise<AlterationTaskNote[]> {
    const { data, error } = await this.client
      .from("alteration_task_notes")
      .select("*")
      .eq("alteration_id", alterationId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data.map((row) => ({
      id: asId<"AlterationTaskNoteId">(row.id),
      alterationId: asId<"AlterationId">(row.alteration_id),
      taskId: asId<"AlterationTaskId">(row.task_id),
      retailerId: asId<"RetailerId">(row.retailer_id),
      note: row.note,
      ...(row.actor_staff_id
        ? { actorStaffId: asId<"StaffId">(row.actor_staff_id) }
        : {}),
      createdAt: row.created_at,
    }));
  }
}
