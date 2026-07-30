import {
  asId,
  type Appointment,
  type AppointmentId,
  type AppointmentStatus,
  type RetailerBranchId,
  type RetailerId,
  type StaffId,
  type WorkflowDefinition,
  type WorkflowDefinitionSnapshot,
  type WorkflowDefinitionVersion,
  type WorkflowEvent,
  type WorkflowInstance,
  type WorkflowSubjectType,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

type DefinitionRow =
  Database["public"]["Tables"]["workflow_definitions"]["Row"];
type VersionRow =
  Database["public"]["Tables"]["workflow_definition_versions"]["Row"];
type InstanceRow = Database["public"]["Tables"]["workflow_instances"]["Row"];
type EventRow = Database["public"]["Tables"]["workflow_events"]["Row"];

function toDefinition(row: DefinitionRow): WorkflowDefinition {
  return {
    id: row.id,
    retailerId: row.retailer_id,
    key: row.key,
    displayName: row.display_name,
    activeVersion: row.active_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toVersion(row: VersionRow): WorkflowDefinitionVersion {
  return {
    id: row.id,
    definitionId: row.definition_id,
    retailerId: row.retailer_id,
    key: row.key,
    version: row.version,
    snapshot: row.snapshot as unknown as WorkflowDefinitionSnapshot,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toInstance(row: InstanceRow): WorkflowInstance {
  return {
    id: row.id,
    retailerId: asId<"RetailerId">(row.retailer_id),
    definitionVersionId: row.definition_version_id,
    subjectType: row.subject_type as WorkflowSubjectType,
    subjectId: row.subject_id,
    currentState: row.current_state,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toEvent(row: EventRow): WorkflowEvent {
  return {
    id: row.id,
    retailerId: asId<"RetailerId">(row.retailer_id),
    instanceId: row.instance_id,
    fromState: row.from_state,
    toState: row.to_state,
    actorStaffId: row.actor_staff_id,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

export interface TransitionAppointmentWorkflowParams {
  readonly appointmentId: AppointmentId;
  readonly toState: AppointmentStatus;
  readonly staffId?: StaffId;
  readonly branchId?: RetailerBranchId;
  readonly reason?: string;
}

export class WorkflowRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findPlatformDefinition(
    key: string,
  ): Promise<WorkflowDefinition | null> {
    const { data, error } = await this.client
      .from("workflow_definitions")
      .select("*")
      .is("retailer_id", null)
      .eq("key", key)
      .maybeSingle();

    if (error) throw error;
    return data ? toDefinition(data) : null;
  }

  async findDefinitionVersion(
    definitionId: string,
    version: number,
  ): Promise<WorkflowDefinitionVersion | null> {
    const { data, error } = await this.client
      .from("workflow_definition_versions")
      .select("*")
      .eq("definition_id", definitionId)
      .eq("version", version)
      .maybeSingle();

    if (error) throw error;
    return data ? toVersion(data) : null;
  }

  async findInstanceBySubject(args: {
    readonly retailerId: RetailerId;
    readonly subjectType: WorkflowSubjectType;
    readonly subjectId: string;
  }): Promise<WorkflowInstance | null> {
    const { data, error } = await this.client
      .from("workflow_instances")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .eq("subject_type", args.subjectType)
      .eq("subject_id", args.subjectId)
      .maybeSingle();

    if (error) throw error;
    return data ? toInstance(data) : null;
  }

  async listEventsForInstance(instanceId: string): Promise<WorkflowEvent[]> {
    const { data, error } = await this.client
      .from("workflow_events")
      .select("*")
      .eq("instance_id", instanceId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map(toEvent);
  }

  async ensureAppointmentInstance(
    appointmentId: AppointmentId,
  ): Promise<string> {
    const { data, error } = await this.client.rpc(
      "ensure_appointment_workflow_instance",
      {
        p_appointment_id: appointmentId,
      },
    );

    if (error) throw error;
    return String(data);
  }

  async transitionAppointment(
    params: TransitionAppointmentWorkflowParams,
  ): Promise<Appointment> {
    const { data, error } = await this.client.rpc(
      "transition_appointment_workflow",
      {
        p_appointment_id: params.appointmentId,
        p_to_state: params.toState,
        p_staff_id: params.staffId ?? null,
        p_branch_id: params.branchId ?? null,
        p_reason: params.reason ?? null,
      },
    );

    if (error) throw error;

    const row = data as Database["public"]["Tables"]["appointments"]["Row"];
    return {
      id: asId<"AppointmentId">(row.id),
      retailerId: asId<"RetailerId">(row.retailer_id),
      customerId: asId<"CustomerId">(row.customer_id),
      ...(row.staff_id ? { staffId: asId<"StaffId">(row.staff_id) } : {}),
      ...(row.branch_id
        ? { branchId: asId<"RetailerBranchId">(row.branch_id) }
        : {}),
      type: row.type,
      status: row.status,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      ...(row.location_id ? { locationId: row.location_id } : {}),
      ...(row.notes ? { notes: row.notes } : {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    };
  }
}

/** Guard for repository-only Json cast when snapshot is validated upstream. */
export function workflowSnapshotToJson(
  snapshot: WorkflowDefinitionSnapshot,
): Json {
  return snapshot as unknown as Json;
}
