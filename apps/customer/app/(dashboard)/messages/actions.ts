"use server";
import {
  AppointmentRepository,
  MessagingRepository,
} from "@paon/database";
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
  const appointmentId = await new AppointmentRepository(supabase)
    .bookFromConsultation({
      conversationId,
      type: appointmentType as never,
      startsAt,
      endsAt,
      notes,
    });

  revalidatePath(`/messages/${conversationId}`);
  return appointmentId;
}
