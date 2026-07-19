"use server";
import { MessagingRepository } from "@paon/database";
import {
  sendMessageSchema,
  startCustomerConversationSchema,
} from "@paon/domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";
export async function startConversation(formData: FormData) {
  await requireSession();
  const value = startCustomerConversationSchema.parse({
    retailerId: formData.get("retailerId"),
    body: formData.get("body"),
  });
  const repo = new MessagingRepository(await getSupabaseServerClient());
  const id = await repo.getOrCreateForCustomer(value.retailerId as never);
  await repo.send(id, value.body);
  redirect(`/messages/${id}`);
}
export async function sendMessage(formData: FormData) {
  await requireSession();
  const value = sendMessageSchema.parse({
    conversationId: formData.get("conversationId"),
    body: formData.get("body"),
  });
  await new MessagingRepository(await getSupabaseServerClient()).send(
    value.conversationId as never,
    value.body,
  );
  revalidatePath(`/messages/${value.conversationId}`);
}
