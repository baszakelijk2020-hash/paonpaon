import {
  buildChecksummedPayrollExport,
  summarizePeriodHours,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";

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

  async correctEntry(args: {
    periodId: string;
    sourceTimeEntryId: string;
    clockInAt: string;
    clockOutAt?: string;
    reason: string;
  }): Promise<string> {
    const { data, error } = await this.client.rpc("correct_payroll_entry", {
      p_period_id: args.periodId,
      p_source_time_entry_id: args.sourceTimeEntryId,
      p_clock_in_at: args.clockInAt,
      p_clock_out_at: args.clockOutAt ?? null,
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
}
