"use server";
import { requireRetailerRole } from "@paon/auth";
import { MessagingRepository } from "@paon/database";
import { sendMessageSchema, startStaffConversationSchema } from "@paon/domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";
export async function startConversation(formData: FormData) {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "sales_associate");
  const value = startStaffConversationSchema.parse({
    customerId: formData.get("customerId"),
    body: formData.get("body") || "Hello — how may we help?",
  });
  const repo = new MessagingRepository(await getSupabaseServerClient());
  const id = await repo.getOrCreateForStaff(value.customerId as never);
  const messages = await repo.findMessages(id);
  if (messages.length === 0) await repo.send(id, value.body);
  redirect(`/messages/${id}`);
}
export async function sendMessage(formData: FormData) {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "sales_associate");
  const value = sendMessageSchema.parse({
    conversationId: formData.get("conversationId"),
    body: formData.get("body"),
  });
  const repo = new MessagingRepository(await getSupabaseServerClient());
  await repo.send(value.conversationId as never, value.body);
  revalidatePath(`/messages/${value.conversationId}`);
}
