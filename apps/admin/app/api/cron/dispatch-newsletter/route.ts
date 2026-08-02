import {
  NewsletterRepository,
  PlatformModuleRepository,
  ProductRepository,
  RetailerRepository,
} from "@paon/database";
import { sendEmail } from "@paon/email";
import { NextResponse } from "next/server";

import { getResendClient } from "@/lib/email";
import { env } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * The daily "Morning Routine" digest (ADR-035) — one featured product
 * ("today's pick") per retailer, mailed to every active newsletter
 * subscriber. Not wired into vercel.json's crons: Vercel's Hobby plan
 * caps the number of scheduled cron jobs per project, and
 * dispatch-emails/dispatch-sms already claim the available slots — see
 * docs/PROJECT_STATE.md "Credentials needed" for how to trigger this
 * (manually, an external scheduler, or folding it into an existing
 * cron tick) once ready to enable it. Same CRON_SECRET auth as the
 * other dispatch routes either way.
 *
 * Deliberately no AI/behavioral personalisation here — a newsletter
 * subscriber may not be a full Customer yet (no browsing history to
 * personalise against), unlike Today's Pick. The "featured product" is
 * simply the retailer's most recently added active product.
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

  const resend = getResendClient();
  const fromEmail = env.resendFromEmail;
  const customerAppUrl = env.customerAppUrl;
  if (!resend || !fromEmail || !customerAppUrl) {
    return NextResponse.json(
      {
        error:
          "Resend and/or NEXT_PUBLIC_CUSTOMER_APP_URL are not configured on this deployment.",
      },
      { status: 503 },
    );
  }

  const supabase = getSupabaseAdminClient();
  const subscribersByRetailer = await new NewsletterRepository(
    supabase,
  ).findAllActiveGroupedByRetailer();
  const retailerRepo = new RetailerRepository(supabase);
  const productRepo = new ProductRepository(supabase);
  const moduleRepo = new PlatformModuleRepository(supabase);

  let sent = 0;
  let skipped = 0;

  for (const [retailerId, subscribers] of subscribersByRetailer) {
    if (subscribers.length === 0) continue;

    const retailer = await retailerRepo.findById(retailerId);
    if (!retailer || retailer.status !== "active") {
      skipped += subscribers.length;
      continue;
    }

    const moduleEnabled = await moduleRepo.jobEnabled({
      retailerId,
      jobKey: "morning_routine_delivery",
    });
    if (!moduleEnabled) {
      skipped += subscribers.length;
      continue;
    }

    const products = (await productRepo.findByRetailer(retailerId))
      .filter((product) => product.status === "active")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const featured = products[0];
    if (!featured) {
      skipped += subscribers.length;
      continue;
    }

    const storefrontUrl = `${customerAppUrl}/r/${retailer.slug}/products/${featured.slug}`;
    const html = `
      <p>Good morning,</p>
      <p>Today's pick from ${retailer.displayName}:</p>
      ${featured.primaryImageUrl ? `<p><img src="${featured.primaryImageUrl}" alt="" width="320" /></p>` : ""}
      <p><strong>${featured.name}</strong></p>
      <p><a href="${storefrontUrl}">View it</a></p>
    `.trim();

    for (const subscriber of subscribers) {
      try {
        await sendEmail(resend, {
          from: fromEmail,
          to: subscriber.email,
          subject: `Today's pick from ${retailer.displayName}`,
          html,
        });
        sent += 1;
      } catch {
        skipped += 1;
      }
    }
  }

  return NextResponse.json({ sent, skipped });
}

export async function GET(request: Request): Promise<Response> {
  return handleDispatch(request);
}

export async function POST(request: Request): Promise<Response> {
  return handleDispatch(request);
}
