/**
 * Typed interaction events for consented customer signals (CUST-001,
 * ADR-021 / ADR-061). Events never duplicate durable orders, appointments,
 * or messages — only reference them when needed.
 */

import type {
  AnonymousSessionId,
  BehavioralEventId,
  CustomerId,
  InteractionSessionId,
  RetailerId,
} from "../shared/branded-id";

import type { ConsentBasis, ConsentPurpose, ConsentSnapshot } from "./consent";
import {
  mayLinkAnonymousSessionToCustomer,
  retentionExpiresAt,
} from "./consent";
import type { InteractionDeviceClass } from "./interaction-session";

export const INTERACTION_EVENT_NAMES = [
  "session_started",
  "session_heartbeat",
  "session_ended",
  "page_viewed",
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
  "tie_mate_impressed",
  "for_you_impressed",
  "for_you_clicked",
  "for_you_dismissed",
  "for_you_correction",
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
  readonly sessionId?: InteractionSessionId;
  readonly correlationId?: string;
  readonly idempotencyKey?: string;
  readonly name: InteractionEventName;
  readonly properties: Readonly<Record<string, unknown>>;
  readonly occurredAt: string;
  readonly receivedAt?: string;
  readonly pagePath?: string;
  readonly deviceClass?: InteractionDeviceClass;
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
  readonly sessionId?: InteractionSessionId;
  readonly correlationId?: string;
  readonly idempotencyKey?: string;
  readonly name: InteractionEventName;
  readonly properties?: Readonly<Record<string, unknown>>;
  readonly occurredAt: string;
  readonly receivedAt?: string;
  readonly pagePath?: string;
  readonly deviceClass?: InteractionDeviceClass;
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
  | "sensitive_property_forbidden"
  | "durable_record_duplication"
  | "invalid_idempotency_key";

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

/** Never capture credentials, payment fields, or arbitrary form contents. */
export const FORBIDDEN_EVENT_PROPERTY_KEYS = [
  "password",
  "passwd",
  "secret",
  "token",
  "apiKey",
  "api_key",
  "cardNumber",
  "card_number",
  "cvv",
  "cvc",
  "expiry",
  "paymentMethodId",
  "rawForm",
  "formValues",
  "credentials",
] as const;

export function isInteractionEventName(
  value: string,
): value is InteractionEventName {
  return (INTERACTION_EVENT_NAMES as readonly string[]).includes(value);
}

export function hasForbiddenEventProperty(
  properties: Readonly<Record<string, unknown>>,
): boolean {
  return FORBIDDEN_EVENT_PROPERTY_KEYS.some((key) => key in properties);
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

  if (
    input.idempotencyKey !== undefined &&
    (typeof input.idempotencyKey !== "string" ||
      input.idempotencyKey.trim().length === 0 ||
      input.idempotencyKey.trim().length > 200)
  ) {
    errors.push("invalid_idempotency_key");
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
    if (hasForbiddenEventProperty(properties)) {
      errors.push("sensitive_property_forbidden");
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
    ...(input.correlationId ? { correlationId: input.correlationId } : {}),
    ...(input.idempotencyKey
      ? { idempotencyKey: input.idempotencyKey.trim() }
      : {}),
    name: input.name,
    properties: properties as Readonly<Record<string, unknown>>,
    occurredAt: input.occurredAt,
    ...(input.receivedAt ? { receivedAt: input.receivedAt } : {}),
    ...(input.pagePath ? { pagePath: input.pagePath } : {}),
    ...(input.deviceClass ? { deviceClass: input.deviceClass } : {}),
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
