/**
 * Staged-file migration job repository (PHASE 9.1).
 */

import {
  asId,
  buildFixtureMigrationRows,
  buildMigrationDryRunReport,
  MIGRATION_CONTRACT_VERSION,
  planMigrationPublish,
  reconcileMigrationPublish,
  type MigrationDryRunReport,
  type MigrationEntityKind,
  type MigrationJobStatus,
  type MigrationReconcileReport,
  type MigrationRowStatus,
  type MigrationStagedRow,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

import { CustomerRepository } from "./customer-repository";

function newId(): string {
  return globalThis.crypto.randomUUID();
}

type JobRow = Database["public"]["Tables"]["migration_jobs"]["Row"];
type StagedRow = Database["public"]["Tables"]["migration_staged_rows"]["Row"];

export interface MigrationJobRecord {
  readonly id: string;
  readonly retailerId: RetailerId;
  readonly displayName: string;
  readonly status: MigrationJobStatus;
  readonly contractVersion: string;
  readonly dryRunReport?: MigrationDryRunReport;
  readonly reconcileReport?: MigrationReconcileReport;
  readonly rollbackRef?: string;
  readonly lastError?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

function toDryRun(value: Json | null): MigrationDryRunReport | undefined {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    return undefined;
  }
  return value as unknown as MigrationDryRunReport;
}

function toReconcile(value: Json | null): MigrationReconcileReport | undefined {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    return undefined;
  }
  return value as unknown as MigrationReconcileReport;
}

function toJob(row: JobRow): MigrationJobRecord {
  const dryRunReport = toDryRun(row.dry_run_report);
  const reconcileReport = toReconcile(row.reconcile_report);
  return {
    id: row.id,
    retailerId: asId<"RetailerId">(row.retailer_id),
    displayName: row.display_name,
    status: row.status as MigrationJobStatus,
    contractVersion: row.contract_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(dryRunReport ? { dryRunReport } : {}),
    ...(reconcileReport ? { reconcileReport } : {}),
    ...(row.rollback_ref ? { rollbackRef: row.rollback_ref } : {}),
    ...(row.last_error ? { lastError: row.last_error } : {}),
  };
}

function toStaged(row: StagedRow): MigrationStagedRow {
  const payload =
    row.payload !== null &&
    typeof row.payload === "object" &&
    !Array.isArray(row.payload)
      ? Object.fromEntries(
          Object.entries(row.payload as Record<string, unknown>).map(
            ([key, value]) => [key, String(value ?? "")],
          ),
        )
      : {};
  return {
    entityKind: row.entity_kind as MigrationEntityKind,
    rowNumber: row.row_number,
    externalId: row.external_id,
    payload,
    status: row.status as MigrationRowStatus,
    ...(row.rejection_code ? { rejectionCode: row.rejection_code } : {}),
    ...(row.rejection_message
      ? { rejectionMessage: row.rejection_message }
      : {}),
  };
}

