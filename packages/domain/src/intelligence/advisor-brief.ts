/**
 * Advisor preparation brief projection (ADV-003, CUST-003, ADR-061 /
 * PHASE 3.3). Aggregates only same-retailer, consented intelligence into
 * a deterministic briefing — never invents facts or crosses tenants.
 */

import type {
  ConversationIntent,
  Message,
  MessageSenderType,
} from "../engagement/messaging";
import { CONVERSATION_INTENT_LABELS } from "../engagement/messaging";
import type {
  ConversationId,
  CustomerId,
  KnowledgeObjectId,
  MessageId,
  MetadataConceptId,
  ProductId,
  ProductVariantId,
  RetailerId,
  StylePreferenceEvidenceId,
  WardrobeItemId,
} from "../shared/branded-id";
import { asId } from "../shared/branded-id";
import type { AdvisorBriefWardrobeGap } from "../wardrobe/roadmap";
import type { WardrobeFitPerception } from "../wardrobe/wardrobe";

import {
  isAdvisorVisiblePersonalizationEvent,
  type ConsentStatus,
  type CustomerConsentState,
} from "./consent";
import type {
  BehavioralEvent,
  InteractionEventName,
} from "./interaction-event";
import {
  STYLE_EVIDENCE_HALF_LIFE_DAYS,
  type CustomerStyleProfile,
  type StyleEvidenceSource,
  type StylePreferenceEvidence,
  type StylePreferencePolarity,
} from "./style-profile";

export const ADVISOR_BRIEF_VISIBILITIES = [
  "usable",
  "consent_denied",
  "consent_withdrawn",
  "consent_missing",
] as const;

export type AdvisorBriefVisibility =
  (typeof ADVISOR_BRIEF_VISIBILITIES)[number];

export const ADVISOR_BRIEF_INTEREST_SOURCES = [
  "declared",
  "inferred",
  "product_viewed",
  "product_favorited",
  "product_skipped",
  "search_performed",
  "filter_applied",
  "cart_updated",
  "knowledge_opened",
  "advisor_question",
  "appointment_intent",
  "conversion_recorded",
  "wishlist",
] as const;

export type AdvisorBriefInterestSource =
  (typeof ADVISOR_BRIEF_INTEREST_SOURCES)[number];

export interface AdvisorBriefInterest {
  readonly label: string;
  readonly source: AdvisorBriefInterestSource;
  readonly occurredAt: string;
  readonly conceptId?: MetadataConceptId;
  readonly productId?: ProductId;
  readonly confidence?: number;
}

export interface AdvisorBriefShortlistItem {
  readonly label: string;
  readonly source: "wishlist" | "product_favorited";
  readonly occurredAt: string;
  readonly productId?: ProductId;
  readonly productVariantId?: ProductVariantId;
}

export interface AdvisorBriefKnowledgeItem {
  readonly label: string;
  readonly occurredAt: string;
  readonly knowledgeObjectId?: KnowledgeObjectId;
}

export interface AdvisorBriefEvidenceItem {
  readonly evidenceId: StylePreferenceEvidenceId;
  readonly conceptId: MetadataConceptId;
  readonly conceptLabel: string;
  readonly source: StyleEvidenceSource;
  readonly polarity: StylePreferencePolarity;
  readonly confidence: number;
  readonly occurredAt: string;
  readonly stale: boolean;
}

export interface AdvisorBriefQuestion {
  readonly id: string;
  readonly body: string;
  readonly occurredAt: string;
  readonly source: "conversation" | "advisor_question_event";
}

export interface AdvisorBriefOccasion {
  readonly label: string;
  readonly source: "declared" | "conversation_intent" | "appointment_notes";
  readonly occurredAt: string;
}

export interface AdvisorBriefWardrobeSelfReport {
  readonly wardrobeItemId: WardrobeItemId;
  readonly itemLabel: string;
  readonly reportedAt: string;
  readonly notes?: string;
  readonly fitPerception?: WardrobeFitPerception;
  readonly provenanceLabel: "Customer self-report";
}

