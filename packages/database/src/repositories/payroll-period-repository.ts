import {
  buildChecksummedPayrollExport,
  summarizePeriodHours,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";

export interface PayrollPeriodDashboard {
  readonly periods: readonly PayrollPeriodRecord[];
  readonly versions: readonly PayrollPeriodVersionRecord[];
  readonly snapshots: readonly PayrollEntrySnapshotRecord[];
  readonly exceptions: readonly PayrollExceptionRecord[];
  readonly exports: readonly PayrollExportRecord[];
}

export interface PayrollPeriodRecord {
  readonly id: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly currentVersionId: string | null;
  readonly createdAt: string;
}

export interface PayrollPeriodVersionRecord {
  readonly id: string;
  readonly periodId: string;
  readonly versionNumber: number;
  readonly predecessorVersionId: string | null;
  readonly state: "draft" | "approved";
  readonly preparedByStaffId: string;
  readonly approvedByStaffId: string | null;
  readonly approvedAt: string | null;
  readonly createdAt: string;
}

export interface PayrollEntrySnapshotRecord {
  readonly id: string;
  readonly versionId: string;
  readonly sourceTimeEntryId: string;
  readonly staffId: string;
  readonly clockInAt: string;
  readonly clockOutAt: string | null;
}

export interface PayrollExceptionRecord {
  readonly id: string;
  readonly versionId: string;
  readonly sourceTimeEntryId: string | null;
  readonly kind: string;
  readonly detail: string;
  readonly resolvedAt: string | null;
}

export interface PayrollExportRecord {
  readonly id: string;
  readonly versionId: string;
  readonly rowCount: number;
  readonly checksum: string;
  readonly createdAt: string;
}

/** Immutable earning-code row recorded by record_payroll_export. */
export interface PayrollExportRow {
  readonly staffId: string;
  readonly earningCode: string;
  readonly hours: number;
}

/** A persisted export may be handed to an accountant without rebuilding it
 * from mutable time entries. */
export interface PayrollExportHandoff extends PayrollExportRecord {
  readonly rows: readonly PayrollExportRow[];
}

/**
 * The payroll migration landed before its table declarations could be
 * regenerated in database.types.ts. Keep this compatibility shim private to
 * the repository; the returned application model remains fully typed and the
 * root type-generation pass can remove the cast without changing consumers.
 */
type PayrollReadClient = {
  from(relation: string): {
    select(columns: string): {
      eq(
        column: string,
        value: string,
      ): {
        order(
          column: string,
          options?: { ascending?: boolean },
        ): Promise<{
          data: unknown[] | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
};

/** Authoritative payroll lifecycle. The database RPCs, not this client,
 * enforce tenant role, independent approval and compare-and-swap semantics. */
export class PayrollPeriodRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async open(args: {
    retailerId: RetailerId;
    periodStart: string;
    periodEnd: string;
  }): Promise<string> {
    const { data, error } = await this.client.rpc("open_payroll_period", {
      p_retailer_id: args.retailerId,
      p_period_start: args.periodStart,
      p_period_end: args.periodEnd,
    });
    if (error) throw error;
    return data;
  }

  async findDashboard(retailerId: RetailerId): Promise<PayrollPeriodDashboard> {
    const client = this.client as unknown as PayrollReadClient;
    const [periods, versions, snapshots, exceptions, exports] =
      await Promise.all([
        client
          .from("payroll_periods")
          .select("*")
          .eq("retailer_id", retailerId)
          .order("period_start", { ascending: false }),
        client
          .from("payroll_period_versions")
          .select("*")
          .eq("retailer_id", retailerId)
          .order("created_at", { ascending: false }),
        client
          .from("payroll_period_entry_snapshots")
          .select("*")
          .eq("retailer_id", retailerId)
          .order("created_at", { ascending: false }),
        client
          .from("payroll_period_exceptions")
          .select("*")
          .eq("retailer_id", retailerId)
          .order("created_at", { ascending: false }),
        client
          .from("payroll_period_exports")
          .select("*")
          .eq("retailer_id", retailerId)
          .order("created_at", { ascending: false }),
      ]);
    for (const result of [periods, versions, snapshots, exceptions, exports]) {
      if (result.error) throw result.error;
    }

    return {
      periods: (periods.data ?? []).map(toPeriod),
      versions: (versions.data ?? []).map(toVersion),
      snapshots: (snapshots.data ?? []).map(toSnapshot),
      exceptions: (exceptions.data ?? []).map(toException),
      exports: (exports.data ?? []).map(toExport),
    };
  }

  async correctEntry(args: {
    periodId: string;
    sourceTimeEntryId: string;
    clockInAt: string;
    clockOutAt: string;
    reason: string;
  }): Promise<string> {
    const { data, error } = await this.client.rpc("correct_payroll_entry", {
      p_period_id: args.periodId,
      p_source_time_entry_id: args.sourceTimeEntryId,
      p_clock_in_at: args.clockInAt,
      p_clock_out_at: args.clockOutAt,
      p_reason: args.reason,
    });
    if (error) throw error;
    return data;
  }

  async resolveException(exceptionId: string): Promise<void> {
    const { error } = await this.client.rpc("resolve_payroll_exception", {
      p_exception_id: exceptionId,
    });
    if (error) throw error;
  }

  async approve(periodId: string): Promise<string> {
    const { data, error } = await this.client.rpc("approve_payroll_period", {
      p_period_id: periodId,
    });
    if (error) throw error;
    return data;
  }

  /** The generic export is deliberately provider-neutral. Persisting belongs
   * to a later adapter boundary; this returns the checksummed exact rows. */
  buildExport(
    entries: readonly {
      staffId: string;
      clockInAt: string;
      clockOutAt?: string;
    }[],
  ) {
    return buildChecksummedPayrollExport(summarizePeriodHours(entries));
  }

  /** The RPC derives rows and checksum from the approved immutable version;
   * callers supply no mutable time data to the persistence boundary. */
  async recordExport(versionId: string): Promise<string> {
    const { data, error } = await this.client.rpc("record_payroll_export", {
      p_version_id: versionId,
    });
    if (error) throw error;
    return data;
  }

  /** Reads one immutable export through the tenant-scoped RLS path. The
   * retailer predicate is intentional defence in depth for route parameters. */
  async findRecordedExport(
    retailerId: RetailerId,
    exportId: string,
  ): Promise<PayrollExportHandoff | null> {
    const { data, error } = await this.client
      .from("payroll_period_exports")
      .select("id, version_id, rows, row_count, checksum, created_at")
      .eq("retailer_id", retailerId)
      .eq("id", exportId)
      .maybeSingle();
    if (error) throw error;
    return data ? toExportHandoff(data) : null;
  }
}

function row(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  return String(value ?? "");
}
function nullableText(value: unknown): string | null {
  return value == null ? null : String(value);
}
function number(value: unknown): number {
  return typeof value === "number" ? value : Number(value);
}
const toPeriod = (value: unknown): PayrollPeriodRecord => {
  const r = row(value);
  return {
    id: text(r.id),
    periodStart: text(r.period_start),
    periodEnd: text(r.period_end),
    currentVersionId: nullableText(r.current_version_id),
    createdAt: text(r.created_at),
  };
};
const toVersion = (value: unknown): PayrollPeriodVersionRecord => {
  const r = row(value);
  return {
    id: text(r.id),
    periodId: text(r.period_id),
    versionNumber: number(r.version_number),
    predecessorVersionId: nullableText(r.predecessor_version_id),
    state: text(r.state) === "approved" ? "approved" : "draft",
    preparedByStaffId: text(r.prepared_by_staff_id),
    approvedByStaffId: nullableText(r.approved_by_staff_id),
    approvedAt: nullableText(r.approved_at),
    createdAt: text(r.created_at),
  };
};
const toSnapshot = (value: unknown): PayrollEntrySnapshotRecord => {
  const r = row(value);
  return {
    id: text(r.id),
    versionId: text(r.version_id),
    sourceTimeEntryId: text(r.source_time_entry_id),
    staffId: text(r.staff_id),
    clockInAt: text(r.clock_in_at),
    clockOutAt: nullableText(r.clock_out_at),
  };
};
const toException = (value: unknown): PayrollExceptionRecord => {
  const r = row(value);
  return {
    id: text(r.id),
    versionId: text(r.version_id),
    sourceTimeEntryId: nullableText(r.source_time_entry_id),
    kind: text(r.kind),
    detail: text(r.detail),
    resolvedAt: nullableText(r.resolved_at),
  };
};
const toExport = (value: unknown): PayrollExportRecord => {
  const r = row(value);
  return {
    id: text(r.id),
    versionId: text(r.version_id),
    rowCount: number(r.row_count),
    checksum: text(r.checksum),
    createdAt: text(r.created_at),
  };
};
const toExportHandoff = (value: unknown): PayrollExportHandoff => {
  const r = row(value);
  return {
    ...toExport(value),
    rows: parseExportRows(r.rows),
  };
};

function parseExportRows(value: unknown): readonly PayrollExportRow[] {
  if (!Array.isArray(value)) throw new Error("Invalid recorded payroll export");
  return value.map((entry) => {
    const r = row(entry);
    const hours = number(r.hours);
    if (
      !text(r.staffId) ||
      !text(r.earningCode) ||
      !Number.isFinite(hours) ||
      hours < 0
    ) {
      throw new Error("Invalid recorded payroll export row");
    }
    return {
      staffId: text(r.staffId),
      earningCode: text(r.earningCode),
      hours,
    };
  });
}
