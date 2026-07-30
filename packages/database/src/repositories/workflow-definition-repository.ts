/**
 * Versioned workflow + familiarity preset persistence (PHASE 8.3).
 */

import {
  asId,
  buildAlterationWorkflowSnapshotV1,
  FAMILIARITY_PRESET_CATALOG,
  resolveFamiliarityPreset,
  type FamiliarityPreset,
  type FamiliarityPresetKey,
  type RetailerId,
  type WorkflowDefinition,
  type WorkflowDefinitionKey,
  type WorkflowDefinitionSnapshot,
  type WorkflowDefinitionVersion,
  type WorkflowInstanceBinding,
  type WorkflowSubjectType,
  type WorkflowVersionStatus,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

type DefinitionRow =
  Database["public"]["Tables"]["workflow_definitions"]["Row"];
type VersionRow =
  Database["public"]["Tables"]["workflow_definition_versions"]["Row"];
type BindingRow =
  Database["public"]["Tables"]["workflow_instance_bindings"]["Row"];
type SettingsRow =
  Database["public"]["Tables"]["retailer_familiarity_settings"]["Row"];

function toSnapshot(value: Json): WorkflowDefinitionSnapshot {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new Error("Workflow snapshot must be a JSON object");
  }
  const record = value as Record<string, unknown>;
  return {
    versionLabel: String(record.versionLabel ?? ""),
    states: Array.isArray(record.states) ? record.states.map(String) : [],
    transitions: Array.isArray(record.transitions)
      ? record.transitions.map((item) => {
          const rule = item as Record<string, unknown>;
          return {
            from: String(rule.from ?? ""),
            to: String(rule.to ?? ""),
            allowedRoles: Array.isArray(rule.allowedRoles)
              ? (rule.allowedRoles.map(String) as never)
              : [],
            requiredFields: Array.isArray(rule.requiredFields)
              ? rule.requiredFields.map(String)
              : [],
          };
        })
      : [],
    exceptions: Array.isArray(record.exceptions)
      ? record.exceptions.map(String)
      : [],
  };
}

function toDefinition(row: DefinitionRow): WorkflowDefinition {
  return {
    id: row.id,
    key: row.key as WorkflowDefinitionKey,
    subjectType: row.subject_type as WorkflowSubjectType,
    displayName: row.display_name,
  };
}

function toVersion(row: VersionRow): WorkflowDefinitionVersion {
  return {
    id: row.id,
    definitionId: row.definition_id,
    versionNumber: row.version_number,
    status: row.status as WorkflowVersionStatus,
    snapshot: toSnapshot(row.snapshot),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.activated_at ? { activatedAt: row.activated_at } : {}),
  };
}