export class MigrationJobRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async listJobs(retailerId: RetailerId): Promise<MigrationJobRecord[]> {
    const { data, error } = await this.client
      .from("migration_jobs")
      .select("*")
      .eq("retailer_id", retailerId)
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) throw error;
    return data.map(toJob);
  }

  async getJob(
    retailerId: RetailerId,
    jobId: string,
  ): Promise<MigrationJobRecord | null> {
    const { data, error } = await this.client
      .from("migration_jobs")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("id", jobId)
      .maybeSingle();
    if (error) throw error;
    return data ? toJob(data) : null;
  }

  async listRows(
    retailerId: RetailerId,
    jobId: string,
  ): Promise<MigrationStagedRow[]> {
    const { data, error } = await this.client
      .from("migration_staged_rows")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("job_id", jobId)
      .order("entity_kind", { ascending: true })
      .order("row_number", { ascending: true });
    if (error) throw error;
    return data.map(toStaged);
  }

  async createFixtureJob(args: {
    readonly retailerId: RetailerId;
    readonly displayName?: string;
  }): Promise<MigrationJobRecord> {
    const rows = buildFixtureMigrationRows();
    const dryRun = buildMigrationDryRunReport(rows);
    const rollbackRef = `rollback:${newId()}`;

    const { data: job, error: jobError } = await this.client
      .from("migration_jobs")
      .insert({
        retailer_id: args.retailerId,
        display_name: args.displayName ?? "Fixture staged-file migration",
        status: "dry_run",
        contract_version: MIGRATION_CONTRACT_VERSION,
        dry_run_report: dryRun as unknown as Json,
        rollback_ref: rollbackRef,
      })
      .select("*")
      .single();
    if (jobError) throw jobError;

    const { error: rowsError } = await this.client
      .from("migration_staged_rows")
      .insert(
        rows.map((row) => ({
          job_id: job.id,
          retailer_id: args.retailerId,
          entity_kind: row.entityKind,
          row_number: row.rowNumber,
          external_id: row.externalId,
          payload: row.payload as unknown as Json,
          status: row.status,
          ...(row.rejectionCode ? { rejection_code: row.rejectionCode } : {}),
          ...(row.rejectionMessage
            ? { rejection_message: row.rejectionMessage }
            : {}),
        })),
      );
    if (rowsError) throw rowsError;

    return toJob(job);
  }

  async publishJob(args: {
    readonly retailerId: RetailerId;
    readonly jobId: string;
  }): Promise<MigrationJobRecord> {
    const job = await this.getJob(args.retailerId, args.jobId);
    if (!job) throw new Error("Migration job not found");

    const staged = await this.listRows(args.retailerId, args.jobId);
    const { data: existingReceipts, error: receiptError } = await this.client
      .from("migration_publish_receipts")
      .select("entity_kind, external_id")
      .eq("retailer_id", args.retailerId)
      .eq("job_id", args.jobId);
    if (receiptError) throw receiptError;

    const already = new Set(
      (existingReceipts ?? []).map(
        (row) => `${row.entity_kind}:${row.external_id}`,
      ),
    );

    const plan = planMigrationPublish({
      rows: staged,
      alreadyPublishedExternalIds: already,
    });

    await this.client
      .from("migration_jobs")
      .update({
        status: "publishing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", args.jobId)
      .eq("retailer_id", args.retailerId);

    const customerRepo = new CustomerRepository(this.client);

    for (const row of plan.toPublish) {
      let canonicalId: string = newId();
      if (row.entityKind === "customer") {
        const created = await customerRepo.create({
          retailerId: args.retailerId,
          fullName: row.payload.full_name || row.externalId,
          ...(row.payload.email ? { email: row.payload.email } : {}),
          ...(row.payload.phone ? { phone: row.payload.phone } : {}),
          lifecycleStage: "prospect",
          acquisitionSource: "staged_file_migration",
        });
        canonicalId = created.id;
      }

      await this.recordReceipt({
        jobId: args.jobId,
        retailerId: args.retailerId,
        row,
        canonicalId,
      });

      await this.client
        .from("migration_staged_rows")
        .update({
          status: "published",
          canonical_id: canonicalId,
          updated_at: new Date().toISOString(),
        })
        .eq("job_id", args.jobId)
        .eq("retailer_id", args.retailerId)
        .eq("entity_kind", row.entityKind)
        .eq("external_id", row.externalId);
    }

    for (const row of plan.skipped) {
      await this.client
        .from("migration_staged_rows")
        .update({
          status: "skipped",
          updated_at: new Date().toISOString(),
        })
        .eq("job_id", args.jobId)
        .eq("retailer_id", args.retailerId)
        .eq("entity_kind", row.entityKind)
        .eq("external_id", row.externalId);
    }

    const dryRun =
      job.dryRunReport ??
      buildMigrationDryRunReport(
        staged.filter(
          (row) => row.status === "ready" || row.status === "published",
        ),
      );

    const { data: allReceipts, error: allReceiptError } = await this.client
      .from("migration_publish_receipts")
      .select("*")
      .eq("job_id", args.jobId)
      .eq("retailer_id", args.retailerId);
    if (allReceiptError) throw allReceiptError;

    const publishedForReconcile: MigrationStagedRow[] = (allReceipts ?? []).map(
      (receipt) => ({
        entityKind: receipt.entity_kind as MigrationEntityKind,
        rowNumber: 0,
        externalId: receipt.external_id,
        payload: {
          total_minor: String(receipt.money_minor),
          quantity: String(receipt.stock_units),
        },
        status: "published" as const,
      }),
    );

    const reconcile = reconcileMigrationPublish({
      dryRun,
      published: publishedForReconcile,
    });

    const { data: updated, error: updateError } = await this.client
      .from("migration_jobs")
      .update({
        status: reconcile.matched ? "completed" : "failed",
        reconcile_report: reconcile as unknown as Json,
        last_error: reconcile.matched ? null : reconcile.notes.join("; "),
        updated_at: new Date().toISOString(),
      })
      .eq("id", args.jobId)
      .eq("retailer_id", args.retailerId)
      .select("*")
      .single();
    if (updateError) throw updateError;
    return toJob(updated);
  }

  private async recordReceipt(args: {
    readonly jobId: string;
    readonly retailerId: RetailerId;
    readonly row: MigrationStagedRow;
    readonly canonicalId: string;
  }): Promise<void> {
    const { error } = await this.client
      .from("migration_publish_receipts")
      .insert({
        job_id: args.jobId,
        retailer_id: args.retailerId,
        entity_kind: args.row.entityKind,
        external_id: args.row.externalId,
        canonical_id: args.canonicalId,
        money_minor:
          args.row.entityKind === "order"
            ? Number(args.row.payload.total_minor ?? 0)
            : 0,
        stock_units:
          args.row.entityKind === "stock"
            ? Number(args.row.payload.quantity ?? 0)
            : 0,
      });
    if (error) throw error;
  }
}
