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
import { ProductRepository } from "./product-repository";
import { ProductVariantRepository } from "./product-variant-repository";

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
    return this.createJobFromRows({
      retailerId: args.retailerId,
      displayName: args.displayName ?? "Fixture staged-file migration",
      rows: buildFixtureMigrationRows(),
    });
  }

  /**
   * The general case `createFixtureJob` and the Shopify connector orchestrator
   * (`orchestrateShopifyDeltaSync`) both delegate to — the only difference
   * between a manual fixture load and a provider delta is which rows arrive,
   * never how they're staged. Keeping one path here means 9.1's dry-run/
   * publish/reconcile pipeline is the only ingestion truth a connector can
   * ever reach, matching AGENTS.md's "never create a second feature-local
   * truth."
   */
  async createJobFromRows(args: {
    readonly retailerId: RetailerId;
    readonly displayName: string;
    readonly rows: readonly MigrationStagedRow[];
  }): Promise<MigrationJobRecord> {
    const rows = args.rows;
    const dryRun = buildMigrationDryRunReport(rows);
    const rollbackRef = `rollback:${newId()}`;

    const { data: job, error: jobError } = await this.client
      .from("migration_jobs")
      .insert({
        retailer_id: args.retailerId,
        display_name: args.displayName,
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
    const productRepo = new ProductRepository(this.client);
    const variantRepo = new ProductVariantRepository(this.client);
    const customerIdsByExternal = new Map<string, string>();
    const productIdsByExternal = new Map<string, string>();
    const variantIdsBySku = new Map<string, string>();

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
        customerIdsByExternal.set(row.externalId, created.id);
      } else if (row.entityKind === "product") {
        const sku = row.payload.sku || row.externalId;
        const slug = `mig-${row.externalId}`
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, "-")
          .slice(0, 80);
        // Reconciliation above is scoped to this job's own receipts, but the
        // slug is unique per retailer regardless of job — republishing the
        // same fixture under a fresh job id (exactly what re-running the
        // dry-run fixture does) must reconcile against a product an earlier
        // job already created, not attempt a second insert and fail.
        const product =
          (await productRepo.findBySlug(args.retailerId, slug)) ??
          (await productRepo.create({
            retailerId: args.retailerId,
            name: row.payload.name || row.externalId,
            slug,
            description: `Imported via staged-file migration (${row.externalId})`,
            status: "active",
            isMadeToOrder: false,
            isAlterable: true,
          }));
        const existingVariant = (
          await variantRepo.findByProduct(product.id)
        ).find((candidate) => candidate.sku === sku);
        const variant =
          existingVariant ??
          (await variantRepo.create({
            productId: product.id,
            sku,
            price: {
              amountMinorUnits: Number(row.payload.price_minor ?? 0),
              currency: row.payload.currency || "EUR",
            },
            inventoryQuantity: 0,
          }));
        canonicalId = product.id;
        productIdsByExternal.set(row.externalId, product.id);
        variantIdsBySku.set(sku, variant.id);
      } else if (row.entityKind === "stock") {
        const sku = row.payload.sku || row.externalId;
        let variantId = variantIdsBySku.get(sku);
        if (!variantId) {
          const { data: variantRow, error: variantError } = await this.client
            .from("product_variants")
            .select("id, product_id, products!inner(retailer_id)")
            .eq("sku", sku)
            .eq("products.retailer_id", args.retailerId)
            .is("deleted_at", null)
            .maybeSingle();
          if (variantError) throw variantError;
          if (!variantRow) {
            throw new Error(`Stock publish missing variant for SKU ${sku}`);
          }
          variantId = variantRow.id;
          variantIdsBySku.set(sku, variantId);
        }
        const quantity = Number(row.payload.quantity ?? 0);
        const { error: stockError } = await this.client
          .from("product_variants")
          .update({ inventory_quantity: quantity })
          .eq("id", variantId);
        if (stockError) throw stockError;
        canonicalId = variantId;
      } else if (row.entityKind === "order") {
        const customerExternal = row.payload.customer_external_id ?? "";
        let customerId = customerIdsByExternal.get(customerExternal);
        if (!customerId) {
          const { data: stagedCustomer, error: stagedError } = await this.client
            .from("migration_staged_rows")
            .select("canonical_id")
            .eq("job_id", args.jobId)
            .eq("retailer_id", args.retailerId)
            .eq("entity_kind", "customer")
            .eq("external_id", customerExternal)
            .maybeSingle();
          if (stagedError) throw stagedError;
          if (!stagedCustomer?.canonical_id) {
            throw new Error(
              `Order publish missing customer ${customerExternal}`,
            );
          }
          customerId = stagedCustomer.canonical_id;
        }
        const totalMinor = Number(row.payload.total_minor ?? 0);
        const currency = row.payload.currency || "EUR";
        const status =
          row.payload.status === "completed" ? "completed" : "placed";
        const orderNumber = `MIG-${row.externalId}`;

        // Same reconciliation gap as the product branch above: order_number
        // is unique per retailer regardless of job, so republishing the
        // fixture under a fresh job id must reconcile against an order an
        // earlier job already created, not attempt a second insert.
        const { data: existingOrder, error: existingOrderError } =
          await this.client
            .from("orders")
            .select("id")
            .eq("retailer_id", args.retailerId)
            .eq("order_number", orderNumber)
            .maybeSingle();
        if (existingOrderError) throw existingOrderError;

        if (existingOrder) {
          canonicalId = existingOrder.id;
        } else {
          const { data: order, error: orderError } = await this.client
            .from("orders")
            .insert({
              retailer_id: args.retailerId,
              customer_id: customerId,
              order_number: orderNumber,
              status,
              channel: "in_store",
              currency,
              subtotal_amount_minor_units: totalMinor,
              total_amount_minor_units: totalMinor,
              placed_at: new Date().toISOString(),
            })
            .select("id")
            .single();
          if (orderError) throw orderError;
          canonicalId = order.id;

          // Attach one line from the first published variant when available
          // so order consumers see a real line, not a receipt-only shell.
          const firstVariantId = variantIdsBySku.values().next().value;
          if (firstVariantId) {
            const { error: lineError } = await this.client
              .from("order_lines")
              .insert({
                order_id: order.id,
                product_variant_id: firstVariantId,
                quantity: 1,
                unit_price_amount_minor_units: totalMinor,
                unit_price_currency: currency,
              });
            if (lineError) throw lineError;
          }
        }
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
