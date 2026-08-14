"use server";
import { runCommunicationDraftJob } from "@paon/ai";
import { requireRetailerRole } from "@paon/auth";
import {
  AIGenerationRepository,
  AppointmentRepository,
  AdvisorCaptureRepository,
  ConversationDraftRepository,
  CustomerRepository,
  MessagingRepository,
  RetailerRepository,
  RetailerStaffRepository,
  TableServiceGuidanceRepository,
} from "@paon/database";
import {
  asId,
  createConversationProposalSchema,
  CUSTOMER_FACT_TYPES,
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

export interface ConversationFactActionState {
  readonly formError?: string;
  readonly bundleId?: string;
}

async function requireAssignedConversationMessage(args: {
  readonly conversationId: string;
  readonly messageId: string;
}) {
  const session = await requireModuleSession("relationship_intelligence");
  requireRetailerRole(session.retailerRole, "sales_associate");
  const client = await getSupabaseServerClient();
  const [staff, conversation] = await Promise.all([
    new RetailerStaffRepository(client).findByUserId(session.userId),
    new MessagingRepository(client).findConversation(
      asId<"ConversationId">(args.conversationId),
    ),
  ]);
  if (
    !staff ||
    staff.retailerId !== session.retailerId ||
    !conversation ||
    conversation.retailerId !== session.retailerId ||
    conversation.claimedByStaffId !== staff.id
  ) {
    throw new Error(
      "Only the assigned advisor can propose facts from this conversation.",
    );
  }
  const message = (
    await new MessagingRepository(client).findMessages(conversation.id)
  ).find((item) => item.id === args.messageId);
  if (!message) throw new Error("Message not found in this conversation.");
  return { client, conversation, message, session, staff };
}

export async function proposeConversationFact(
  _previous: ConversationFactActionState,
  formData: FormData,
): Promise<ConversationFactActionState> {
  const conversationId = String(formData.get("conversationId") ?? "");
  const messageId = String(formData.get("messageId") ?? "");
  const sourceExcerpt = String(formData.get("sourceExcerpt") ?? "").trim();
  const factType = String(formData.get("factType") ?? "");
  const valueLabel = String(formData.get("valueLabel") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  if (
    !conversationId ||
    !messageId ||
    !sourceExcerpt ||
    !valueLabel ||
    !summary ||
    !(CUSTOMER_FACT_TYPES as readonly string[]).includes(factType)
  ) {
    return {
      formError: "Select an exact excerpt and complete the proposed fact.",
    };
  }

  try {
    const { client, conversation, message, session, staff } =
      await requireAssignedConversationMessage({ conversationId, messageId });
    if (!message.body.includes(sourceExcerpt)) {
      return {
        formError: "The excerpt must be selected from this exact message.",
      };
    }
    const capture = new AdvisorCaptureRepository(client);
    const captureSession = await capture.startConversationMessageSession({
      retailerId: session.retailerId,
      staffId: staff.id,
      customerId: conversation.customerId,
      messageId: message.id,
      rawText: message.body,
    });
    const bundles = await capture.proposeBundles({
      retailerId: session.retailerId,
      session: captureSession,
      proposals: [
        {
          kind: "self_portrait_fact",
          summary,
          sourceExcerpt,
          confidence: 1,
          payload: {
            factType: factType as (typeof CUSTOMER_FACT_TYPES)[number],
            valueLabel,
          },
        },
      ],
    });
    const bundle = bundles[0];
    if (!bundle)
      return {
        formError: "The proposed fact did not pass its evidence check.",
      };
    revalidatePath("/messages");
    return { bundleId: bundle.id };
  } catch (error) {
    return {
      formError:
        error instanceof Error
          ? error.message
          : "Could not create the proposed fact.",
    };
  }
}

async function requireConversationFactBundle(args: {
  readonly conversationId: string;
  readonly messageId: string;
  readonly bundleId: string;
}) {
  const authorized = await requireAssignedConversationMessage(args);
  const capture = new AdvisorCaptureRepository(authorized.client);
  const sessions = await capture.listSessionsForCustomer({
    retailerId: authorized.session.retailerId,
    customerId: authorized.conversation.customerId,
    limit: 100,
  });
  for (const captureSession of sessions) {
    if (
      captureSession.source !== "conversation_message" ||
      captureSession.messageId !== args.messageId
    ) {
      continue;
    }
    const bundle = (
      await capture.listBundlesForSession({
        retailerId: authorized.session.retailerId,
        sessionId: captureSession.id,
      })
    ).find(
      (item) => item.id === args.bundleId && item.kind === "self_portrait_fact",
    );
    if (bundle) return { ...authorized, capture };
  }
  throw new Error("Fact proposal not found in this conversation message.");
}

export async function confirmConversationFact(
  _previous: ConversationFactActionState,
  formData: FormData,
): Promise<ConversationFactActionState> {
  const conversationId = String(formData.get("conversationId") ?? "");
  const messageId = String(formData.get("messageId") ?? "");
  const bundleId = String(formData.get("bundleId") ?? "");
  const factType = String(formData.get("factType") ?? "");
  const valueLabel = String(formData.get("valueLabel") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  if (
    !bundleId ||
    !valueLabel ||
    !summary ||
    !(CUSTOMER_FACT_TYPES as readonly string[]).includes(factType)
  ) {
    return { formError: "A fact type, value and summary are required." };
  }
  try {
    const { capture, conversation, session, staff } =
      await requireConversationFactBundle({
        conversationId,
        messageId,
        bundleId,
      });
    const result = await capture.confirmBundle({
      retailerId: session.retailerId,
      customerId: conversation.customerId,
      bundleId,
      staffId: staff.id,
      editedSummary: summary,
      editedPayload: {
        factType: factType as (typeof CUSTOMER_FACT_TYPES)[number],
        valueLabel,
      },
    });
    if (!result.ok)
      return { formError: "This proposal can no longer be confirmed." };
    revalidatePath("/messages");
    return {};
  } catch (error) {
    return {
      formError:
        error instanceof Error
          ? error.message
          : "Could not confirm the proposed fact.",
    };
  }
}

export async function dismissConversationFact(
  _previous: ConversationFactActionState,
  formData: FormData,
): Promise<ConversationFactActionState> {
  const conversationId = String(formData.get("conversationId") ?? "");
  const messageId = String(formData.get("messageId") ?? "");
  const bundleId = String(formData.get("bundleId") ?? "");
  try {
    const { capture, session, staff } = await requireConversationFactBundle({
      conversationId,
      messageId,
      bundleId,
    });
    const result = await capture.dismissBundle({
      retailerId: session.retailerId,
      bundleId,
      staffId: staff.id,
    });
    if (!result.ok)
      return { formError: "This proposal can no longer be dismissed." };
    revalidatePath("/messages");
    return {};
  } catch (error) {
    return {
      formError:
        error instanceof Error
          ? error.message
          : "Could not dismiss the proposed fact.",
    };
  }
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

export interface CreateProposalActionState {
  readonly formError?: string;
}

/**
 * FT-09: Create a new conversation proposal. The RPC enforces that only one
 * active proposal exists per conversation at a time (the new one supersedes
 * any prior active one). DateTimePicker outputs local time without offset
 * (YYYY-MM-DDTHH:MM), so we must convert it to full ISO 8601 with offset
 * before passing to the schema.
 */
export async function createProposal(
  conversationId: string,
  _previous: CreateProposalActionState,
  formData: FormData,
): Promise<CreateProposalActionState> {
  try {
    const session = await requireModuleSession("relationship_intelligence");
    requireRetailerRole(session.retailerRole, "sales_associate");

    const title = String(formData.get("title") ?? "").trim();
    const advisorNote = String(formData.get("advisorNote") ?? "").trim();
    const itemsJson = String(formData.get("items") ?? "[]");
    const alternativesJson = String(formData.get("alternatives") ?? "[]");
    const priceAmountStr = String(formData.get("priceAmount") ?? "").trim();
    const priceCurrency = String(formData.get("priceCurrency") ?? "").trim();
    const appointmentOffered = formData.get("appointmentOffered") === "true";
    const expiresAtLocal = String(formData.get("expiresAt") ?? "").trim();

    if (!title || !advisorNote || !expiresAtLocal) {
      return { formError: "Title, advisor note, and expiry are required." };
    }

    const items = JSON.parse(itemsJson);
    const alternatives = JSON.parse(alternativesJson);

    // Convert local datetime to ISO 8601 with offset
    let expiresAt = expiresAtLocal;
    if (
      expiresAtLocal &&
      !expiresAtLocal.includes("+") &&
      !expiresAtLocal.endsWith("Z")
    ) {
      expiresAt = new Date(expiresAtLocal).toISOString();
    }

    const payload = {
      conversationId: conversationId as never,
      title,
      advisorNote,
      items,
      alternatives,
      ...(priceAmountStr
        ? { priceMinorUnits: Math.round(parseFloat(priceAmountStr) * 100) }
        : {}),
      ...(priceCurrency ? { priceCurrency } : {}),
      appointmentOffered,
      expiresAt,
    };

    createConversationProposalSchema.parse(payload);

    const repo = new MessagingRepository(await getSupabaseServerClient());
    await repo.createProposal(payload);

    revalidatePath("/messages");
    return {};
  } catch (error) {
    return {
      formError:
        error instanceof Error ? error.message : "Could not create proposal.",
    };
  }
}
