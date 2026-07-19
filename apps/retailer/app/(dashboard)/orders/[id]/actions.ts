"use server";

import { requireRetailerRole } from "@paon/auth";
import { OrderRepository } from "@paon/database";
import { asId, updateOrderStatusInputSchema } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface UpdateOrderStatusFormState {
  formError?: string;
}

export async function updateOrderStatus(
  orderId: string,
  _prevState: UpdateOrderStatusFormState,
  formData: FormData,
): Promise<UpdateOrderStatusFormState> {
  const session = await requireSession();
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
