import { createSupabaseAdminClient } from "./clients/admin";
import type { Json } from "./generated/database.types";

export type ErrorReportApp = "admin" | "retailer" | "customer";

export interface ErrorReportInput {
  app: ErrorReportApp;
  environment: string;
  level?: "error" | "warning";
  route?: string;
  message: string;
  stack?: string;
  requestId?: string;
  context?: Record<string, unknown>;
}

const SENSITIVE_KEY_PATTERN =
  /password|token|secret|cookie|apikey|api_key|authorization|session/i;

function sanitizeContext(context: Record<string, unknown> | undefined): Json {
  if (!context) return {};
  const safe: Record<string, Json> = {};
  for (const [key, value] of Object.entries(context)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) continue;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      safe[key] = value;
    }
  }
  return safe;
}

/**
 * Fire-and-forget production error capture. Must never throw or reject —
 * a broken reporter must not become a second outage on top of whatever it
 * was trying to report. Backed by Supabase today (see
 * supabase/migrations/20260821000000_create_error_events.sql); the intent
 * is that a future Sentry/other SDK swap only touches this one function's
 * body, not any call site.
 */
export async function reportError(input: ErrorReportInput): Promise<void> {
  try {
    const supabaseUrl =
      process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? process.env["SUPABASE_URL"];
    const serviceRoleKey =
      process.env["SUPABASE_SERVICE_ROLE_KEY"] ??
      process.env["SUPABASE_SECRET_KEY"];

    if (!supabaseUrl || !serviceRoleKey) {
      console.error(
        "[error-reporting] missing Supabase service credentials, dropping report:",
        input.message,
      );
      return;
    }

    const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
    const { error } = await admin.from("error_events").insert({
      app: input.app,
      environment: input.environment,
      level: input.level ?? "error",
      route: input.route ?? null,
      message: input.message.slice(0, 4000),
      stack: input.stack ? input.stack.slice(0, 8000) : null,
      request_id: input.requestId ?? null,
      context: sanitizeContext(input.context),
    });

    if (error) {
      console.error(
        "[error-reporting] failed to persist error event:",
        error.message,
      );
    }
  } catch (reportingFailure) {
    console.error(
      "[error-reporting] reporter threw, dropping report:",
      reportingFailure,
    );
  }
}
