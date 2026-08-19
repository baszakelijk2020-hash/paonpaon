"use server";

import { requireRetailerRole } from "@paon/auth";
import {
  ClientelingRepository,
  OrderRepository,
  RetailerStaffRepository,
} from "@paon/database";
import { asId, updateOrderStatusInputSchema } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface UpdateOrderStatusFormState {
  formError?: string;
}

export async function updateOrderStatus(
  orderId: string,
  _prevState: UpdateOrderStatusFormState,
  formData: FormData,
): Promise<UpdateOrderStatusFormState> {
  const session = await requireModuleSession("commerce_growth");
  requireRetailerRole(session.retailerRole, "production_staff");

  const parsed = updateOrderStatusInputSchema.safeParse({
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { formError: "Choose a valid status." };
  }

  const supabase = await getSupabaseServerClient();

  try {
    await new OrderRepository(supabase).updateStatus(
      asId<"OrderId">(orderId),
      parsed.data.status,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { formError: message };
  }

  revalidatePath(`/orders/${orderId}`);
  return {};
}

export interface OrderActionState {
  formError?: string;
}

/**
 * A client paying at the counter (Critical 3, partial mitigation — no
 * Stripe/Resend keys are required for this path). Moves a
 * `pending_payment` order to `placed` the same way the eventual Stripe
 * webhook would; a real `Payment` record still requires the provider
 * integration, so this is scoped to the order status only, not a
 * fabricated payment row.
 */
export async function markPaidInStore(
  orderId: string,
  _prevState: OrderActionState,
  _formData: FormData,
): Promise<OrderActionState> {
  const session = await requireModuleSession("commerce_growth");
  requireRetailerRole(session.retailerRole, "production_staff");

  const supabase = await getSupabaseServerClient();
  const orderRepo = new OrderRepository(supabase);
  const order = await orderRepo.findById(asId<"OrderId">(orderId));
  if (!order || order.retailerId !== session.retailerId) {
    return { formError: "Order not found." };
  }
  if (order.status !== "pending_payment") {
    return { formError: "Only orders awaiting payment can be marked paid." };
  }

  try {
    await orderRepo.updateStatus(order.id, "placed");
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { formError: message };
  }

  revalidatePath(`/orders/${orderId}`);
  return {};
}

/**
 * Critical 8 mitigation: there is no dedicated Return aggregate yet, so
 * this records the outcome the domain already models — `refunded` is a
 * terminal `OrderStatus` — and leaves an attributable clienteling note
 * with the reason, the same audit trail staff already rely on for every
 * other client-facing decision on this record.
 */
export async function requestReturn(
  orderId: string,
  _prevState: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const session = await requireModuleSession("commerce_growth");
  requireRetailerRole(session.retailerRole, "production_staff");

  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) {
    return { formError: "Describe the reason for the return." };
  }

  const supabase = await getSupabaseServerClient();
  const orderRepo = new OrderRepository(supabase);
  const order = await orderRepo.findById(asId<"OrderId">(orderId));
  if (!order || order.retailerId !== session.retailerId) {
    return { formError: "Order not found." };
  }
  if (order.status === "refunded") {
    return { formError: "This order has already been refunded." };
  }

  const staff = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );

  try {
    await orderRepo.updateStatus(order.id, "refunded");
    if (staff) {
      await new ClientelingRepository(supabase).create({
        retailerId: session.retailerId,
        customerId: order.customerId,
        authorStaffId: staff.id,
        body: `Return requested for order ${order.orderNumber}: ${reason}`,
        pinned: false,
        // An operational order-status note, not personal relationship
        // intelligence — retailer_shared matches the pre-existing
        // behavior this system-authored category always had (ADR-075).
        visibility: "retailer_shared",
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { formError: message };
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath(`/customers/${order.customerId}`);
  return {};
}
