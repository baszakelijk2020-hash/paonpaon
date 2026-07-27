"use server";
import { requireRetailerRole } from "@paon/auth";
import { MessagingRepository } from "@paon/database";
import {
  MESSAGE_ATTACHMENT_MIME_TYPES,
  sendMessageSchema,
  startStaffConversationSchema,
  type MessageAttachmentMimeType,
} from "@paon/domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

function isAllowedAttachmentMime(
  mimeType: string,
): mimeType is MessageAttachmentMimeType {
  return (MESSAGE_ATTACHMENT_MIME_TYPES as readonly string[]).includes(
    mimeType,
  );
}
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
  redirect(`/messages?c=${id}`);
}
export async function sendMessage(formData: FormData) {
  const session = await requireSession();
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
    if (!isAllowedAttachmentMime(file.type)) {
      throw new Error("Attachments must be a JPEG, PNG or WebP image.");
    }
    await repo.uploadAttachment({
      retailerId: session.retailerId,
      conversationId,
      messageId,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      content: await file.arrayBuffer(),
    });
  }

  revalidatePath("/messages");
}
