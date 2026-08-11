"use server";

import { CustomerRepository, MessagingRepository } from "@paon/database";
import {
  asId,
  classifyBuyingIntent,
  conversationNeedsHuman,
  normalizePinterestUrl,
  validateMessageAttachmentUpload,
  type MessageAttachmentPurpose,
} from "@paon/domain";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { validateTableServiceInquiry } from "./table-service-validation";

import { assertRetailerModuleActive } from "@/lib/module-session";
import { requireSession } from "@/lib/session";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface TableServiceFormState {
  values: Record<string, string>;
  fieldErrors: Record<string, string>;
  formError?: string;
  submitted?: boolean;
}

export interface SignedInTableServiceResult {
  readonly ok: boolean;
  readonly conversationId?: string;
  /** Present once the canonical message write has succeeded. Attachment
   * failure is deliberately reported separately so the caller never retries
   * the message and creates a duplicate conversation entry. */
  readonly messageId?: string;
  readonly attachmentPurpose?: MessageAttachmentPurpose;
  readonly attachmentError?: string;
  readonly error?: string;
}

const retailerIdSchema = z.string().uuid();
const uploadPurposes = new Set<MessageAttachmentPurpose>([
  "photo",
  "document",
  "wedding_fabric",
]);

/**
 * Signed-in TableService send boundary. The widget keeps its founder chrome;
 * this action turns its message and attachment controls into the customer's
 * canonical private retailer conversation.
 */
export async function sendSignedInTableServiceMessage(
  retailerIdInput: string,
  formData: FormData,
): Promise<SignedInTableServiceResult> {
  const parsedRetailerId = retailerIdSchema.safeParse(retailerIdInput);
  if (!parsedRetailerId.success)
    return { ok: false, error: "Invalid retailer." };

  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const retailerId = asId<"RetailerId">(parsedRetailerId.data);
  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const customer = customers.find((row) => row.retailerId === retailerId);
  if (!customer) {
    return { ok: false, error: "No relationship with this retailer." };
  }

  try {
    await assertRetailerModuleActive(
      supabase,
      retailerId,
      "relationship_intelligence",
    );
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Messaging is closed.",
    };
  }

  const body = String(formData.get("body") ?? "").trim();
  if (body.length > 5000) return { ok: false, error: "Message is too long." };
  const purposeRaw = String(formData.get("attachmentPurpose") ?? "");
  const purpose = purposeRaw as MessageAttachmentPurpose;
  const file = formData.get("attachment");
  const sourceUrlRaw = String(formData.get("sourceUrl") ?? "").trim();
  const weddingPartyIdRaw = formData.get("weddingPartyId");
  const weddingPartyId =
    purpose === "wedding_fabric" &&
    typeof weddingPartyIdRaw === "string" &&
    z.string().uuid().safeParse(weddingPartyIdRaw).success
      ? asId<"WeddingPartyId">(weddingPartyIdRaw)
      : undefined;
  const wardrobeItemIdRaw = formData.get("wardrobeItemId");
  const wardrobeItemId =
    purpose === "photo" &&
    typeof wardrobeItemIdRaw === "string" &&
    z.string().uuid().safeParse(wardrobeItemIdRaw).success
      ? asId<"WardrobeItemId">(wardrobeItemIdRaw)
      : undefined;

  let validatedUpload:
    | {
        readonly purpose: Exclude<MessageAttachmentPurpose, "pinterest_link">;
        readonly fileName: string;
        readonly mimeType:
          "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
        readonly sizeBytes: number;
        readonly content: ArrayBuffer;
      }
    | undefined;
  let pinterestUrl: string | undefined;

  if (file instanceof File && file.size > 0) {
    if (!uploadPurposes.has(purpose) || purpose === "pinterest_link") {
      return { ok: false, error: "Invalid attachment purpose." };
    }
    const content = await file.arrayBuffer();
    const validation = validateMessageAttachmentUpload({
      purpose,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      bytes: new Uint8Array(content),
    });
    if (!validation.ok) return { ok: false, error: validation.error };
    validatedUpload = {
      purpose,
      fileName: validation.fileName,
      mimeType: validation.mimeType,
      sizeBytes: file.size,
      content,
    };
  } else if (purpose === "pinterest_link" && sourceUrlRaw) {
    pinterestUrl = normalizePinterestUrl(sourceUrlRaw) ?? undefined;
    if (!pinterestUrl) {
      return { ok: false, error: "Use a secure Pinterest or pin.it link." };
    }
  }

  if (!body && !validatedUpload && !pinterestUrl) {
    return { ok: false, error: "Write a message or attach a reference." };
  }

  try {
    const repository = new MessagingRepository(supabase);
    const conversationId = await repository.getOrCreateForCustomer(retailerId);
    const messageId = await repository.send(
      conversationId,
      body ||
        (pinterestUrl
          ? "Pinterest reference for TableService consultation"
          : `TableService ${validatedUpload?.purpose.replaceAll("_", " ")} attachment`),
    );
    if (validatedUpload) {
      await repository.uploadAttachment({
        retailerId,
        conversationId,
        messageId,
        ...validatedUpload,
        ...(weddingPartyId ? { weddingPartyId } : {}),
        ...(wardrobeItemId ? { wardrobeItemId } : {}),
      });
    }
    if (pinterestUrl) {
      try {
        await repository.recordReferenceAttachment({
          conversationId,
          messageId,
          purpose: "pinterest_link",
          sourceUrl: pinterestUrl,
        });
      } catch (error) {
        revalidatePath("/messages");
        revalidatePath(`/messages/${conversationId}`);
        return {
          ok: true,
          conversationId,
          messageId,
          attachmentPurpose: "pinterest_link",
          attachmentError:
            error instanceof Error
              ? error.message
              : "Pinterest reference could not be attached.",
        };
      }
    }
    revalidatePath("/messages");
    revalidatePath(`/messages/${conversationId}`);
    return {
      ok: true,
      conversationId,
      messageId,
      ...(validatedUpload
        ? { attachmentPurpose: validatedUpload.purpose }
        : {}),
      ...(pinterestUrl ? { attachmentPurpose: "pinterest_link" as const } : {}),
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Message could not be sent.",
    };
  }
}

