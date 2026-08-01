"use server";
import { requireRetailerRole } from "@paon/auth";
import { MessagingRepository } from "@paon/database";
import {
  asId,
  sendMessageSchema,
  startStaffConversationSchema,
  validateMessageAttachmentUpload,
} from "@paon/domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function startConversation(formData: FormData) {
  const session = await requireModuleSession("relationship_intelligence");
  requireRetailerRole(session.retailerRole, "sales_associate");
  const value = startStaffConversationSchema.parse({
    customerId: formData.get("customerId"),
    body: formData.get("body") || "Hello — how may we help?",
  });
  const repo = new MessagingRepository(await getSupabaseServerClient());
  const id = await repo.getOrCreateForStaff(value.customerId as never);
  const messages = await repo.findMessages(id);
  if (messages.length === 0) await repo.send(id, value.body);
  redirect(`/messages?c=${id}`);
}
export async function sendMessage(formData: FormData) {
  const session = await requireModuleSession("relationship_intelligence");
  requireRetailerRole(session.retailerRole, "sales_associate");
  const value = sendMessageSchema.parse({
    conversationId: formData.get("conversationId"),
    body: formData.get("body"),
  });
  const supabase = await getSupabaseServerClient();
  const repo = new MessagingRepository(supabase);
  const conversationId = value.conversationId as never;
  const messageId = await repo.send(conversationId, value.body);

  const file = formData.get("attachment");
  if (file instanceof File && file.size > 0) {
    const content = await file.arrayBuffer();
    const validated = validateMessageAttachmentUpload({
      purpose: "photo",
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      bytes: new Uint8Array(content),
    });
    if (!validated.ok) throw new Error(validated.error);
    await repo.uploadAttachment({
      retailerId: session.retailerId,
      conversationId,
      messageId,
      purpose: "photo",
      fileName: validated.fileName,
      mimeType: validated.mimeType,
      sizeBytes: file.size,
      content,
    });
  }

  revalidatePath("/messages");
}

/**
 * PHASE 10.3 (CLI-004/CMP-103): records that this thread actually led to a
 * placed order. Uses the admin client because `conversations` grants no
 * authenticated write at all (see MessagingRepository.linkOutcome's own
 * docstring) — the role check here is therefore load-bearing, not a UI
 * nicety backed by RLS.
 */
export async function linkConversationOutcome(formData: FormData) {
  const session = await requireModuleSession("relationship_intelligence");
  requireRetailerRole(session.retailerRole, "sales_associate");

  const conversationId = String(formData.get("conversationId") ?? "");
  const orderId = String(formData.get("orderId") ?? "");
  if (!conversationId || !orderId) {
    throw new Error("Missing conversation or order.");
  }

  const repo = new MessagingRepository(getSupabaseAdminClient());
  await repo.linkOutcome({
    conversationId: asId<"ConversationId">(conversationId),
    retailerId: session.retailerId,
    outcomeOrderId: orderId,
  });
  revalidatePath("/messages");
}