export interface AdvisorBriefLikelyNeed {
  readonly summary: string;
  readonly source: string;
  readonly occurredAt: string;
}

export interface AdvisorBriefPreparationSuggestion {
  readonly code:
    | "review_occasion"
    | "pull_shortlist"
    | "continue_conversation"
    | "confirm_preferences"
    | "open_appointment_request"
    | "start_from_relationship";
  readonly text: string;
}

export interface AdvisorBriefConversationMessage {
  readonly id: MessageId;
  readonly senderType: MessageSenderType;
  readonly body: string;
  readonly createdAt: string;
}

export interface AdvisorBriefConversation {
  readonly conversationId: ConversationId;
  readonly intent?: ConversationIntent;
  readonly recentMessages: readonly AdvisorBriefConversationMessage[];
}

/**
 * Retailer-scoped intelligence projection for appointment preparation.
 * Wardrobe gaps stay empty until Stage 4; never includes email/phone/address.
 */
export interface AdvisorPreparationBrief {
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly visibility: AdvisorBriefVisibility;
  readonly generatedAt: string;
  readonly likelyNeed?: AdvisorBriefLikelyNeed;
  readonly interests: readonly AdvisorBriefInterest[];
  readonly savedProducts: readonly AdvisorBriefShortlistItem[];
  readonly knowledgeConsumed: readonly AdvisorBriefKnowledgeItem[];
  readonly occasion?: AdvisorBriefOccasion;
  readonly evidence: readonly AdvisorBriefEvidenceItem[];
  readonly questions: readonly AdvisorBriefQuestion[];
  readonly shortlist: readonly AdvisorBriefShortlistItem[];
  /** Ranked wardrobe gaps from the active roadmap when Stage 4.2 data exists. */
  readonly wardrobeGaps: readonly AdvisorBriefWardrobeGap[];
  /** Recent customer self-scan reports — never official measurements (4.3). */
  readonly wardrobeSelfReports: readonly AdvisorBriefWardrobeSelfReport[];
  readonly preparationSuggestions: readonly AdvisorBriefPreparationSuggestion[];
  readonly conversation?: AdvisorBriefConversation;
}

export interface AdvisorBriefResolvedWishlistItem {
  readonly productVariantId: ProductVariantId;
  readonly productId: ProductId;
  readonly label: string;
  readonly addedAt: string;
}

export interface AdvisorBriefProjectionInput {
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  /** Must equal retailerId for a usable brief; cross-tenant fails closed. */
  readonly advisorRetailerId: RetailerId;
  readonly now: string;
  readonly consent: CustomerConsentState;
  readonly events: readonly BehavioralEvent[];
  readonly profile: CustomerStyleProfile | null;
  readonly evidence: readonly StylePreferenceEvidence[];
  readonly conceptLabels: ReadonlyMap<string, string>;
  readonly productLabels: ReadonlyMap<string, string>;
  readonly knowledgeLabels: ReadonlyMap<string, string>;
  readonly wishlistItems: readonly AdvisorBriefResolvedWishlistItem[];
  readonly conversationId?: ConversationId;
  readonly conversationIntent?: ConversationIntent;
  readonly messages: readonly Message[];
  readonly appointmentNotes?: string;
  /** Days after which active evidence is flagged stale for advisor attention. */
  readonly staleEvidenceAfterDays?: number;
  readonly maxInterests?: number;
  readonly maxEvidence?: number;
  readonly maxQuestions?: number;
  readonly maxMessages?: number;
  /** Optional ranked gaps from the customer's wardrobe roadmap (PHASE 4.2). */
  readonly wardrobeGaps?: readonly AdvisorBriefWardrobeGap[];
  /** Optional recent self-scan reports for advisor context (PHASE 4.3). */
  readonly wardrobeSelfReports?: readonly AdvisorBriefWardrobeSelfReport[];
}

