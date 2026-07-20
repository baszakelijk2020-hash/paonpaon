import { SmsOutboxRepository } from "@paon/database";
import { sendText } from "@paon/sms";
import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { getTwilioClient } from "@/lib/sms";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Drains `sms_outbox` — same shape as `dispatch-emails`
 * (docs/DECISIONS.md ADR-032), covering both SMS and WhatsApp since
 * Twilio handles both through one client. Shared-secret auth, not a
 * webhook signature, for the same reason dispatch-emails uses one.
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

  const client = getTwilioClient();
  const fromNumber = env.twilioSmsFrom;
  if (!client || !fromNumber) {
    return NextResponse.json(
      { error: "Twilio is not configured on this deployment." },
      { status: 503 },
    );
  }

  const outboxRepo = new SmsOutboxRepository(getSupabaseAdminClient());
  const claimed = await outboxRepo.claimPending(20);

  let sent = 0;
  let failed = 0;
  for (const entry of claimed) {
    try {
      await sendText(client, {
        channel: entry.channel,
        from:
          entry.channel === "whatsapp"
            ? (env.twilioWhatsappFrom ?? fromNumber)
            : fromNumber,
        to: entry.recipientPhone,
        body: entry.body,
      });
      await outboxRepo.markSent(entry.id);
      sent += 1;
    } catch (error) {
      await outboxRepo.markFailed(
        entry.id,
        entry.attempts,
        error instanceof Error ? error.message : "Unknown error",
      );
      failed += 1;
    }
  }

  return NextResponse.json({ claimed: claimed.length, sent, failed });
}

export async function GET(request: Request): Promise<Response> {
  return handleDispatch(request);
}

export async function POST(request: Request): Promise<Response> {
  return handleDispatch(request);
}
