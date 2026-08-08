"use server";
import { runCommunicationDraftJob } from "@paon/ai";
import { requireRetailerRole } from "@paon/auth";
import {
  AIGenerationRepository,
  AppointmentRepository,
  ConversationDraftRepository,
  CustomerRepository,
  MessagingRepository,
  RetailerRepository,
  RetailerStaffRepository,
  TableServiceGuidanceRepository,
} from "@paon/database";
import {
  asId,
  sendMessageSchema,
  startStaffConversationSchema,
  validateMessageAttachmentUpload,
} from "@paon/domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAIProvider } from "@/lib/ai";
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

export async function claimConversation(formData: FormData) {
  const session = await requireModuleSession("relationship_intelligence");
  requireRetailerRole(session.retailerRole, "sales_associate");
  const conversationId = asId<"ConversationId">(
    String(formData.get("conversationId") ?? ""),
  );
  const repo = new MessagingRepository(await getSupabaseServerClient());
  const conversation = await repo.findConversation(conversationId);
  if (!conversation || conversation.retailerId !== session.retailerId) {
    throw new Error("Conversation not found.");
  }
  await repo.claimConversation(conversationId);
  revalidatePath("/messages");
}

export interface ConversationDraftActionState {
  readonly formError?: string;
}

export async function generateConversationDraft(
  conversationIdValue: string,
  _previous: ConversationDraftActionState,
  _formData: FormData,
): Promise<ConversationDraftActionState> {
  const session = await requireModuleSession("relationship_intelligence");
  requireRetailerRole(session.retailerRole, "sales_associate");
  const provider = getAIProvider();
  if (!provider) {
    return {
      formError:
        "AI drafting is not configured on this deployment. Reply manually.",
    };
  }

  const conversationId = asId<"ConversationId">(conversationIdValue);
  const client = await getSupabaseServerClient();
  const messaging = new MessagingRepository(client);
  const drafts = new ConversationDraftRepository(client);
  const conversation = await messaging.findConversation(conversationId);
  if (!conversation || conversation.retailerId !== session.retailerId) {
    return { formError: "Conversation not found." };
  }
  if (await drafts.findLatestProposedForConversation(conversationId)) {
    return { formError: "A draft is already waiting for review." };
  }

  const [messages, customer, retailer, staff] = await Promise.all([
    messaging.findMessages(conversationId),
    new CustomerRepository(client).findById(conversation.customerId),
    new RetailerRepository(client).findById(session.retailerId),
    new RetailerStaffRepository(client).findByUserId(session.userId),
  ]);
  if (
    !customer ||
    customer.retailerId !== session.retailerId ||
    !staff ||
    staff.retailerId !== session.retailerId
  ) {
    return { formError: "Conversation participants are unavailable." };
  }
  if (!conversation.claimedByStaffId) {
    return { formError: "Claim this conversation before generating a draft." };
  }
  if (
    conversation.claimedByStaffId !== staff.id &&
    !["manager", "admin", "owner"].includes(session.retailerRole)
  ) {
    return { formError: "Only the assigned advisor can generate this draft." };
  }
  const latestCustomerMessage = [...messages]
    .reverse()
    .find(
      (message) =>
        message.senderType === "customer" || message.senderType === "guest",
    );
  if (!latestCustomerMessage) {
    return { formError: "No customer message is available to draft from." };
  }

  const retrieval = await new TableServiceGuidanceRepository(
    client,
  ).retrieveBasis({
    retailerId: session.retailerId,
    slug: retailer?.slug ?? "",
    ...(conversation.intent ? { intent: conversation.intent } : {}),
    freeText: latestCustomerMessage.body,
  });
  const context = {
    retailerName: retailer?.displayName ?? "the retailer",
    customerName: customer.fullName,
    latestCustomerMessage: latestCustomerMessage.body,
    recentMessages: messages.slice(-10).map((message) => ({
      speaker:
        message.senderType === "staff"
          ? ("staff" as const)
          : ("customer" as const),
      text: message.body,
    })),
    knowledge:
      retrieval?.knowledgeResults.map((result) => ({
        knowledgeObjectId: String(result.knowledgeObjectId),
        title: result.presentation.title,
        summary: result.presentation.summary,
      })) ?? [],
    products:
      retrieval?.shortlist.map((item) => ({
        productId: String(item.productId),
        name: item.name,
        explanation: item.explanation,
      })) ?? [],
  };
  const inputSummary = `conversation=${conversationId} recentMessages=${context.recentMessages.length} knowledge=${context.knowledge.length} products=${context.products.length}`;
  const generation = await runCommunicationDraftJob(provider, context);
  const audit = new AIGenerationRepository(client);

  if (!generation.ok || !generation.result) {
    try {
      await audit.record({
        retailerId: session.retailerId,
        customerId: customer.id,
        requestedByStaffId: staff.id,
        kind: "communication_draft",
        status: "failed",
        provider: generation.provider,
        model: generation.model,
        inputSummary,
        errorMessage: generation.errorMessage ?? "Communication draft failed",
        latencyMs: generation.latencyMs,
      });
    } catch {
      return { formError: "Draft generation failed and could not be audited." };
    }
    return {
      formError: generation.errorMessage ?? "Draft generation failed.",
    };
  }

  await audit.record({
    retailerId: session.retailerId,
    customerId: customer.id,
    requestedByStaffId: staff.id,
    kind: "communication_draft",
    status: "succeeded",
    provider: generation.provider,
    model: generation.model,
    inputSummary,
    output: {
      refuse: generation.result.refuse,
      draftCharacterCount: generation.result.draftText.length,
      knowledgeObjectIds: [...generation.result.knowledgeObjectIds],
      productIds: [...generation.result.productIds],
    },
    latencyMs: generation.latencyMs,
  });
  if (generation.result.refuse) {
    return {
      formError:
        "The approved knowledge was too thin for a grounded draft. Reply manually.",
    };
  }

  await new ConversationDraftRepository(getSupabaseAdminClient()).propose({
    retailerId: session.retailerId,
    conversationId,
    basedOnMessageId: latestCustomerMessage.id,
    draftText: generation.result.draftText,
    knowledgeObjectIds: generation.result.knowledgeObjectIds,
    productIds: generation.result.productIds,
  });
  revalidatePath("/messages");
  return {};
}

