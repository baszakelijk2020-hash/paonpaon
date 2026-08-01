import type {
  ConversationId,
  CustomerId,
  MessageAttachmentId,
  MessageId,
  RetailerId,
  StaffId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

export type ConversationIntent =
  "wedding" | "shirts" | "style_help" | "freeform";

/** A single thread between one Customer and one retailer (staff rotate within it). */
export interface Conversation extends Timestamps {
  readonly id: ConversationId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly lastMessageAt?: string;
  /** Set once, by whatever started the thread — a TableService storefront
   * inquiry (ADR-034) or an ordinary logged-in customer message, which
   * never sets it. Never overwritten on a later message. */
  readonly intent?: ConversationIntent;
  /** PHASE 10.3 (CLI-004/CMP-103): the real appointment/order this
   * conversation led to — mirrors clienteling_opportunities' own outcome
   * fields (PHASE 7.4) rather than a second outcome shape. */
  readonly outcomeAppointmentId?: string;
  readonly outcomeOrderId?: string;
  readonly outcomeRecordedAt?: string;
}

export type MessageSenderType = "customer" | "staff" | "ai_assistant" | "guest";

/** Display labels for the TableService intent buttons (ADR-034) — the
 * only place this copy lives, so the customer-app widget and the
 * retailer inbox never drift apart. */
export const CONVERSATION_INTENT_LABELS: Record<ConversationIntent, string> = {
  wedding: "Wedding",
  shirts: "Shirts",
  style_help: "Style help",
  freeform: "General inquiry",
};

export interface Message extends Timestamps {
  readonly id: MessageId;
  readonly conversationId: ConversationId;
  readonly senderType: MessageSenderType;
  readonly senderStaffId?: StaffId;
  readonly senderUserId?: string;
  readonly body: string;
  readonly readByCustomerAt?: string;
  readonly readByStaffAt?: string;
}

const ALLOWED_MESSAGE_ATTACHMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;
export type MessageAttachmentMimeType =
  (typeof ALLOWED_MESSAGE_ATTACHMENT_MIME_TYPES)[number];
export const MESSAGE_ATTACHMENT_MIME_TYPES =
  ALLOWED_MESSAGE_ATTACHMENT_MIME_TYPES;

export const MESSAGE_ATTACHMENT_PURPOSES = [
  "photo",
  "document",
  "pinterest_link",
  "wedding_fabric",
] as const;
export type MessageAttachmentPurpose =
  (typeof MESSAGE_ATTACHMENT_PURPOSES)[number];
export type MessageAttachmentSourceKind = "upload" | "link";
export type MessageAttachmentScanStatus =
  "pending_scan" | "basic_validated" | "quarantined" | "failed";

export const MAX_MESSAGE_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const PURPOSE_MIME_TYPES: Readonly<
  Record<Exclude<MessageAttachmentPurpose, "pinterest_link">, readonly string[]>
> = {
  photo: ["image/jpeg", "image/png", "image/webp"],
  document: ["application/pdf"],
  wedding_fabric: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
};

function hasBytes(bytes: Uint8Array, expected: readonly number[]): boolean {
  return expected.every((value, index) => bytes[index] === value);
}

export function fileBytesMatchMimeType(
  bytes: Uint8Array,
  mimeType: MessageAttachmentMimeType,
): boolean {
  if (mimeType === "image/jpeg") return hasBytes(bytes, [0xff, 0xd8, 0xff]);
  if (mimeType === "image/png") {
    return hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  if (mimeType === "image/webp") {
    return (
      hasBytes(bytes, [0x52, 0x49, 0x46, 0x46]) &&
      hasBytes(bytes.slice(8), [0x57, 0x45, 0x42, 0x50])
    );
  }
  return hasBytes(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
}

export function safeAttachmentFileName(value: string): string {
  const basename = value.replaceAll("\\", "/").split("/").pop() ?? "file";
  const safe = basename
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9._ -]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return safe || "file";
}

export function validateMessageAttachmentUpload(args: {
  readonly purpose: Exclude<MessageAttachmentPurpose, "pinterest_link">;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly bytes: Uint8Array;
}):
  | {
      readonly ok: true;
      readonly fileName: string;
      readonly mimeType: MessageAttachmentMimeType;
    }
  | { readonly ok: false; readonly error: string } {
  if (args.sizeBytes <= 0 || args.sizeBytes > MAX_MESSAGE_ATTACHMENT_BYTES) {
    return { ok: false, error: "Attachment must be between 1 byte and 10 MB." };
  }
  if (!MESSAGE_ATTACHMENT_MIME_TYPES.includes(args.mimeType as never)) {
    return { ok: false, error: "Unsupported attachment type." };
  }
  if (!PURPOSE_MIME_TYPES[args.purpose].includes(args.mimeType)) {
    return { ok: false, error: "That file type does not match its purpose." };
  }
  const mimeType = args.mimeType as MessageAttachmentMimeType;
  if (!fileBytesMatchMimeType(args.bytes, mimeType)) {
    return {
      ok: false,
      error: "File contents do not match the declared type.",
    };
  }
  return {
    ok: true,
    fileName: safeAttachmentFileName(args.fileName),
    mimeType,
  };
}

export function normalizePinterestUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    const allowed =
      host === "pin.it" ||
      host === "pinterest.com" ||
      host.endsWith(".pinterest.com");
    if (!allowed) return null;
    url.username = "";
    url.password = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

/** One private consultation upload or constrained reference on a message.
 * Sender identity is exactly one of
 * `uploadedByStaffId`/`uploadedByUserId`, matching who actually sent the
 * parent message (see `record_message_attachment`, ADR-037 follow-up). */
export interface MessageAttachment extends Pick<Timestamps, "createdAt"> {
  readonly id: MessageAttachmentId;
  readonly retailerId: RetailerId;
  readonly messageId: MessageId;
  readonly sourceKind: MessageAttachmentSourceKind;
  readonly purpose: MessageAttachmentPurpose;
  readonly storageBucket?: string;
  readonly storagePath?: string;
  readonly sourceUrl?: string;
  readonly fileName: string;
  readonly mimeType?: MessageAttachmentMimeType;
  readonly sizeBytes: number;
  readonly rightsBasis: "customer_consultation" | "retailer_consultation";
  readonly scanStatus: MessageAttachmentScanStatus;
  readonly uploadedByStaffId?: StaffId;
  readonly uploadedByUserId?: string;
}
