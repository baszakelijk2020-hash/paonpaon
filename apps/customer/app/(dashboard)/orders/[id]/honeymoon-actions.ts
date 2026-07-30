"use server";

import { HoneymoonRepository } from "@paon/database";
import { asId } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function completeHoneymoonMilestone(
  formData: FormData,
): Promise<void> {
  await requireSession();
  const milestoneId = String(formData.get("milestoneId") ?? "");
  const orderId = String(formData.get("orderId") ?? "");
  await new HoneymoonRepository(
    await getSupabaseServerClient(),
  ).completeMilestone(milestoneId);
  revalidatePath(`/orders/${orderId}`);
}

export async function syncHoneymoonMilestones(orderId: string): Promise<void> {
  await requireSession();
  const supabase = await getSupabaseServerClient();
  const { OrderRepository, ProductVariantRepository } = await import(
    "@paon/database"
  );
  const orderRepo = new OrderRepository(supabase);
  const order = await orderRepo.findById(asId<"OrderId">(orderId));
  if (!order) return;

  const lines = await orderRepo.findLinesByOrder(order.id);
  const variantRepo = new ProductVariantRepository(supabase);
  const lineContexts = await Promise.all(
    lines.map(async (line) => {
      const variant = await variantRepo.findById(line.productVariantId);
      return {
        productVariantId: line.productVariantId,
        sku: variant?.sku,
        quantity: line.quantity,
        requiresProduction: line.requiresProduction,
        requiresAlteration: line.requiresAlteration,
        leadTimeDays: variant?.leadTimeDays ?? null,
        inventoryQuantity: variant?.inventoryQuantity ?? null,
      };
    }),
  );

  await new HoneymoonRepository(supabase).syncMilestonesForOrder({
    orderId: order.id,
    orderStatus: order.status,
    ...(order.placedAt ? { placedAt: order.placedAt } : {}),
    lines: lineContexts,
    nowUtcIso: new Date().toISOString(),
    recentTouchCount: 0,
  });
}
