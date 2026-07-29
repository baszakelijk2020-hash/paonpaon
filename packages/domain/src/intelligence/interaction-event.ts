import type { CustomerId, RetailerId } from "../shared/branded-id";

import type { ConsentPurpose, ConsentSnapshot } from "./consent";
import type { RetentionClass } from "./retention";

/** Named CUST-001 interaction types. `name` on persisted rows mirrors this
 * value for backward-compatible analytics counts. */
export type InteractionEventType =
  | "product_viewed"
  | "category_browsed"
  | "search_performed"
  | "filter_applied"
  | "product_favorited"
  | "product_skipped"
  | "cart_item_added"
  | "knowledge_opened"
  | "advisor_question_asked"
  | "swipe_choice"
  | "appointment_intent";

export const INTERACTION_EVENT_TYPES = [
  "product_viewed",
  "category_browsed",
  "search_performed",
  "filter_applied",
  "product_favorited",
  "product_skipped",
  "cart_item_added",
  "knowledge_opened",
  "advisor_question_asked",
  "swipe_choice",
  "appointment_intent",
] as const satisfies readonly InteractionEventType[];

/** Personalization signals require personalization consent at capture time. */
export const PERSONALIZATION_INTERACTION_TYPES = [
  "product_viewed",
  "category_browsed",
  "search_performed",
  "filter_applied",
  "product_favorited",
  "product_skipped",
  "cart_item_added",
  "knowledge_opened",
  "advisor_question_asked",
  "swipe_choice",
  "appointment_intent",
] as const satisfies readonly InteractionEventType[];

export type InteractionEventSource =
  "customer_portal" | "retailer_portal" | "admin" | "server";

export interface InteractionEvent {
  readonly retailerId: RetailerId;
  readonly customerId?: CustomerId;
  readonly anonymousSessionId?: string;
  readonly interactionType: InteractionEventType;
  readonly purpose: ConsentPurpose;
  readonly consentSnapshot: ConsentSnapshot;
  readonly retentionClass: RetentionClass;
  readonly retentionExpiresAt?: string;
  readonly properties: Record<string, unknown>;
  readonly occurredAt: string;
  readonly source: InteractionEventSource;
  readonly anonymizedAt?: string;
}

/** Required consent purpose for a typed interaction. */
export function requiredConsentPurpose(
  interactionType: InteractionEventType,
): ConsentPurpose {
  if (
    (PERSONALIZATION_INTERACTION_TYPES as readonly string[]).includes(
      interactionType,
    )
  ) {
    return "personalization";
  }
  return "personalization";
}
