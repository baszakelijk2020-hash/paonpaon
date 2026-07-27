import type { ConversationIntent } from "@paon/domain";

const INTENTS: ConversationIntent[] = [
  "wedding",
  "shirts",
  "style_help",
  "freeform",
];

export function isConversationIntent(
  value: string,
): value is ConversationIntent {
  return (INTENTS as string[]).includes(value);
}

export interface TableServiceInquiryInput {
  retailerId: string;
  name: string;
  email: string;
  message: string;
  intent: ConversationIntent;
}

export type TableServiceInquiryValidation =
  | { ok: true; value: TableServiceInquiryInput }
  | { ok: false; fieldErrors: Record<string, string> };

/**
 * Shared by `table-service-actions.ts`'s Server Action (used on every
 * `/r/[slug]` child page, where a real React tree exists to bind a
 * form action) and `api/table-service-inquiry/route.ts` (used on the
 * main `/r/[slug]` page, which is served raw by `route.ts` and can't
 * hydrate a Server Action at all) — same validation either way, no
 * duplicated field-error logic between the two entry points.
 */
export function validateTableServiceInquiry(raw: {
  retailerId?: string;
  name?: string;
  email?: string;
  message?: string;
  intent?: string;
}): TableServiceInquiryValidation {
  const retailerId = (raw.retailerId ?? "").trim();
  const name = (raw.name ?? "").trim();
  const email = (raw.email ?? "").trim();
  const message = (raw.message ?? "").trim();
  const intentRaw = raw.intent ?? "freeform";

  const fieldErrors: Record<string, string> = {};
  if (!retailerId) fieldErrors["retailerId"] = "Missing retailer.";
  if (!name) fieldErrors["name"] = "Your name is required.";
  if (!email || !email.includes("@")) {
    fieldErrors["email"] = "A valid email is required.";
  }
  if (!message) fieldErrors["message"] = "Tell us what you're looking for.";
  if (!isConversationIntent(intentRaw)) {
    fieldErrors["intent"] = "Unrecognized selection.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    value: {
      retailerId,
      name,
      email,
      message,
      intent: intentRaw as ConversationIntent,
    },
  };
}