function toBinding(row: BindingRow): WorkflowInstanceBinding {
  return {
    id: row.id,
    retailerId: asId<"RetailerId">(row.retailer_id),
    subjectType: row.subject_type as WorkflowSubjectType,
    subjectId: row.subject_id,
    definitionVersionId: row.definition_version_id,
    pinnedAt: row.pinned_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class WorkflowDefinitionRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async listDefinitions(): Promise<WorkflowDefinition[]> {
    const { data, error } = await this.client
      .from("workflow_definitions")
      .select("*")
      .order("key", { ascending: true });
    if (error) throw error;
    return data.map(toDefinition);
  }

  async getActiveVersion(
    key: WorkflowDefinitionKey,
  ): Promise<WorkflowDefinitionVersion | null> {
    const { data: definition, error: definitionError } = await this.client
      .from("workflow_definitions")
      .select("*")
      .eq("key", key)
      .maybeSingle();
    if (definitionError) throw definitionError;
    if (!definition) return null;

    const { data, error } = await this.client
      .from("workflow_definition_versions")
      .select("*")
      .eq("definition_id", definition.id)
      .eq("status", "active")
      .maybeSingle();
    if (error) throw error;
    return data ? toVersion(data) : null;
  }

  /**
   * Seeds alteration work-order v1 from domain if no active version exists.
   * Never mutates an existing snapshot.
   */
  async ensureAlterationWorkflowV1(): Promise<WorkflowDefinitionVersion> {
    const existing = await this.getActiveVersion("alteration_work_order");
    if (existing) return existing;

    const { data: definition, error: definitionError } = await this.client
      .from("workflow_definitions")
      .select("*")
      .eq("key", "alteration_work_order")
      .single();
    if (definitionError) throw definitionError;

    const snapshot = buildAlterationWorkflowSnapshotV1();
    const { data, error } = await this.client
      .from("workflow_definition_versions")
      .insert({
        definition_id: definition.id,
        version_number: 1,
        status: "active",
        snapshot: snapshot as unknown as Json,
        activated_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) throw error;
    return toVersion(data);
  }

  /**
   * Publishes a new active version and retires the previous active one.
   * Existing instance bindings keep their pinned version id.
   */
  async publishNewVersion(args: {
    readonly key: WorkflowDefinitionKey;
    readonly snapshot: WorkflowDefinitionSnapshot;
  }): Promise<WorkflowDefinitionVersion> {
    const { data: definition, error: definitionError } = await this.client
      .from("workflow_definitions")
      .select("*")
      .eq("key", args.key)
      .single();
    if (definitionError) throw definitionError;

    const { data: latest, error: latestError } = await this.client
      .from("workflow_definition_versions")
      .select("version_number")
      .eq("definition_id", definition.id)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError) throw latestError;

    const nextNumber = (latest?.version_number ?? 0) + 1;

    await this.client
      .from("workflow_definition_versions")
      .update({
        status: "retired",
        updated_at: new Date().toISOString(),
      })
      .eq("definition_id", definition.id)
      .eq("status", "active");

    const { data, error } = await this.client
      .from("workflow_definition_versions")
      .insert({
        definition_id: definition.id,
        version_number: nextNumber,
        status: "active",
        snapshot: args.snapshot as unknown as Json,
        activated_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) throw error;
    return toVersion(data);
  }

  async getBinding(args: {
    readonly retailerId: RetailerId;
    readonly subjectType: WorkflowSubjectType;
    readonly subjectId: string;
  }): Promise<WorkflowInstanceBinding | null> {
    const { data, error } = await this.client
      .from("workflow_instance_bindings")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .eq("subject_type", args.subjectType)
      .eq("subject_id", args.subjectId)
      .maybeSingle();
    if (error) throw error;
    return data ? toBinding(data) : null;
  }

  /**
   * Pins a subject to the current active definition version (idempotent).
   * Re-calling does not move an existing pin to a newer version.
   */
  async bindInstance(args: {
    readonly retailerId: RetailerId;
    readonly subjectType: WorkflowSubjectType;
    readonly subjectId: string;
    readonly definitionKey: WorkflowDefinitionKey;
  }): Promise<WorkflowInstanceBinding> {
    const existing = await this.getBinding(args);
    if (existing) return existing;

    let active = await this.getActiveVersion(args.definitionKey);
    if (!active && args.definitionKey === "alteration_work_order") {
      active = await this.ensureAlterationWorkflowV1();
    }
    if (!active) {
      throw new Error(`No active workflow version for ${args.definitionKey}`);
    }

    const { data, error } = await this.client
      .from("workflow_instance_bindings")
      .insert({
        retailer_id: args.retailerId,
        subject_type: args.subjectType,
        subject_id: args.subjectId,
        definition_version_id: active.id,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toBinding(data);
  }

  async getVersionById(
    versionId: string,
  ): Promise<WorkflowDefinitionVersion | null> {
    const { data, error } = await this.client
      .from("workflow_definition_versions")
      .select("*")
      .eq("id", versionId)
      .maybeSingle();
    if (error) throw error;
    return data ? toVersion(data) : null;
  }

  async getRetailerPreset(retailerId: RetailerId): Promise<FamiliarityPreset> {
    const { data, error } = await this.client
      .from("retailer_familiarity_settings")
      .select("*")
      .eq("retailer_id", retailerId)
      .maybeSingle();
    if (error) throw error;
    return resolveFamiliarityPreset(data?.preset_key);
  }

  async setRetailerPreset(args: {
    readonly retailerId: RetailerId;
    readonly presetKey: FamiliarityPresetKey;
  }): Promise<FamiliarityPreset> {
    if (!(args.presetKey in FAMILIARITY_PRESET_CATALOG)) {
      throw new Error(`Unknown familiarity preset ${args.presetKey}`);
    }

    const existing = await this.client
      .from("retailer_familiarity_settings")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .maybeSingle();
    if (existing.error) throw existing.error;

    let row: SettingsRow;
    if (existing.data) {
      const { data, error } = await this.client
        .from("retailer_familiarity_settings")
        .update({
          preset_key: args.presetKey,
          updated_at: new Date().toISOString(),
        })
        .eq("retailer_id", args.retailerId)
        .select("*")
        .single();
      if (error) throw error;
      row = data;
    } else {
      const { data, error } = await this.client
        .from("retailer_familiarity_settings")
        .insert({
          retailer_id: args.retailerId,
          preset_key: args.presetKey,
        })
        .select("*")
        .single();
      if (error) throw error;
      row = data;
    }

    return resolveFamiliarityPreset(row.preset_key);
  }
}
