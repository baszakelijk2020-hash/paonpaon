"use server";

import { requireRetailerRole } from "@paon/auth";
import { PayrollPeriodRepository } from "@paon/database";
import { revalidatePath } from "next/cache";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface PayrollActionState {
  readonly formError?: string;
  readonly notice?: string;
}

const payrollPath = "/staff/payroll";
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function input(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function databaseError(error: unknown, fallback: string): PayrollActionState {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : "";
  if (code === "PPA01") {
    return { formError: "A different manager must approve this period." };
  }
  return { formError: fallback };
}

async function managerRepository(): Promise<PayrollPeriodRepository> {
  const session = await requireModuleSession("retail_operations");
  requireRetailerRole(session.retailerRole, "manager");
  return new PayrollPeriodRepository(await getSupabaseServerClient());
}

export async function openPayrollPeriod(
  _previous: PayrollActionState,
  formData: FormData,
): Promise<PayrollActionState> {
  const start = input(formData, "periodStart");
  const end = input(formData, "periodEnd");
  if (!datePattern.test(start) || !datePattern.test(end) || end < start) {
    return { formError: "Choose a valid start and end date." };
  }
  try {
    const session = await requireModuleSession("retail_operations");
    requireRetailerRole(session.retailerRole, "manager");
    await new PayrollPeriodRepository(await getSupabaseServerClient()).open({
      retailerId: session.retailerId,
      periodStart: start,
      periodEnd: end,
    });
  } catch (error) {
    return databaseError(error, "That payroll period could not be opened.");
  }
  revalidatePath(payrollPath);
  return { notice: "Payroll period opened as version 1." };
}

export async function resolvePayrollException(
  _previous: PayrollActionState,
  formData: FormData,
): Promise<PayrollActionState> {
  const exceptionId = input(formData, "exceptionId");
  if (!uuidPattern.test(exceptionId))
    return { formError: "Choose a valid exception." };
  try {
    await (await managerRepository()).resolveException(exceptionId);
  } catch (error) {
    return databaseError(
      error,
      "That payroll exception could not be resolved.",
    );
  }
  revalidatePath(payrollPath);
  return { notice: "Exception resolved." };
}

export async function correctPayrollEntry(
  _previous: PayrollActionState,
  formData: FormData,
): Promise<PayrollActionState> {
  const periodId = input(formData, "periodId");
  const sourceTimeEntryId = input(formData, "sourceTimeEntryId");
  const clockInAt = input(formData, "clockInAt");
  const clockOutAt = input(formData, "clockOutAt");
  const reason = input(formData, "reason");
  if (!uuidPattern.test(periodId) || !uuidPattern.test(sourceTimeEntryId))
    return { formError: "Choose a valid payroll entry." };
  if (
    !clockInAt ||
    !clockOutAt ||
    Date.parse(clockOutAt) <= Date.parse(clockInAt)
  )
    return { formError: "Clock-out must be after clock-in." };
  if (!reason || reason.length > 1000)
    return { formError: "Give a correction reason of up to 1000 characters." };
  try {
    await (
      await managerRepository()
    ).correctEntry({
      periodId,
      sourceTimeEntryId,
      clockInAt: new Date(clockInAt).toISOString(),
      clockOutAt: new Date(clockOutAt).toISOString(),
      reason,
    });
  } catch (error) {
    return databaseError(error, "That time entry could not be corrected.");
  }
  revalidatePath(payrollPath);
  return { notice: "Correction saved in a new payroll version." };
}

export async function approvePayrollPeriod(
  _previous: PayrollActionState,
  formData: FormData,
): Promise<PayrollActionState> {
  const periodId = input(formData, "periodId");
  if (!uuidPattern.test(periodId))
    return { formError: "Choose a valid payroll period." };
  try {
    await (await managerRepository()).approve(periodId);
  } catch (error) {
    return databaseError(error, "That payroll period could not be approved.");
  }
  revalidatePath(payrollPath);
  return { notice: "Payroll period independently approved." };
}

export async function recordPayrollExport(
  _previous: PayrollActionState,
  formData: FormData,
): Promise<PayrollActionState> {
  const versionId = input(formData, "versionId");
  if (!uuidPattern.test(versionId))
    return { formError: "Choose a valid approved version." };
  try {
    await (await managerRepository()).recordExport(versionId);
  } catch (error) {
    return databaseError(error, "That payroll export could not be recorded.");
  }
  revalidatePath(payrollPath);
  return { notice: "Checksummed export recorded." };
}
