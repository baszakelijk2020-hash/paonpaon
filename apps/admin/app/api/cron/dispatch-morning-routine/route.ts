import {
  AppointmentRepository,
  buildMorningRoutineSelectionForDelivery,
  CustomerConsentRepository,
  CustomerRepository,
  MorningRoutineDeliveryRepository,
  MorningRoutineRepository,
  RetailerRepository,
} from "@paon/database";
import {
  buildMorningRoutineDeliveryPayload,
  buildMorningRoutineEmailHtml,
  buildMorningRoutineNotificationContent,
  getLocalDateString,
  getLocalDayOfWeek,
  getLocalHour,
  isPurposeGranted,
  shouldDeliverMorningRoutine,
  type MorningRoutineDeliveryChannel,
} from "@paon/domain";
import { asId } from "@paon/domain";
import { NextResponse } from "next/server";

import { AppointmentCalendarProvider } from "@/lib/calendar-from-appointments";
import { env } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { OpenWeatherProvider } from "@/lib/weather";

/**
 * Scheduled MorningRoutine delivery (PHASE 4.5 / MR-002).
 * Derives from the exact routine selection, respects explicit opt-in,
 * quiet periods, and retailer eligible-product controls — never marketing consent.
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

  const customerAppUrl = env.customerAppUrl;
  if (!customerAppUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_CUSTOMER_APP_URL is not configured." },
      { status: 503 },
    );
  }

  const admin = getSupabaseAdminClient();
  const deliveryRepo = new MorningRoutineDeliveryRepository(admin);
  const routineRepo = new MorningRoutineRepository(admin);
  const consentRepo = new CustomerConsentRepository(admin);
  const customerRepo = new CustomerRepository(admin);
  const retailerRepo = new RetailerRepository(admin);
  const now = new Date();

  const subscriptions = await deliveryRepo.listActiveSubscriptions();
  let attempted = 0;
  let sent = 0;
  let suppressed = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    const forDate = getLocalDateString(now, subscription.timezone);
    const localHour = getLocalHour(now, subscription.timezone);
    const localDow = getLocalDayOfWeek(now, subscription.timezone);

    const consentState = await consentRepo.getState(
      asId<"RetailerId">(subscription.retailerId),
      asId<"CustomerId">(subscription.customerId),
    );
    const retailerSettings = await deliveryRepo.getRetailerSettings(
      subscription.retailerId,
    );
    const deliveries = await deliveryRepo.listDeliveriesForCustomerDay(
      subscription.customerId,
      forDate,
    );
    const deliveredChannelsToday = deliveries
      .filter((delivery) => delivery.status === "sent")
      .map((delivery) => delivery.channel);
    const lastWeeklyDeliveryDate =
      await deliveryRepo.findLastWeeklyDeliveryDate(
        subscription.customerId,
        subscription.retailerId,
      );

    const decision = shouldDeliverMorningRoutine({
      subscription,
      retailerSettings,
      personalizationGranted: isPurposeGranted(consentState, "personalization"),
      now,
      forDate,
      localHour,
      localDow,
      deliveredChannelsToday,
      ...(lastWeeklyDeliveryDate ? { lastWeeklyDeliveryDate } : {}),
    });

    if (!decision.deliver) {
      if (
        decision.reason &&
        decision.reason !== "not_due_yet" &&
        decision.reason !== "wrong_frequency" &&
        decision.reason !== "quiet_period"
      ) {
        for (const channel of subscription.channels) {
          if (deliveredChannelsToday.includes(channel)) continue;
          await deliveryRepo.recordDelivery({
            retailerId: String(subscription.retailerId),
            customerId: String(subscription.customerId),
            forDate,
            channel,
            status: "suppressed",
            payload: {},
            suppressedReason: decision.reason,
          });
          suppressed += 1;
        }
      }
      continue;
    }

    attempted += 1;

    try {
      const built = await buildMorningRoutineSelectionForDelivery({
        client: admin,
        deliveryRepo,
        retailerId: String(subscription.retailerId),
        customerId: String(subscription.customerId),
        forDate,
        weatherProvider: new OpenWeatherProvider(),
        calendarProvider: new AppointmentCalendarProvider(
          new AppointmentRepository(admin),
        ),
      });

      if (!built) {
        for (const channel of subscription.channels) {
          if (deliveredChannelsToday.includes(channel)) continue;
          await deliveryRepo.recordDelivery({
            retailerId: String(subscription.retailerId),
            customerId: String(subscription.customerId),
            forDate,
            channel,
            status: "suppressed",
            payload: {},
            suppressedReason: "no_selection",
          });
          suppressed += 1;
        }
        continue;
      }

      const view = await routineRepo.findById(built.selectionId);
      if (!view) continue;

      const retailer = await retailerRepo.findById(
        asId<"RetailerId">(subscription.retailerId),
      );
      const payload = buildMorningRoutineDeliveryPayload({
        selection: { ...view.selection, id: view.selection.id },
        customerAppBaseUrl: customerAppUrl.replace(/\/$/, ""),
        retailerSlug: retailer?.slug ?? "store",
        unsubscribeToken: subscription.unsubscribeToken,
      });
      const notification = buildMorningRoutineNotificationContent(
        payload,
        retailer?.displayName ?? "Retailer",
      );

      for (const channel of subscription.channels) {
        if (deliveredChannelsToday.includes(channel)) continue;

        if (channel === "in_app") {
          const notificationId = await deliveryRepo.createInAppNotification({
            retailerId: String(subscription.retailerId),
            customerId: String(subscription.customerId),
            title: notification.title,
            body: notification.body,
            actionHref: notification.actionHref,
          });
          await deliveryRepo.recordDelivery({
            retailerId: String(subscription.retailerId),
            customerId: String(subscription.customerId),
            selectionId: built.selectionId,
            forDate,
            channel: channel satisfies MorningRoutineDeliveryChannel,
            status: "sent",
            payload,
            notificationId,
          });
          sent += 1;
        }

        if (channel === "email") {
          const customer = await customerRepo.findById(
            asId<"CustomerId">(subscription.customerId),
          );
          const email = customer?.email;
          if (!email) {
            await deliveryRepo.recordDelivery({
              retailerId: String(subscription.retailerId),
              customerId: String(subscription.customerId),
              selectionId: built.selectionId,
              forDate,
              channel,
              status: "suppressed",
              payload,
              suppressedReason: "no_email_on_file",
            });
            suppressed += 1;
            continue;
          }

          const html = buildMorningRoutineEmailHtml(
            payload,
            retailer?.displayName ?? "Retailer",
          );
          const emailOutboxId = await deliveryRepo.enqueueEmail({
            recipientEmail: email,
            subject: notification.title,
            htmlBody: html,
          });
          await deliveryRepo.recordDelivery({
            retailerId: String(subscription.retailerId),
            customerId: String(subscription.customerId),
            selectionId: built.selectionId,
            forDate,
            channel,
            status: "sent",
            payload,
            emailOutboxId,
          });
          sent += 1;
        }
      }
    } catch {
      failed += 1;
    }
  }

  return NextResponse.json({
    attempted,
    sent,
    suppressed,
    failed,
    subscriptions: subscriptions.length,
  });
}

export async function GET(request: Request): Promise<Response> {
  return handleDispatch(request);
}

export async function POST(request: Request): Promise<Response> {
  return handleDispatch(request);
}