export async function approveConversationDraft(formData: FormData) {
  const session = await requireModuleSession("relationship_intelligence");
  requireRetailerRole(session.retailerRole, "sales_associate");
  const draftId = String(formData.get("draftId") ?? "");
  const editedText = String(formData.get("draftText") ?? "").trim();
  if (!draftId || !editedText) throw new Error("Draft reply is required.");
  await new ConversationDraftRepository(
    await getSupabaseServerClient(),
  ).approveAndSend({ draftId, editedText });
  revalidatePath("/messages");
}

export async function dismissConversationDraft(formData: FormData) {
  const session = await requireModuleSession("relationship_intelligence");
  requireRetailerRole(session.retailerRole, "sales_associate");
  const draftId = String(formData.get("draftId") ?? "");
  if (!draftId) throw new Error("Draft is required.");
  await new ConversationDraftRepository(
    await getSupabaseServerClient(),
  ).dismiss(draftId);
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

/**
 * FT-09: Book an appointment directly from within a consultation thread.
 * A retailer staff member can click a button to create an appointment
 * linked to the conversation, with the thread recorded as the origin
 * for provenance and visibility.
 */
export async function bookAppointmentFromConsultation(
  formData: FormData,
): Promise<string> {
  const session = await requireModuleSession("relationship_intelligence");
  requireRetailerRole(session.retailerRole, "sales_associate");

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

  revalidatePath("/messages");
  return appointmentId;
}