/** Retries only recording a Pinterest reference against an already-persisted
 * message. This is intentionally separate from `sendSignedInTableServiceMessage`:
 * recovering an attachment must never re-send the customer's message. */
export async function retrySignedInTableServiceReferenceAttachment(
  retailerIdInput: string,
  messageIdInput: string,
  sourceUrlInput: string,
): Promise<SignedInTableServiceResult> {
  const parsedRetailerId = retailerIdSchema.safeParse(retailerIdInput);
  const parsedMessageId = z.string().uuid().safeParse(messageIdInput);
  const pinterestUrl = normalizePinterestUrl(sourceUrlInput);
  if (!parsedRetailerId.success || !parsedMessageId.success || !pinterestUrl) {
    return { ok: false, error: "Invalid Pinterest attachment recovery." };
  }

  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const retailerId = asId<"RetailerId">(parsedRetailerId.data);
  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  if (!customers.some((row) => row.retailerId === retailerId)) {
    return { ok: false, error: "No relationship with this retailer." };
  }

  try {
    await assertRetailerModuleActive(
      supabase,
      retailerId,
      "relationship_intelligence",
    );
    const repository = new MessagingRepository(supabase);
    const conversationId = await repository.getOrCreateForCustomer(retailerId);
    await repository.recordReferenceAttachment({
      conversationId,
      messageId: asId<"MessageId">(parsedMessageId.data),
      purpose: "pinterest_link",
      sourceUrl: pinterestUrl,
    });
    revalidatePath("/messages");
    revalidatePath(`/messages/${conversationId}`);
    return {
      ok: true,
      conversationId,
      messageId: parsedMessageId.data,
      attachmentPurpose: "pinterest_link",
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Pinterest reference could not be attached.",
    };
  }
}

/**
 * The only anonymous-visitor write path in the customer app — runs
 * under the anon key, no session required. All real validation lives
 * in `submit_table_service_inquiry` (SECURITY DEFINER, ADR-034); this
 * action only shapes field errors for the form.
 */
export async function submitTableServiceInquiry(
  retailerId: string,
  _prevState: TableServiceFormState,
  formData: FormData,
): Promise<TableServiceFormState> {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;

  const validation = validateTableServiceInquiry({ ...raw, retailerId });
  if (!validation.ok) {
    return { values: raw, fieldErrors: validation.fieldErrors };
  }
  const { name, email, message, intent } = validation.value;

  const supabase = await getSupabaseServerClient();
  const rId = asId<"RetailerId">(retailerId);
  try {
    await assertRetailerModuleActive(
      supabase,
      rId,
      "relationship_intelligence",
    );
    const conversationId = await new MessagingRepository(
      supabase,
    ).submitTableServiceInquiry({
      retailerId: rId,
      name,
      email,
      intent,
      message,
    });

    // PHASE 17.14: classify this anonymous prospect's first message for
    // buying intent and escalate to the retailer queue when it warrants
    // a human. Never blocks the inquiry itself on classification failure
    // — the inquiry is already durably recorded by this point.
    try {
      const classification = classifyBuyingIntent(message);
      await new MessagingRepository(
        getSupabaseAdminClient(),
      ).recordIntentClassification({
        conversationId,
        retailerId: rId,
        classification,
        escalateToHuman: conversationNeedsHuman(classification),
      });
    } catch {
      // Best-effort: a classification failure must never surface as an
      // inquiry-submission error to the anonymous visitor.
    }
  } catch (error) {
    const formError =
      error instanceof Error ? error.message : "Something went wrong.";
    return { values: raw, fieldErrors: {}, formError };
  }

  return { values: {}, fieldErrors: {}, submitted: true };
}
