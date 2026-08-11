import { asId } from "@paon/domain";
import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";

import { PayrollPeriodRepository } from "./payroll-period-repository";

const retailerId = asId<"RetailerId">("11111111-1111-4111-8111-111111111111");

describe("PayrollPeriodRepository", () => {
  it("opens only through the authoritative RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "period-1", error: null });
    const repo = new PayrollPeriodRepository({
      rpc,
    } as unknown as PaonSupabaseClient);
    await expect(
      repo.open({
        retailerId,
        periodStart: "2026-08-01",
        periodEnd: "2026-08-15",
      }),
    ).resolves.toBe("period-1");
    expect(rpc).toHaveBeenCalledWith("open_payroll_period", {
      p_retailer_id: retailerId,
      p_period_start: "2026-08-01",
      p_period_end: "2026-08-15",
    });
  });

  it("produces stable generic export checksum from authoritative snapshots", () => {
    const repo = new PayrollPeriodRepository({} as PaonSupabaseClient);
    const result = repo.buildExport([
      {
        staffId: "staff-b",
        clockInAt: "2026-08-01T09:00:00Z",
        clockOutAt: "2026-08-01T20:00:00Z",
      },
    ]);
    expect(result).toEqual({
      rows: [
        { staffId: "staff-b", earningCode: "overtime", hours: 3 },
        { staffId: "staff-b", earningCode: "regular", hours: 8 },
      ],
      checksum: result.checksum,
      rowCount: 2,
    });
    expect(
      repo.buildExport([
        {
          staffId: "staff-b",
          clockInAt: "2026-08-01T09:00:00Z",
          clockOutAt: "2026-08-01T20:00:00Z",
        },
      ]).checksum,
    ).toBe(result.checksum);
  });

  it("does not permit caller-supplied rows or checksums at the export RPC boundary", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "export-1", error: null });
    const repo = new PayrollPeriodRepository({
      rpc,
    } as unknown as PaonSupabaseClient);
    await expect(repo.recordExport("version-1")).resolves.toBe("export-1");
    expect(rpc).toHaveBeenCalledWith("record_payroll_export", {
      p_version_id: "version-1",
    });
  });
});
