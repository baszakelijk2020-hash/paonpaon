import { orchestrateShopifyDeltaSync } from "@paon/database";
import { asId, type RetailerId } from "@paon/domain";
import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Scheduled Shopify delta sync orchestration (PHASE 9.2) — runs across all
 * active Shopify connections in the system once per tick. Faden connections
 * are webhook-driven, not polled, so only Shopify appears here.
 *
 * Like dispatch-newsletter/dispatch-emails, this authenticates via a shared
 * CRON_SECRET header rather than a signature. Not wired into vercel.json's
 * crons (Vercel Hobby plan already has two daily jobs at capacity) — run via
 * an external scheduler, `curl`, or fold this logic into an existing cron
 * handler if needed.
 */
async function handleDispatch(request: Request): Promise<Response> {
  const cronSecret = env.cronSecret;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured on this deployment." },
      { status: 503 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();

  // Query all active Shopify connections across all retailers
  const { data: connections, error } = await admin
    .from("integration_connections")
    .select("id, retailer_id, provider")
    .eq("provider", "shopify")
    .eq("operational_state", "active")
    .is("deleted_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: Array<{
    readonly connectionId: string;
    readonly retailerId: RetailerId;
    readonly status: "succeeded" | "failed";
    readonly error?: string;
  }> = [];

  for (const connection of connections ?? []) {
    const retailerId = asId<"RetailerId">(connection.retailer_id);
    try {
      const result = await orchestrateShopifyDeltaSync(admin, {
        retailerId,
        connectionId: connection.id,
        triggerKind: "scheduled",
      });
      results.push({
        connectionId: connection.id,
        retailerId,
        status: result.status,
        ...(result.status === "failed" ? { error: result.errorSummary } : {}),
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "unknown error";
      results.push({
        connectionId: connection.id,
        retailerId,
        status: "failed",
        error: errorMessage,
      });
    }
  }

  const processed = results.length;
  const succeeded = results.filter((r) => r.status === "succeeded").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const errors = results
    .filter((r) => r.error)
    .map((r) => ({
      connectionId: r.connectionId,
      retailerId: r.retailerId,
      error: r.error,
    }));

  return NextResponse.json({
    processed,
    succeeded,
    failed,
    errors,
  });
}

export async function GET(request: Request): Promise<Response> {
  return handleDispatch(request);
}

export async function POST(request: Request): Promise<Response> {
  return handleDispatch(request);
}