const INTEREST_EVENT_NAMES = new Set<InteractionEventName>([
  "product_viewed",
  "product_favorited",
  "search_performed",
  "filter_applied",
  "cart_updated",
  "knowledge_opened",
  "advisor_question",
  "appointment_intent",
]);

function asUuidString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    return null;
  }
  return value;
}

function readPropertyString(
  properties: Readonly<Record<string, unknown>>,
  key: string,
): string | null {
  const value = properties[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export function resolveAdvisorBriefVisibility(
  personalization: ConsentStatus,
): AdvisorBriefVisibility {
  switch (personalization) {
    case "granted":
      return "usable";
    case "withdrawn":
      return "consent_withdrawn";
    case "denied":
      return "consent_denied";
    default: {
      const _exhaustive: never = personalization;
      return _exhaustive;
    }
  }
}

/**
 * Cross-tenant advisor reads fail closed even when consent appears granted
 * on the input object (defensive; RLS remains the database boundary).
 */
export function mayProjectAdvisorBrief(args: {
  readonly retailerId: RetailerId;
  readonly advisorRetailerId: RetailerId;
  readonly consentRetailerId: RetailerId;
  readonly consentCustomerId: CustomerId;
  readonly customerId: CustomerId;
}): boolean {
  return (
    args.retailerId === args.advisorRetailerId &&
    args.consentRetailerId === args.retailerId &&
    args.consentCustomerId === args.customerId
  );
}

export function isStaleAdvisorEvidence(args: {
  readonly createdAt: string;
  readonly now: string;
  readonly staleAfterDays?: number;
  readonly suppressedAt?: string;
}): boolean {
  if (args.suppressedAt) return true;
  const days = args.staleAfterDays ?? STYLE_EVIDENCE_HALF_LIFE_DAYS * 2;
  const created = Date.parse(args.createdAt);
  const now = Date.parse(args.now);
  if (Number.isNaN(created) || Number.isNaN(now)) return true;
  return now - created >= days * 24 * 60 * 60 * 1000;
}

function emptyBrief(
  input: AdvisorBriefProjectionInput,
  visibility: AdvisorBriefVisibility,
  conversation?: AdvisorBriefConversation,
): AdvisorPreparationBrief {
  const suggestions = buildPreparationSuggestions({
    visibility,
    shortlistCount: 0,
    questionCount: 0,
    evidenceCount: 0,
    hasConversation: Boolean(conversation),
    hasAppointmentNotes: Boolean(input.appointmentNotes?.trim()),
  });

  return {
    retailerId: input.retailerId,
    customerId: input.customerId,
    visibility,
    generatedAt: input.now,
    interests: [],
    savedProducts: [],
    knowledgeConsumed: [],
    evidence: [],
    questions: [],
    shortlist: [],
    wardrobeGaps: [],
    wardrobeSelfReports: [],
    preparationSuggestions: suggestions,
    ...(conversation ? { conversation } : {}),
  };
}

function projectConversation(
  input: AdvisorBriefProjectionInput,
): AdvisorBriefConversation | undefined {
  if (!input.conversationId) return undefined;
  const maxMessages = input.maxMessages ?? 8;
  const recentMessages = [...input.messages]
    .filter((message) => message.deletedAt == null)
    .sort(
      (a, b) =>
        Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, maxMessages)
    .reverse()
    .map((message): AdvisorBriefConversationMessage => ({
      id: message.id,
      senderType: message.senderType,
      body: message.body,
      createdAt: message.createdAt,
    }));

  return {
    conversationId: input.conversationId,
    ...(input.conversationIntent ? { intent: input.conversationIntent } : {}),
    recentMessages,
  };
}

function visibleEvents(input: AdvisorBriefProjectionInput): BehavioralEvent[] {
  return input.events.filter((event) =>
    isAdvisorVisiblePersonalizationEvent({
      eventRetailerId: event.retailerId,
      advisorRetailerId: input.advisorRetailerId,
      ...(event.customerId ? { customerId: event.customerId } : {}),
      anonymizedAt: event.anonymizedAt ?? null,
      retentionExpiresAt: event.retentionExpiresAt,
      now: input.now,
      personalizationConsent: input.consent.personalization.status,
    }),
  );
}

function projectSavedProducts(
  items: readonly AdvisorBriefResolvedWishlistItem[],
): AdvisorBriefShortlistItem[] {
  return [...items]
    .sort(
      (a, b) =>
        Date.parse(b.addedAt) - Date.parse(a.addedAt) ||
        a.productVariantId.localeCompare(b.productVariantId),
    )
    .map((item) => ({
      label: item.label,
      source: "wishlist" as const,
      occurredAt: item.addedAt,
      productId: item.productId,
      productVariantId: item.productVariantId,
    }));
}

function projectFavoriteShortlist(
  events: readonly BehavioralEvent[],
  productLabels: ReadonlyMap<string, string>,
): AdvisorBriefShortlistItem[] {
  const seen = new Set<string>();
  const items: AdvisorBriefShortlistItem[] = [];

  for (const event of events) {
    if (event.name !== "product_favorited") continue;
    const productIdRaw = asUuidString(event.properties.productId);
    const variantIdRaw = asUuidString(event.properties.productVariantId);
    const key = variantIdRaw ?? productIdRaw;
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const label =
      (productIdRaw ? productLabels.get(productIdRaw) : undefined) ??
      readPropertyString(event.properties, "productName") ??
      "Saved product";

    items.push({
      label,
      source: "product_favorited",
      occurredAt: event.occurredAt,
      ...(productIdRaw ? { productId: asId<"ProductId">(productIdRaw) } : {}),
      ...(variantIdRaw
        ? { productVariantId: asId<"ProductVariantId">(variantIdRaw) }
        : {}),
    });
  }

  return items;
}

function mergeShortlist(
  wishlist: readonly AdvisorBriefShortlistItem[],
  favorites: readonly AdvisorBriefShortlistItem[],
): AdvisorBriefShortlistItem[] {
  const seen = new Set<string>();
  const merged: AdvisorBriefShortlistItem[] = [];

  for (const item of [...wishlist, ...favorites]) {
    const key =
      item.productVariantId ??
      item.productId ??
      `${item.label}:${item.occurredAt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged.sort(
    (a, b) =>
      Date.parse(b.occurredAt) - Date.parse(a.occurredAt) ||
      a.label.localeCompare(b.label),
  );
}

function projectKnowledge(
  events: readonly BehavioralEvent[],
  knowledgeLabels: ReadonlyMap<string, string>,
): AdvisorBriefKnowledgeItem[] {
  const seen = new Set<string>();
  const items: AdvisorBriefKnowledgeItem[] = [];

  for (const event of events) {
    if (event.name !== "knowledge_opened") continue;
    const knowledgeIdRaw =
      asUuidString(event.properties.knowledgeObjectId) ??
      asUuidString(event.properties.knowledgeId);
    const key = knowledgeIdRaw ?? `${event.occurredAt}:${event.name}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const label =
      (knowledgeIdRaw ? knowledgeLabels.get(knowledgeIdRaw) : undefined) ??
      readPropertyString(event.properties, "title") ??
      readPropertyString(event.properties, "knowledgeTitle") ??
      "Knowledge card";

    items.push({
      label,
      occurredAt: event.occurredAt,
      ...(knowledgeIdRaw
        ? { knowledgeObjectId: asId<"KnowledgeObjectId">(knowledgeIdRaw) }
        : {}),
    });
  }

  return items;
}

function projectEvidence(
  input: AdvisorBriefProjectionInput,
): AdvisorBriefEvidenceItem[] {
  const maxEvidence = input.maxEvidence ?? 12;
  return input.evidence
    .filter(
      (row) =>
        row.retailerId === input.retailerId &&
        row.customerId === input.customerId &&
        !row.suppressedAt,
    )
    .sort(
      (a, b) =>
        Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, maxEvidence)
    .map((row) => {
      const conceptLabel =
        input.conceptLabels.get(row.conceptId) ?? "Preference concept";
      return {
        evidenceId: row.id,
        conceptId: row.conceptId,
        conceptLabel,
        source: row.source,
        polarity: row.polarity,
        confidence: row.confidence,
        occurredAt: row.createdAt,
        stale: isStaleAdvisorEvidence({
          createdAt: row.createdAt,
          now: input.now,
          ...(input.staleEvidenceAfterDays !== undefined
            ? { staleAfterDays: input.staleEvidenceAfterDays }
            : {}),
          ...(row.suppressedAt ? { suppressedAt: row.suppressedAt } : {}),
        }),
      };
    });
}

function projectInterests(
  input: AdvisorBriefProjectionInput,
  events: readonly BehavioralEvent[],
  evidence: readonly AdvisorBriefEvidenceItem[],
): AdvisorBriefInterest[] {
  const maxInterests = input.maxInterests ?? 12;
  const interests: AdvisorBriefInterest[] = [];

  if (input.profile) {
    for (const declared of input.profile.explicitPreferences) {
      interests.push({
        label:
          input.conceptLabels.get(declared.conceptId) ??
          declared.note ??
          "Declared preference",
        source: "declared",
        occurredAt: declared.updatedAt,
        conceptId: declared.conceptId,
        confidence: 1,
      });
    }
    for (const inferred of input.profile.inferredPreferences) {
      interests.push({
        label:
          input.conceptLabels.get(inferred.conceptId) ?? "Inferred preference",
        source: "inferred",
        occurredAt: inferred.lastEvidenceAt,
        conceptId: inferred.conceptId,
        confidence: inferred.confidence,
      });
    }
  }

  for (const row of evidence) {
    if (row.source === "declared") continue;
    interests.push({
      label: row.conceptLabel,
      source: row.source as AdvisorBriefInterestSource,
      occurredAt: row.occurredAt,
      conceptId: row.conceptId,
      confidence: row.confidence,
    });
  }

  for (const event of events) {
    if (!INTEREST_EVENT_NAMES.has(event.name)) continue;
    const productIdRaw = asUuidString(event.properties.productId);
    const conceptIdRaw =
      asUuidString(event.properties.conceptId) ??
      (Array.isArray(event.properties.conceptIds)
        ? asUuidString(event.properties.conceptIds[0])
        : null);
    const searchQuery = readPropertyString(event.properties, "query");
    const label =
      (conceptIdRaw ? input.conceptLabels.get(conceptIdRaw) : undefined) ??
      (productIdRaw ? input.productLabels.get(productIdRaw) : undefined) ??
      searchQuery ??
      readPropertyString(event.properties, "productName") ??
      event.name.replaceAll("_", " ");

    interests.push({
      label,
      source: event.name as AdvisorBriefInterestSource,
      occurredAt: event.occurredAt,
      ...(conceptIdRaw
        ? { conceptId: asId<"MetadataConceptId">(conceptIdRaw) }
        : {}),
      ...(productIdRaw ? { productId: asId<"ProductId">(productIdRaw) } : {}),
    });
  }

  const seen = new Set<string>();
  return interests
    .sort(
      (a, b) =>
        Date.parse(b.occurredAt) - Date.parse(a.occurredAt) ||
        a.label.localeCompare(b.label),
    )
    .filter((item) => {
      const key = `${item.source}:${item.conceptId ?? item.productId ?? item.label}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maxInterests);
}

function projectQuestions(
  input: AdvisorBriefProjectionInput,
  events: readonly BehavioralEvent[],
): AdvisorBriefQuestion[] {
  const maxQuestions = input.maxQuestions ?? 8;
  const questions: AdvisorBriefQuestion[] = [];

  for (const message of input.messages) {
    if (message.deletedAt != null) continue;
    if (message.senderType !== "customer" && message.senderType !== "guest") {
      continue;
    }
    questions.push({
      id: message.id,
      body: message.body,
      occurredAt: message.createdAt,
      source: "conversation",
    });
  }

  for (const event of events) {
    if (event.name !== "advisor_question") continue;
    const body =
      readPropertyString(event.properties, "question") ??
      readPropertyString(event.properties, "body") ??
      readPropertyString(event.properties, "text");
    if (!body) continue;
    questions.push({
      id: `event:${event.id ?? event.occurredAt}`,
      body,
      occurredAt: event.occurredAt,
      source: "advisor_question_event",
    });
  }

  const seen = new Set<string>();
  return questions
    .sort(
      (a, b) =>
        Date.parse(b.occurredAt) - Date.parse(a.occurredAt) ||
        a.id.localeCompare(b.id),
    )
    .filter((item) => {
      const key = item.body.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maxQuestions);
}

function projectOccasion(
  input: AdvisorBriefProjectionInput,
  evidence: readonly AdvisorBriefEvidenceItem[],
): AdvisorBriefOccasion | undefined {
  const occasionEvidence = evidence.find((row) => {
    const label = row.conceptLabel.toLowerCase();
    return (
      row.source === "declared" ||
      label.includes("wedding") ||
      label.includes("occasion")
    );
  });
  if (occasionEvidence) {
    return {
      label: occasionEvidence.conceptLabel,
      source: "declared",
      occurredAt: occasionEvidence.occurredAt,
    };
  }

  if (input.conversationIntent) {
    return {
      label: CONVERSATION_INTENT_LABELS[input.conversationIntent],
      source: "conversation_intent",
      occurredAt: input.now,
    };
  }

  const notes = input.appointmentNotes?.trim();
  if (notes) {
    return {
      label: notes.length > 120 ? `${notes.slice(0, 117)}…` : notes,
      source: "appointment_notes",
      occurredAt: input.now,
    };
  }

  return undefined;
}

function projectLikelyNeed(args: {
  readonly now: string;
  readonly occasion?: AdvisorBriefOccasion;
  readonly interests: readonly AdvisorBriefInterest[];
  readonly conversationIntent?: ConversationIntent;
}): AdvisorBriefLikelyNeed | undefined {
  if (args.occasion) {
    return {
      summary: `Likely need: ${args.occasion.label}`,
      source: args.occasion.source,
      occurredAt: args.occasion.occurredAt,
    };
  }
  if (args.conversationIntent) {
    return {
      summary: `Conversation intent: ${CONVERSATION_INTENT_LABELS[args.conversationIntent]}`,
      source: "conversation_intent",
      occurredAt: args.interests[0]?.occurredAt ?? args.now,
    };
  }
  const top = args.interests[0];
  if (top) {
    return {
      summary: `Recent interest: ${top.label}`,
      source: top.source,
      occurredAt: top.occurredAt,
    };
  }
  return undefined;
}

export function buildPreparationSuggestions(args: {
  readonly visibility: AdvisorBriefVisibility;
  readonly occasion?: AdvisorBriefOccasion;
  readonly shortlistCount: number;
  readonly questionCount: number;
  readonly evidenceCount: number;
  readonly hasConversation: boolean;
  readonly hasAppointmentNotes: boolean;
}): AdvisorBriefPreparationSuggestion[] {
  const suggestions: AdvisorBriefPreparationSuggestion[] = [];

  if (args.visibility !== "usable") {
    suggestions.push({
      code: "start_from_relationship",
      text: "Personalization consent is not available — prepare from the appointment request, pinned notes, and conversation only.",
    });
    if (args.hasAppointmentNotes) {
      suggestions.push({
        code: "open_appointment_request",
        text: "Read the appointment request carefully before the visit.",
      });
    }
    if (args.hasConversation) {
      suggestions.push({
        code: "continue_conversation",
        text: "Continue the existing message thread rather than restarting the conversation.",
      });
    }
    return suggestions;
  }

  if (args.occasion) {
    suggestions.push({
      code: "review_occasion",
      text: `Review fabric books and options suited to ${args.occasion.label}.`,
    });
  }
  if (args.shortlistCount > 0) {
    suggestions.push({
      code: "pull_shortlist",
      text: "Pull shortlisted pieces onto the table so the visit continues from their online shortlist.",
    });
  }
  if (args.questionCount > 0 || args.hasConversation) {
    suggestions.push({
      code: "continue_conversation",
      text: "Continue the online conversation in store — open the message thread before greeting them.",
    });
  }
  if (args.evidenceCount > 0) {
    suggestions.push({
      code: "confirm_preferences",
      text: "Confirm inferred preferences with the client; do not treat them as settled facts.",
    });
  }
  if (args.hasAppointmentNotes) {
    suggestions.push({
      code: "open_appointment_request",
      text: "Anchor the visit in the appointment request they already wrote.",
    });
  }
  if (suggestions.length === 0) {
    suggestions.push({
      code: "start_from_relationship",
      text: "Start from the relationship workspace and ask what brought them in today.",
    });
  }

  return suggestions;
}

/**
 * Deterministic advisor preparation brief. Fail closed on cross-tenant or
 * missing personalization consent for intelligence sections; conversation
 * continuation remains available as an operational relationship record.
 */
export function buildAdvisorPreparationBrief(
  input: AdvisorBriefProjectionInput,
): AdvisorPreparationBrief {
  const conversation = projectConversation(input);

  if (
    !mayProjectAdvisorBrief({
      retailerId: input.retailerId,
      advisorRetailerId: input.advisorRetailerId,
      consentRetailerId: input.consent.retailerId,
      consentCustomerId: input.consent.customerId,
      customerId: input.customerId,
    })
  ) {
    return emptyBrief(input, "consent_denied");
  }

  const visibility = resolveAdvisorBriefVisibility(
    input.consent.personalization.status,
  );

  if (visibility !== "usable") {
    return emptyBrief(input, visibility, conversation);
  }

  const events = visibleEvents(input);
  const savedProducts = projectSavedProducts(input.wishlistItems);
  const favoriteShortlist = projectFavoriteShortlist(
    events,
    input.productLabels,
  );
  const shortlist = mergeShortlist(savedProducts, favoriteShortlist);
  const knowledgeConsumed = projectKnowledge(events, input.knowledgeLabels);
  const evidence = projectEvidence(input);
  const interests = projectInterests(input, events, evidence);
  const questions = projectQuestions(input, events);
  const occasion = projectOccasion(input, evidence);
  const likelyNeed = projectLikelyNeed({
    now: input.now,
    ...(occasion ? { occasion } : {}),
    interests,
    ...(input.conversationIntent
      ? { conversationIntent: input.conversationIntent }
      : {}),
  });
  const preparationSuggestions = buildPreparationSuggestions({
    visibility,
    ...(occasion ? { occasion } : {}),
    shortlistCount: shortlist.length,
    questionCount: questions.length,
    evidenceCount: evidence.filter((row) => !row.stale).length,
    hasConversation: Boolean(conversation),
    hasAppointmentNotes: Boolean(input.appointmentNotes?.trim()),
  });

  return {
    retailerId: input.retailerId,
    customerId: input.customerId,
    visibility,
    generatedAt: input.now,
    ...(likelyNeed ? { likelyNeed } : {}),
    interests,
    savedProducts,
    knowledgeConsumed,
    ...(occasion ? { occasion } : {}),
    evidence,
    questions,
    shortlist,
    wardrobeGaps: input.wardrobeGaps ?? [],
    wardrobeSelfReports: input.wardrobeSelfReports ?? [],
    preparationSuggestions,
    ...(conversation ? { conversation } : {}),
  };
}
