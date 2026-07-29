/**
 * Advisor preparation brief projection (ADV-003, ADR-061 / PHASE 3.3).
 * Aggregates consented personalization signals into an explainable,
 * retailer-scoped read model without inventing facts or exposing
 * cross-tenant or withdrawn data.
 */

import type { ConversationIntent } from "../engagement/messaging";
import { CONVERSATION_INTENT_LABELS } from "../engagement/messaging";
import type { CustomerId, RetailerId } from "../shared/branded-id";

import {
  isAdvisorVisiblePersonalizationEvent,
  type ConsentStatus,
  type CustomerConsentState,
} from "./consent";
import type { BehavioralEvent, InteractionEventName } from "./interaction-event";
import type {
  CustomerStyleProfile,
  StyleEvidenceSource,
  StylePreferenceEvidence,
  StylePreferencePolarity,
} from "./style-profile";

export const ADVISOR_BRIEF_INTEREST_EVENT_NAMES = [
  "product_viewed",
  "product_favorited",
  "product_skipped",
  "category_browsed",
  "search_performed",
  "filter_applied",
  "cart_updated",
  "knowledge_opened",
  "advisor_question",
  "appointment_intent",
  "conversion_recorded",
] as const satisfies readonly InteractionEventName[];

export type AdvisorBriefPersonalizationStatus =
  | "available"
  | "consent_denied"
  | "consent_withdrawn";

export interface AdvisorBriefInterest {
  readonly label: string;
  readonly eventName: InteractionEventName;
  readonly occurredAt: string;
  readonly detail?: string;
}

export interface AdvisorBriefShortlistItem {
  readonly productId: string;
  readonly productName: string;
  readonly variantLabel?: string;
  readonly savedAt: string;
  readonly source: "wishlist" | "swipe_favorite";
}

export interface AdvisorBriefKnowledgeItem {
  readonly title: string;
  readonly occurredAt: string;
}

export interface AdvisorBriefQuestion {
  readonly body: string;
  readonly occurredAt: string;
  readonly source: "message" | "advisor_question_event";
}

export interface AdvisorBriefStylePreference {
  readonly conceptLabel: string;
  readonly kind: "declared" | "inferred";
  readonly polarity: StylePreferencePolarity;
  readonly confidence?: number;
  readonly source: string;
  readonly lastEvidenceAt: string;
}

export interface AdvisorBriefEvidenceSummary {
  readonly conceptLabel: string;
  readonly source: StyleEvidenceSource;
  readonly polarity: StylePreferencePolarity;
  readonly occurredAt: string;
}

export interface AdvisorBriefConversationLine {
  readonly body: string;
  readonly occurredAt: string;
  readonly sender: "customer" | "staff";
}

export interface AdvisorBriefOccasion {
  readonly label: string;
  readonly source: "conversation_intent" | "appointment_notes" | "style_notes";
}

export interface AdvisorPreparationBrief {
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly generatedAt: string;
  readonly personalizationStatus: AdvisorBriefPersonalizationStatus;
  readonly occasion?: AdvisorBriefOccasion;
  readonly interests: readonly AdvisorBriefInterest[];
  readonly shortlist: readonly AdvisorBriefShortlistItem[];
  readonly knowledge: readonly AdvisorBriefKnowledgeItem[];
  readonly questions: readonly AdvisorBriefQuestion[];
  readonly stylePreferences: readonly AdvisorBriefStylePreference[];
  readonly recentEvidence: readonly AdvisorBriefEvidenceSummary[];
  readonly conversationContinuity: readonly AdvisorBriefConversationLine[];
  /** Wardrobe gaps ship in Stage 4 — placeholder keeps the brief shape stable. */
  readonly wardrobeGapsAvailable: false;
}

export const ADVISOR_BRIEF_EVENT_LABELS: Readonly<
  Record<InteractionEventName, string>
> = {
  product_viewed: "Viewed a product",
  product_favorited: "Favorited a product",
  product_skipped: "Skipped a product",
  category_browsed: "Browsed a category",
  search_performed: "Searched the catalogue",
  filter_applied: "Applied a filter",
  cart_updated: "Updated the cart",
  knowledge_opened: "Opened a knowledge card",
  advisor_question: "Asked an advisor question",
  appointment_intent: "Showed appointment intent",
  conversion_recorded: "Recorded a conversion signal",
};

const MESSAGE_PREVIEW_MAX_LENGTH = 280;

export function advisorBriefPersonalizationStatus(
  consent: CustomerConsentState,
): AdvisorBriefPersonalizationStatus {
  const status = consent.personalization.status;
  if (status === "granted") return "available";
  if (status === "withdrawn") return "consent_withdrawn";
  return "consent_denied";
}

