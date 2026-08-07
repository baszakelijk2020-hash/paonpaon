"use server";
import { AppointmentRepository, MessagingRepository } from "@paon/database";
import {
  classifyBuyingIntent,
  conversationNeedsHuman,
  sendMessageSchema,
  startCustomerConversationSchema,
} from "@paon/domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/session";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * PHASE 17.14: classify a just-sent customer/guest message for buying
 * intent and record it, escalating a still-`ai_handling` conversation to
 * `needs_human` when the classification warrants it. Runs after the
 * message itself is already durably sent through the ordinary RPC path
 * — classification failure must never block a real message from
 * reaching the retailer. Uses the admin client because `conversations`
 * grants no authenticated write at all, same reasoning as
 * `MessagingRepository.linkOutcome`/`recordIntentClassification`'s own
 * docstring; this Server Action is the caller responsible for its own
 * authorization (the message was just sent under the caller's own
 * session).
 */
async function classifyAndRecordIntent(conversationId: string, body: string) {
  try {
    const readRepo = new MessagingRepository(await getSupabaseServerClient());
    const conversation = await readRepo.findConversation(
      conversationId as never,
    );
    if (!conversation) return;

    const classification = classifyBuyingIntent(body);
    await new MessagingRepository(
      getSupabaseAdminClient(),
    ).recordIntentClassification({
      conversationId: conversationId as never,
      retailerId: conversation.retailerId,
      classification,
      escalateToHuman: conversationNeedsHuman(classification),
    });
  } catch {
    // Best-effort: a classification failure must never surface as a
    // message-send error to the customer — the message is already sent.
  }
}

export async function startConversation(formData: FormData) {
  await requireSession();
  const value = startCustomerConversationSchema.parse({
    retailerId: formData.get("retailerId"),
    body: formData.get("body"),
  });
  const repo = new MessagingRepository(await getSupabaseServerClient());
  const id = await repo.getOrCreateForCustomer(value.retailerId as never);
  await repo.send(id, value.body);
  await classifyAndRecordIntent(id, value.body);
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
  await classifyAndRecordIntent(value.conversationId, value.body);
  revalidatePath(`/messages/${value.conversationId}`);
}

/**
 * FT-09: Book an appointment directly from within a consultation thread.
 * A customer can click a button to create an appointment linked to the
 * conversation, with the thread recorded as the origin for provenance
 * and visibility.
 */
export async function bookAppointmentFromConsultation(
  formData: FormData,
): Promise<string> {
  const session = await requireSession();
  if (!session || session.accountType !== "customer") {
    throw new Error("Not authorized");
  }

  const conversationId = String(formData.get("conversationId") ?? "");
  const appointmentType = String(formData.get("type") ?? "");
  const startsAt = String(formData.get("startsAt") ?? "");
  const endsAt = String(formData.get("endsAt") ?? "");
  const notes = String(formData.get("notes") ?? "") || undefined;

  if (!conversationId || !appointmentType || !startsAt || !endsAt) {
    throw new Error("Missing required appointment fields");
  }

  const supabase = await getSupabaseServerClient();
  const appointmentId = await new AppointmentRepository(
    supabase,
  ).bookFromConsultation({
    conversationId,
    type: appointmentType as never,
    startsAt,
    endsAt,
    ...(notes ? { notes } : {}),
  });

  revalidatePath(`/messages/${conversationId}`);
  return appointmentId;
}
