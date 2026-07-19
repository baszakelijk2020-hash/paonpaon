"use server";

import { requireRetailerRole } from "@paon/auth";
import { ClientelingRepository, RetailerStaffRepository } from "@paon/database";
import { createClientelingNoteSchema } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function createClientelingNote(formData: FormData) {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "sales_associate");
  const value = createClientelingNoteSchema.parse({
    customerId: formData.get("customerId"),
    body: formData.get("body"),
    pinned: formData.get("pinned") === "on",
  });
  const client = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(client).findByUserId(
    session.userId,
  );
  if (!staff || staff.retailerId !== session.retailerId)
    throw new Error("Active staff membership required");
  await new ClientelingRepository(client).create({
    retailerId: session.retailerId,
    customerId: value.customerId as never,
    authorStaffId: staff.id,
    body: value.body,
    pinned: value.pinned,
  });
  revalidatePath(`/customers/${value.customerId}`);
}