export function filterAdvisorVisibleEvents(args: {
  readonly events: readonly BehavioralEvent[];
  readonly advisorRetailerId: RetailerId;
  readonly personalizationConsent: ConsentStatus;
  readonly now: string;
}): BehavioralEvent[] {
  return args.events.filter((event) =>
    isAdvisorVisiblePersonalizationEvent({
      eventRetailerId: event.retailerId,
      advisorRetailerId: args.advisorRetailerId,
      customerId: event.customerId,
      anonymizedAt: event.anonymizedAt,
      retentionExpiresAt: event.retentionExpiresAt,
      now: args.now,
      personalizationConsent: args.personalizationConsent,
    }),
  );
}

function stringProperty(
  properties: Readonly<Record<string, unknown>>,
  key: string,
): string | undefined {
  const value = properties[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function truncatePreview(body: string): string {
  const normalized = body.replace(/\s+/g, " ").trim();
  if (normalized.length <= MESSAGE_PREVIEW_MAX_LENGTH) return normalized;
  return `${normalized.slice(0, MESSAGE_PREVIEW_MAX_LENGTH - 1)}…`;
}

function interestDetail(args: {
  readonly event: BehavioralEvent;
  readonly productNames: Readonly<Record<string, string>>;
  readonly knowledgeTitles: Readonly<Record<string, string>>;
}): string | undefined {
  const { event, productNames, knowledgeTitles } = args;
  const properties = event.properties;
  const productId = stringProperty(properties, "productId");
  if (productId && productNames[productId]) {
    return productNames[productId];
  }
  const knowledgeObjectId = stringProperty(properties, "knowledgeObjectId");
  if (knowledgeObjectId && knowledgeTitles[knowledgeObjectId]) {
    return knowledgeTitles[knowledgeObjectId];
  }
  const query = stringProperty(properties, "query");
  if (query) return query;
  const category = stringProperty(properties, "category");
  if (category) return category;
  const filter = stringProperty(properties, "filter");
  if (filter) return filter;
  const question = stringProperty(properties, "question");
  if (question) return truncatePreview(question);
  return undefined;
}

function buildInterests(args: {
  readonly events: readonly BehavioralEvent[];
  readonly productNames: Readonly<Record<string, string>>;
  readonly knowledgeTitles: Readonly<Record<string, string>>;
  readonly limit?: number;
}): AdvisorBriefInterest[] {
  const limit = args.limit ?? 8;
  return args.events
    .filter((event) =>
      (
        ADVISOR_BRIEF_INTEREST_EVENT_NAMES as readonly InteractionEventName[]
      ).includes(event.name),
    )
    .slice(0, limit)
    .map((event) => ({
      label: ADVISOR_BRIEF_EVENT_LABELS[event.name],
      eventName: event.name,
      occurredAt: event.occurredAt,
      ...(interestDetail({
        event,
        productNames: args.productNames,
        knowledgeTitles: args.knowledgeTitles,
      })
        ? {
            detail: interestDetail({
              event,
              productNames: args.productNames,
              knowledgeTitles: args.knowledgeTitles,
            }),
          }
        : {}),
    }));
}

function buildKnowledgeFromEvents(args: {
  readonly events: readonly BehavioralEvent[];
  readonly knowledgeTitles: Readonly<Record<string, string>>;
  readonly limit?: number;
}): AdvisorBriefKnowledgeItem[] {
  const limit = args.limit ?? 6;
  const items: AdvisorBriefKnowledgeItem[] = [];
  for (const event of args.events) {
    if (event.name !== "knowledge_opened") continue;
    const knowledgeObjectId = stringProperty(event.properties, "knowledgeObjectId");
    const title =
      (knowledgeObjectId && args.knowledgeTitles[knowledgeObjectId]) ??
      "Knowledge card";
    items.push({ title, occurredAt: event.occurredAt });
    if (items.length >= limit) break;
  }
  return items;
}

function buildQuestionsFromEvents(args: {
  readonly events: readonly BehavioralEvent[];
  readonly limit?: number;
}): AdvisorBriefQuestion[] {
  const limit = args.limit ?? 5;
  const items: AdvisorBriefQuestion[] = [];
  for (const event of args.events) {
    if (event.name !== "advisor_question") continue;
    const question = stringProperty(event.properties, "question");
    if (!question) continue;
    items.push({
      body: truncatePreview(question),
      occurredAt: event.occurredAt,
      source: "advisor_question_event",
    });
    if (items.length >= limit) break;
  }
  return items;
}

function buildStylePreferences(args: {
  readonly profile: CustomerStyleProfile | null;
  readonly conceptLabels: Readonly<Record<string, string>>;
}): AdvisorBriefStylePreference[] {
  if (!args.profile) return [];
  const declared = args.profile.explicitPreferences.map((pref) => ({
    conceptLabel: args.conceptLabels[pref.conceptId] ?? pref.conceptId,
    kind: "declared" as const,
    polarity: pref.polarity,
    source: "Declared by customer",
    lastEvidenceAt: pref.updatedAt,
  }));
  const inferred = args.profile.inferredPreferences.map((pref) => ({
    conceptLabel: args.conceptLabels[pref.conceptId] ?? pref.conceptId,
    kind: "inferred" as const,
    polarity: pref.polarity,
    confidence: pref.confidence,
    source: "Inferred from consented activity",
    lastEvidenceAt: pref.lastEvidenceAt,
  }));
  return [...declared, ...inferred];
}

function buildEvidenceSummary(args: {
  readonly evidence: readonly StylePreferenceEvidence[];
  readonly conceptLabels: Readonly<Record<string, string>>;
  readonly limit?: number;
}): AdvisorBriefEvidenceSummary[] {
  const limit = args.limit ?? 8;
  return args.evidence.slice(0, limit).map((row) => ({
    conceptLabel: args.conceptLabels[row.conceptId] ?? row.conceptId,
    source: row.source,
    polarity: row.polarity,
    occurredAt: row.createdAt,
  }));
}

function resolveOccasion(args: {
  readonly conversationIntent?: ConversationIntent;
  readonly appointmentNotes?: string;
  readonly styleNotes?: string;
}): AdvisorBriefOccasion | undefined {
  if (args.conversationIntent) {
    return {
      label: CONVERSATION_INTENT_LABELS[args.conversationIntent],
      source: "conversation_intent",
    };
  }
  if (args.appointmentNotes?.trim()) {
    return {
      label: truncatePreview(args.appointmentNotes),
      source: "appointment_notes",
    };
  }
  if (args.styleNotes?.trim()) {
    return {
      label: truncatePreview(args.styleNotes),
      source: "style_notes",
    };
  }
  return undefined;
}

export interface AdvisorBriefBuildInput {
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly now: string;
  readonly consent: CustomerConsentState;
  readonly events: readonly BehavioralEvent[];
  readonly profile: CustomerStyleProfile | null;
  readonly evidence: readonly StylePreferenceEvidence[];
  readonly conceptLabels: Readonly<Record<string, string>>;
  readonly productNames: Readonly<Record<string, string>>;
  readonly knowledgeTitles: Readonly<Record<string, string>>;
  readonly shortlistItems: readonly AdvisorBriefShortlistItem[];
  readonly customerMessages: readonly { body: string; createdAt: string }[];
  readonly staffMessages: readonly { body: string; createdAt: string }[];
  readonly conversationIntent?: ConversationIntent;
  readonly styleNotes?: string;
  readonly appointmentNotes?: string;
}

/**
 * Pure projection: consent-gated personalization slices plus durable
 * conversation/occasion context. No network I/O or hidden inference.
 */
export function buildAdvisorPreparationBrief(
  input: AdvisorBriefBuildInput,
): AdvisorPreparationBrief {
  const personalizationStatus = advisorBriefPersonalizationStatus(
    input.consent,
  );
  const personalizationConsent = input.consent.personalization.status;

  const visibleEvents =
    personalizationStatus === "available"
      ? filterAdvisorVisibleEvents({
          events: input.events,
          advisorRetailerId: input.retailerId,
          personalizationConsent,
          now: input.now,
        })
      : [];

  const interests = buildInterests({
    events: visibleEvents,
    productNames: input.productNames,
    knowledgeTitles: input.knowledgeTitles,
  });
  const knowledge = buildKnowledgeFromEvents({
    events: visibleEvents,
    knowledgeTitles: input.knowledgeTitles,
  });
  const eventQuestions = buildQuestionsFromEvents({ events: visibleEvents });

  const messageQuestions: AdvisorBriefQuestion[] = input.customerMessages
    .slice(-5)
    .reverse()
    .map((message) => ({
      body: truncatePreview(message.body),
      occurredAt: message.createdAt,
      source: "message" as const,
    }));

  const questions = [...eventQuestions, ...messageQuestions]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 6);

  const conversationContinuity: AdvisorBriefConversationLine[] = [
    ...input.customerMessages.map((message) => ({
      body: truncatePreview(message.body),
      occurredAt: message.createdAt,
      sender: "customer" as const,
    })),
    ...input.staffMessages.map((message) => ({
      body: truncatePreview(message.body),
      occurredAt: message.createdAt,
      sender: "staff" as const,
    })),
  ]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 6);

  return {
    retailerId: input.retailerId,
    customerId: input.customerId,
    generatedAt: input.now,
    personalizationStatus,
    ...(resolveOccasion({
      conversationIntent: input.conversationIntent,
      appointmentNotes: input.appointmentNotes,
      styleNotes: input.styleNotes,
    })
      ? {
          occasion: resolveOccasion({
            conversationIntent: input.conversationIntent,
            appointmentNotes: input.appointmentNotes,
            styleNotes: input.styleNotes,
          }),
        }
      : {}),
    interests,
    shortlist: personalizationStatus === "available" ? input.shortlistItems : [],
    knowledge,
    questions,
    stylePreferences:
      personalizationStatus === "available"
        ? buildStylePreferences({
            profile: input.profile,
            conceptLabels: input.conceptLabels,
          })
        : [],
    recentEvidence:
      personalizationStatus === "available"
        ? buildEvidenceSummary({
            evidence: input.evidence,
            conceptLabels: input.conceptLabels,
          })
        : [],
    conversationContinuity,
    wardrobeGapsAvailable: false,
  };
}
