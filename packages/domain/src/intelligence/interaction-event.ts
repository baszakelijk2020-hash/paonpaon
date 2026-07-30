/**
 * Typed interaction events for consented customer signals (CUST-001,
 * ADR-021 / ADR-061). Events never duplicate durable orders, appointments,
 * or messages — only reference them when needed.
 */

import type {
  AnonymousSessionId,
  BehavioralEventId,
  CustomerId,
  CustomerInteractionSessionId,
  RetailerId,
} from "../shared/branded-id";

import type { ConsentBasis, ConsentPurpose, ConsentSnapshot } from "./consent";
import {
  mayLinkAnonymousSessionToCustomer,
  retentionExpiresAt,
} from "./consent";

export const INTERACTION_EVENT_NAMES = [
  "product_viewed",
  "category_browsed",
  "search_performed",
  "filter_applied",
  "product_favorited",
  "product_skipped",
  "cart_updated",
  "knowledge_opened",
  "advisor_question",
  "appointment_intent",
  "conversion_recorded",
  "session_started",
  "session_resumed",
  "session_heartbeat",
  "session_ended",
  "page_visibility_changed",
  "route_impression",
  "product_card_impression",
  "product_dwell_threshold",
  "scroll_depth_threshold",
  "tie_mate_impression",
] as const;

export type InteractionEventName = (typeof INTERACTION_EVENT_NAMES)[number];

export const RETENTION_CLASSES = [
  "personalization_signal",
  "operational_analytics",
] as const;

export type RetentionClass = (typeof RETENTION_CLASSES)[number];

export const INTERACTION_EVENT_SOURCES = [
  "customer_portal",
  "retailer_portal",
  "admin",
  "server",
] as const;

export type InteractionEventSource = (typeof INTERACTION_EVENT_SOURCES)[number];

/** Default purpose for catalogue/advisor interaction signals. */
export const DEFAULT_INTERACTION_PURPOSE: ConsentPurpose = "personalization";

export const DEFAULT_RETENTION_CLASS: RetentionClass = "personalization_signal";

/**
 * Upgraded behavioral / interaction signal. Replaces the free-form
 * `BehavioralEvent` shape for new captures while remaining the analytics
 * stream ADR-021 started.
 */
export interface InteractionEvent {
  readonly id?: BehavioralEventId;
  readonly retailerId: RetailerId;
  readonly customerId?: CustomerId;
  readonly anonymousSessionId?: AnonymousSessionId;
  readonly sessionId?: CustomerInteractionSessionId;
  readonly idempotencyKey?: string;
  readonly name: InteractionEventName;
  readonly properties: Readonly<Record<string, unknown>>;
  readonly occurredAt: string;
  readonly source: InteractionEventSource;
  readonly purpose: ConsentPurpose;
  readonly consentBasis: ConsentBasis;
  readonly consentSnapshot: ConsentSnapshot;
  readonly retentionClass: RetentionClass;
  readonly retentionExpiresAt: string;
  readonly anonymizedAt?: string;
}

/**
 * Legacy alias kept for existing analytics/AI call sites. New captures
 * should use `InteractionEvent`.
 */
export type BehavioralEvent = InteractionEvent;

export interface CaptureInteractionEventInput {
  readonly retailerId: RetailerId;
  readonly customerId?: CustomerId;
  readonly anonymousSessionId?: AnonymousSessionId;
  readonly sessionId?: CustomerInteractionSessionId;
  readonly idempotencyKey?: string;
  readonly name: InteractionEventName;
  readonly properties?: Readonly<Record<string, unknown>>;
  readonly occurredAt: string;
  readonly source: InteractionEventSource;
  readonly purpose?: ConsentPurpose;
  readonly consentBasis: ConsentBasis;
  readonly consentSnapshot: ConsentSnapshot;
  readonly retentionClass?: RetentionClass;
  readonly retentionDays?: number;
}

export type InteractionEventValidationError =
  | "unknown_event_name"
  | "missing_subject"
  | "anonymous_and_customer_together"
  | "anonymous_linking_denied"
  | "consent_required"
  | "anonymous_persistence_blocked"
  | "invalid_properties"
  | "durable_record_duplication"
  | "forbidden_sensitive_property";

export interface InteractionEventValidationResult {
  readonly ok: boolean;
  readonly errors: readonly InteractionEventValidationError[];
  readonly event?: InteractionEvent;
}

const DURABLE_DUPLICATION_KEYS = [
  "orderPayload",
  "appointmentPayload",
  "messagePayload",
  "rawPrompt",
] as const;

const FORBIDDEN_CAPTURE_KEYS = [
  "password",
  "payment",
  "credential",
  "credentials",
  "cardNumber",
  "cvv",
  "formContents",
] as const;

export function isInteractionEventName(
  value: string,
): value is InteractionEventName {
  return (INTERACTION_EVENT_NAMES as readonly string[]).includes(value);
}

export function validateCaptureInteractionEvent(
  input: CaptureInteractionEventInput,
  options?: {
    readonly jurisdictionAllowsAnonymous?: boolean;
  },
): InteractionEventValidationResult {
  const errors: InteractionEventValidationError[] = [];

  if (!isInteractionEventName(input.name)) {
    errors.push("unknown_event_name");
  }

  const hasCustomer = Boolean(input.customerId);
  const hasAnonymous = Boolean(input.anonymousSessionId);

  if (!hasCustomer && !hasAnonymous && input.source === "customer_portal") {
    errors.push("missing_subject");
  }

  if (hasCustomer && hasAnonymous) {
    errors.push("anonymous_and_customer_together");
    if (!mayLinkAnonymousSessionToCustomer()) {
      errors.push("anonymous_linking_denied");
    }
  }

  const purpose = input.purpose ?? DEFAULT_INTERACTION_PURPOSE;
  if (
    hasCustomer &&
    purpose === "personalization" &&
    input.consentSnapshot.personalization !== "granted"
  ) {
    errors.push("consent_required");
  }

  if (hasAnonymous) {
    const allowed =
      options?.jurisdictionAllowsAnonymous === true &&
      input.consentBasis === "legitimate_interest_anonymous";
    if (!allowed) {
      errors.push("anonymous_persistence_blocked");
    }
  }

  const properties = input.properties ?? {};
  if (typeof properties !== "object" || Array.isArray(properties)) {
    errors.push("invalid_properties");
  } else {
    for (const key of DURABLE_DUPLICATION_KEYS) {
      if (key in properties) {
        errors.push("durable_record_duplication");
        break;
      }
    }
    for (const key of FORBIDDEN_CAPTURE_KEYS) {
      if (key in properties) {
        errors.push("forbidden_sensitive_property");
        break;
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const retentionClass = input.retentionClass ?? DEFAULT_RETENTION_CLASS;
  const event: InteractionEvent = {
    retailerId: input.retailerId,
    ...(input.customerId ? { customerId: input.customerId } : {}),
    ...(input.anonymousSessionId
      ? { anonymousSessionId: input.anonymousSessionId }
      : {}),
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
    name: input.name,
    properties: properties as Readonly<Record<string, unknown>>,
    occurredAt: input.occurredAt,
    source: input.source,
    purpose,
    consentBasis: input.consentBasis,
    consentSnapshot: input.consentSnapshot,
    retentionClass,
    retentionExpiresAt: retentionExpiresAt({
      occurredAt: input.occurredAt,
      ...(input.retentionDays !== undefined
        ? { retentionDays: input.retentionDays }
        : {}),
    }),
  };

  return { ok: true, errors: [], event };
}
