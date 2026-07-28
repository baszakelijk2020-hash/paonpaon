import {
  CommercialProspectRepository,
  EmailOutboxRepository,
} from "@paon/database";
import { sendEmail } from "@paon/email";
import { NextResponse } from "next/server";

import { getResendClient } from "@/lib/email";
import { env } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Drains `email_outbox` (docs/DECISIONS.md ADR-032) — a scheduled job,
 * not a webhook, so it authenticates via a shared secret rather than a
 * signature. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`
 * automatically for any project with that env var set (see
 * `vercel.json`); the same header works for manual/local triggering.
 * `docs/DATABASE.md` "Row Level Security" explicitly names scheduled
 * jobs as one of the few contexts allowed to use the service-role
 * client — this is exactly that case.
 *
 * Also runs Demo Studio expiry teardown on the same tick (Hobby caps
 * cron jobs at two daily slots — see docs/DEPLOYMENT.md). The dedicated
 * `/api/cron/expire-demo-environments` route remains for manual runs.
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
  const demosExpired = await new CommercialProspectRepository(
    admin,
  ).expireDueEnvironments();

  const resend = getResendClient();
  const fromEmail = env.resendFromEmail;
  if (!resend || !fromEmail) {
    return NextResponse.json(
      {
        error: "Resend is not configured on this deployment.",
        demosExpired,
      },
      { status: 503 },
    );
  }

  const outboxRepo = new EmailOutboxRepository(admin);
  const claimed = await outboxRepo.claimPending(20);

  let sent = 0;
  let failed = 0;
  for (const entry of claimed) {
    try {
      await sendEmail(resend, {
        from: fromEmail,
        to: entry.recipientEmail,
        subject: entry.subject,
        html: entry.htmlBody,
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

  return NextResponse.json({
    claimed: claimed.length,
    sent,
    failed,
    demosExpired,
  });
}

export async function GET(request: Request): Promise<Response> {
  return handleDispatch(request);
}

export async function POST(request: Request): Promise<Response> {
  return handleDispatch(request);
}
