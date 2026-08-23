import {
  buildMorningRoutineDeliveryNotification,
  evaluateMorningRoutineDelivery,
  filterCatalogueByEligibleProducts,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "./client-type";
import { MorningRoutineDeliveryRepository } from "./repositories/morning-routine-delivery-repository";
import { MorningRoutineRepository } from "./repositories/morning-routine-repository";
import { PlatformModuleRepository } from "./repositories/platform-module-repository";

/**
 * Enqueues MorningRoutine delivery for opted-in subscriptions from the
 * exact persisted selection for the local day. Does not require Resend —
 * notifications/outbox rows are created; email drain is separate.
 */
export async function orchestrateMorningRoutineDeliveries(
  admin: PaonSupabaseClient,
  nowUtcIso = new Date().toISOString(),
): Promise<{
  readonly considered: number;
  readonly queued: number;
  readonly skipped: number;
  readonly failed: number;
}> {
  const deliveryRepo = new MorningRoutineDeliveryRepository(admin);
  const selectionRepo = new MorningRoutineRepository(admin);
  const moduleRepo = new PlatformModuleRepository(admin);
  const subscriptions = await deliveryRepo.listOptedInSubscriptions(200);
  const moduleEnabledByRetailer = new Map<RetailerId, boolean>();

  let queued = 0;
  let skipped = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    try {
      let moduleEnabled = moduleEnabledByRetailer.get(subscription.retailerId);
      if (moduleEnabled === undefined) {
        moduleEnabled = await moduleRepo.jobEnabled({
          retailerId: subscription.retailerId,
          jobKey: "morning_routine_delivery",
        });
        moduleEnabledByRetailer.set(subscription.retailerId, moduleEnabled);
      }
      if (!moduleEnabled) {
        skipped += 1;
        continue;
      }

      const settings = await deliveryRepo.getRetailerSettings(
        subscription.retailerId,
      );
      const probe = evaluateMorningRoutineDelivery({
        subscription,
        nowUtcIso,
        alreadyDeliveredForDate: false,
        selectionId: "00000000-0000-4000-8000-000000000000",
        retailerPaused: settings?.paused ?? false,
      });
      const forDate = probe.forDate;
      const already = await deliveryRepo.hasSuccessfulDelivery(
        subscription.customerId,
        forDate,
      );
      const latestUnscoped = await selectionRepo.findLatestForCustomerDay(
        subscription.customerId,
        forDate,
      );
      // This orchestrator runs with a service-role client, which bypasses RLS,
      // and findLatestForCustomerDay() has no app-level retailer filter —
      // verify ownership here so a selection cannot cross a retailer boundary.
      const latest =
        latestUnscoped &&
        latestUnscoped.selection.retailerId === subscription.retailerId
          ? latestUnscoped
          : null;

      const eligibleIds = await deliveryRepo.listActiveEligibleProductIds(
        subscription.retailerId,
      );
      const filtered = latest
        ? filterCatalogueByEligibleProducts(latest.recommendations, eligibleIds)
        : { kept: [], suppressedCatalogueCount: 0 };

      const decision = evaluateMorningRoutineDelivery({
        subscription,
        nowUtcIso,
        alreadyDeliveredForDate: already,
        ...(latest?.selection.id ? { selectionId: latest.selection.id } : {}),
        retailerPaused: settings?.paused ?? false,
      });

      if (!decision.ok) {
        await deliveryRepo.recordDeliveryAudit({
          retailerId: subscription.retailerId,
          customerId: subscription.customerId,
          forDate: decision.forDate,
          outcome: decision.outcome,
          scheduledFor: nowUtcIso,
          ...(latest?.selection.id ? { selectionId: latest.selection.id } : {}),
          ...(decision.suppressionReason
            ? { suppressionReason: decision.suppressionReason }
            : {}),
        });
        skipped += 1;
        continue;
      }

      if (!latest) {
        skipped += 1;
        continue;
      }

      const note = buildMorningRoutineDeliveryNotification({
        summary: latest.selection.summary,
        forDate: decision.forDate,
        recommendationCount: filtered.kept.length,
      });

      let notificationId: string | undefined;
      let outcome: "queued_in_app" | "queued_email" = "queued_in_app";
      for (const channel of decision.channels) {
        notificationId = await deliveryRepo.enqueueDeliveryNotification({
          retailerId: subscription.retailerId,
          customerId: subscription.customerId,
          title: note.title,
          body: note.body,
          channel,
          actionHref: note.actionHref,
        });
        if (channel === "email") outcome = "queued_email";
      }

      await deliveryRepo.recordDeliveryAudit({
        retailerId: subscription.retailerId,
        customerId: subscription.customerId,
        forDate: decision.forDate,
        outcome,
        scheduledFor: nowUtcIso,
        selectionId: latest.selection.id,
        ...(notificationId ? { notificationId } : {}),
        ...(filtered.suppressedCatalogueCount > 0
          ? { suppressionReason: "product_not_eligible" }
          : {}),
      });
      queued += 1;
    } catch {
      failed += 1;
    }
  }

  return {
    considered: subscriptions.length,
    queued,
    skipped,
    failed,
  };
}
