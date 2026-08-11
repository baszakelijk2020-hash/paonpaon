import { requireRetailerRole } from "@paon/auth";
import {
  PayrollPeriodRepository,
  type PayrollExportHandoff,
} from "@paon/database";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const formats = new Set(["csv", "json"]);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  context: { params: Promise<{ exportId: string; format: string }> },
) {
  const { exportId, format } = await context.params;
  if (!formats.has(format))
    return new Response("Unknown export format", { status: 404 });
  if (!uuidPattern.test(exportId))
    return new Response("Payroll export not found", { status: 404 });

  let session;
  try {
    session = await requireModuleSession("retail_operations", "read");
    requireRetailerRole(session.retailerRole, "manager");
  } catch {
    return new Response("Forbidden", { status: 403 });
  }

  const payrollExport = await new PayrollPeriodRepository(
    await getSupabaseServerClient(),
  ).findRecordedExport(session.retailerId, exportId);
  if (!payrollExport)
    return new Response("Payroll export not found", { status: 404 });

  const extension = format === "csv" ? "csv" : "json";
  return new Response(
    format === "csv"
      ? toCsv(payrollExport)
      : JSON.stringify(toJson(payrollExport)),
    {
      status: 200,
      headers: {
        "Content-Type":
          format === "csv"
            ? "text/csv; charset=utf-8"
            : "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="payroll-export-${payrollExport.id}.${extension}"`,
        "Cache-Control": "private, no-store",
      },
    },
  );
}

function toCsv(payrollExport: PayrollExportHandoff): string {
  return [
    "staff_id,earning_code,hours",
    ...payrollExport.rows.map((row) =>
      [row.staffId, row.earningCode, row.hours].map(csvValue).join(","),
    ),
  ].join("\n");
}

function toJson(payrollExport: PayrollExportHandoff) {
  return {
    metadata: {
      exportId: payrollExport.id,
      versionId: payrollExport.versionId,
      rowCount: payrollExport.rowCount,
      checksum: payrollExport.checksum,
      createdAt: payrollExport.createdAt,
    },
    rows: payrollExport.rows,
  };
}

function csvValue(value: string | number): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
