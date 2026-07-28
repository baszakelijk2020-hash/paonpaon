import { CommercialProspectRepository } from "@paon/database";
import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Demo Studio A.4 — expire published prospect demos past `expires_at` and
 * suspend their seeded retailers so `/r/{slug}` 404s via the existing
 * active-only gate. Same CRON_SECRET Bearer auth as the email/SMS jobs.
 *
 * Not scheduled in `vercel.json` — Hobby allows only two daily crons
 * (already used by dispatch-emails / dispatch-sms). The daily email tick
 * also calls `expireDueEnvironments`; this route is for manual/ops runs.
 */
async function handleExpire(request: Request): Promise<Response> {
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

  const expired = await new CommercialProspectRepository(
    getSupabaseAdminClient(),
  ).expireDueEnvironments();

  return NextResponse.json({ expired });
}

export async function GET(request: Request): Promise<Response> {
  return handleExpire(request);
}

export async function POST(request: Request): Promise<Response> {
  return handleExpire(request);
}
