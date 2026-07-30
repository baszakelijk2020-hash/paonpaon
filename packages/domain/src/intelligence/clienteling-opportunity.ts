/**
 * Sparse clienteling opportunity drafts (CLI-004 / CLI-005 / PHASE 7.4 / ADR-066).
 * Deterministic hooks with why-now, cited evidence, suggested action/channel/time,
 * contact-pressure cooldown, and draft-by-default status. Never autonomously contacts
 * customers.
 */

import type {
  AppointmentId,
  BehavioralEventId,
  CustomerFactId,
  CustomerId,
  MessageId,
  OrderId,
  RetailerId,
  StaffId,
} from "../shared/branded-id";

import type { CustomerInterestInsight } from "./customer-interest";
import type { BehavioralEvent } from "./interaction-event";

export const CLIENTELING_OPPORTUNITY_PROJECTOR_VERSION =
  "clienteling-opportunity-v1";

export const CLIENTELING_HOOK_KINDS = [
  "recent_browsing",
  "interest_affinity",
  "advisor_question",
  "appointment_intent",
  "wishlist_signal",
  "dormancy",
] as const;

export type ClientelingHookKind = (typeof CLIENTELING_HOOK_KINDS)[number];

export const CLIENTELING_SUGGESTED_ACTIONS = [
  "send_message",
  "book_appointment",
  "add_note",
  "review_shortlist",
] as const;

export type ClientelingSuggestedAction =
  (typeof CLIENTELING_SUGGESTED_ACTIONS)[number];

export const CLIENTELING_SUGGESTED_CHANNELS = [
  "in_app_message",
  "phone",
  "in_store",
  "email",
] as const;

export type ClientelingSuggestedChannel =
  (typeof CLIENTELING_SUGGESTED_CHANNELS)[number];

export const CLIENTELING_OPPORTUNITY_STATUSES = [
  "draft",
  "assigned",
  "in_progress",
  "completed",
  "dismissed",
  "expired",
] as const;

export type ClientelingOpportunityStatus =
  (typeof CLIENTELING_OPPORTUNITY_STATUSES)[number];

export const CLIENTELING_OUTCOME_TYPES = [
  "message_sent",
  "appointment_booked",
  "sale_recorded",
  "no_response",
  "not_relevant",
] as const;

export type ClientelingOutcomeType = (typeof CLIENTELING_OUTCOME_TYPES)[number];

/** Days after any outbound contact before another hook is suppressed. */
export const DEFAULT_CONTACT_COOLDOWN_DAYS = 7;
export const DEFAULT_MAX_DRAFTS_PER_CUSTOMER = 3;
export const DEFAULT_MAX_INBOX_OPPORTUNITIES = 10;
export const RECENT_ACTIVITY_WINDOW_DAYS = 3;
export const DORMANCY_THRESHOLD_DAYS = 60;

export interface ClientelingOpportunityEvidenceRef {
  readonly eventId?: BehavioralEventId;
  readonly factId?: CustomerFactId;
  readonly insightKey?: string;
}

export interface ClientelingOpportunityDraft {
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly customerName: string;
  readonly hookKind: ClientelingHookKind;
  readonly projectorKey: string;
  readonly title: string;
  readonly whyNow: string;
  readonly suggestedAction: ClientelingSuggestedAction;
  readonly suggestedChannel: ClientelingSuggestedChannel;
  /** ISO time hint for when to reach out (advisor-local interpretation). */
  readonly suggestedAt: string;
  readonly priority: number;
  readonly confidence: number;
  readonly dueAt: string;
  readonly expiresAt: string;
  readonly evidence: readonly ClientelingOpportunityEvidenceRef[];
  readonly projectorVersion: string;
}

export interface ClientelingOpportunity extends ClientelingOpportunityDraft {
  readonly id: string;
  readonly status: ClientelingOpportunityStatus;
  readonly assignedStaffId?: StaffId;
  readonly feedbackNote?: string;
  readonly outcomeType?: ClientelingOutcomeType;
  readonly outcomeMessageId?: MessageId;
  readonly outcomeAppointmentId?: AppointmentId;
  readonly outcomeOrderId?: OrderId;
  readonly outcomeRecordedAt?: string;
  readonly outcomeStaffId?: StaffId;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RecentContactRecord {
  readonly customerId: CustomerId;
  readonly occurredAt: string;
  readonly source: "opportunity_outcome" | "clienteling_note" | "message";
}

export interface ClientelingOpportunityProjectionInput {
  readonly retailerId: RetailerId;
  readonly viewerRetailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly customerName: string;
  readonly now: string;
  readonly events: readonly BehavioralEvent[];
  readonly interestInsights: readonly CustomerInterestInsight[];
  readonly recentContacts: readonly RecentContactRecord[];
  readonly existingProjectorKeys: readonly string[];
  readonly cooldownDays?: number;
  readonly maxDrafts?: number;
}

export interface ClientelingOpportunityProjection {
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly drafts: readonly ClientelingOpportunityDraft[];
  readonly suppressedByCooldown: number;
  readonly suppressedByDuplicate: number;
}

function parseMs(iso: string): number {
  return new Date(iso).getTime();
}

function addDays(iso: string, days: number): string {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function daysBetween(laterIso: string, earlierIso: string): number {
  return (parseMs(laterIso) - parseMs(earlierIso)) / (24 * 60 * 60 * 1000);
}

function isWithinDays(
  occurredAt: string,
  now: string,
  windowDays: number,
): boolean {
  return daysBetween(now, occurredAt) <= windowDays;
}

function latestEvent(
  events: readonly BehavioralEvent[],
  names: readonly BehavioralEvent["name"][],
): BehavioralEvent | undefined {
  let latest: BehavioralEvent | undefined;
  for (const event of events) {
    if (!names.includes(event.name)) continue;
    if (!latest || parseMs(event.occurredAt) > parseMs(latest.occurredAt)) {
      latest = event;
    }
  }
  return latest;
}

function countRecentViews(
  events: readonly BehavioralEvent[],
  now: string,
  windowDays: number,
): { count: number; latest?: BehavioralEvent; eventIds: BehavioralEventId[] } {
  const eventIds: BehavioralEventId[] = [];
  let count = 0;
  let latest: BehavioralEvent | undefined;
  for (const event of events) {
    if (event.name !== "product_viewed") continue;
    if (!event.id) continue;
    if (!isWithinDays(event.occurredAt, now, windowDays)) continue;
    count += 1;
    eventIds.push(event.id);
    if (!latest || parseMs(event.occurredAt) > parseMs(latest.occurredAt)) {
      latest = event;
    }
  }
  return {
    count,
    ...(latest ? { latest } : {}),
    eventIds,
  };
}

function isOnContactCooldown(
  customerId: CustomerId,
  recentContacts: readonly RecentContactRecord[],
  now: string,
  cooldownDays: number,
): boolean {
  for (const contact of recentContacts) {
    if (contact.customerId !== customerId) continue;
    if (isWithinDays(contact.occurredAt, now, cooldownDays)) {
      return true;
    }
  }
  return false;
}

function buildRecentBrowsingDraft(
  input: ClientelingOpportunityProjectionInput,
): ClientelingOpportunityDraft | undefined {
  const { count, latest, eventIds } = countRecentViews(
    input.events,
    input.now,
    RECENT_ACTIVITY_WINDOW_DAYS,
  );
  if (count < 2 || !latest) return undefined;

  return {
    retailerId: input.retailerId,
    customerId: input.customerId,
    customerName: input.customerName,
    hookKind: "recent_browsing",
    projectorKey: `recent_browsing:${input.customerId}:${latest.occurredAt.slice(0, 10)}`,
    title: `${input.customerName} is browsing again`,
    whyNow: `${count} product views in the last ${RECENT_ACTIVITY_WINDOW_DAYS} days — momentum is fresh.`,
    suggestedAction: "send_message",
    suggestedChannel: "in_app_message",
    suggestedAt: input.now,
    priority: 70 + Math.min(count, 5),
    confidence: Math.min(0.55 + count * 0.05, 0.9),
    dueAt: addDays(input.now, 2),
    expiresAt: addDays(input.now, 7),
    evidence: eventIds.slice(0, 5).map((eventId) => ({ eventId })),
    projectorVersion: CLIENTELING_OPPORTUNITY_PROJECTOR_VERSION,
  };
}

function buildInterestAffinityDrafts(
  input: ClientelingOpportunityProjectionInput,
): ClientelingOpportunityDraft[] {
  const drafts: ClientelingOpportunityDraft[] = [];
  for (const insight of input.interestInsights) {
    if (insight.suppressed || insight.polarity !== "positive") continue;
    const insightKey = `${insight.scopeConceptId}:${insight.attributeConceptId}:${insight.polarity}`;
    drafts.push({
      retailerId: input.retailerId,
      customerId: input.customerId,
      customerName: input.customerName,
      hookKind: "interest_affinity",
      projectorKey: `interest_affinity:${input.customerId}:${insightKey}`,
      title: `Strong ${insight.attributeConceptLabel} interest in ${insight.scopeConceptLabel}`,
      whyNow: insight.statement,
      suggestedAction: "review_shortlist",
      suggestedChannel: "in_store",
      suggestedAt: input.now,
      priority: 75 + Math.round(insight.share * 20),
      confidence: insight.confidence,
      dueAt: addDays(input.now, 5),
      expiresAt: addDays(input.now, 14),
      evidence: [
        { insightKey },
        ...insight.evidenceEventIds.slice(0, 4).map((eventId) => ({ eventId })),
      ],
      projectorVersion: CLIENTELING_OPPORTUNITY_PROJECTOR_VERSION,
    });
  }
  return drafts;
}

function buildSignalDraft(args: {
  readonly input: ClientelingOpportunityProjectionInput;
  readonly hookKind:
    "advisor_question" | "appointment_intent" | "wishlist_signal";
  readonly eventNames: readonly BehavioralEvent["name"][];
  readonly title: string;
  readonly whyNow: string;
  readonly suggestedAction: ClientelingSuggestedAction;
  readonly suggestedChannel: ClientelingSuggestedChannel;
  readonly priority: number;
  readonly confidence: number;
}): ClientelingOpportunityDraft | undefined {
  const event = latestEvent(args.input.events, args.eventNames);
  if (
    !event ||
    !event.id ||
    !isWithinDays(event.occurredAt, args.input.now, 7)
  ) {
    return undefined;
  }
  return {
    retailerId: args.input.retailerId,
    customerId: args.input.customerId,
    customerName: args.input.customerName,
    hookKind: args.hookKind,
    projectorKey: `${args.hookKind}:${args.input.customerId}:${event.id}`,
    title: args.title,
    whyNow: args.whyNow,
    suggestedAction: args.suggestedAction,
    suggestedChannel: args.suggestedChannel,
    suggestedAt: event.occurredAt,
    priority: args.priority,
    confidence: args.confidence,
    dueAt: addDays(args.input.now, 3),
    expiresAt: addDays(args.input.now, 10),
    evidence: [{ eventId: event.id }],
    projectorVersion: CLIENTELING_OPPORTUNITY_PROJECTOR_VERSION,
  };
}

function buildDormancyDraft(
  input: ClientelingOpportunityProjectionInput,
): ClientelingOpportunityDraft | undefined {
  const usableEvents = input.events.filter((event) => !event.anonymizedAt);
  if (usableEvents.length === 0) return undefined;

  const latest = usableEvents.reduce((acc, event) =>
    parseMs(event.occurredAt) > parseMs(acc.occurredAt) ? event : acc,
  );
  if (!latest.id) return undefined;
  const idleDays = daysBetween(input.now, latest.occurredAt);
  if (idleDays < DORMANCY_THRESHOLD_DAYS) return undefined;

  return {
    retailerId: input.retailerId,
    customerId: input.customerId,
    customerName: input.customerName,
    hookKind: "dormancy",
    projectorKey: `dormancy:${input.customerId}:${Math.floor(idleDays / 30)}`,
    title: `${input.customerName} has gone quiet`,
    whyNow: `No tracked activity for ${Math.floor(idleDays)} days — a gentle check-in may reopen the conversation.`,
    suggestedAction: "send_message",
    suggestedChannel: "in_app_message",
    suggestedAt: input.now,
    priority: 40,
    confidence: 0.45,
    dueAt: addDays(input.now, 7),
    expiresAt: addDays(input.now, 21),
    evidence: [{ eventId: latest.id }],
    projectorVersion: CLIENTELING_OPPORTUNITY_PROJECTOR_VERSION,
  };
}

/**
 * Rank drafts by priority then confidence and keep only the top N per customer.
 */
export function sparseRankOpportunityDrafts(
  drafts: readonly ClientelingOpportunityDraft[],
  maxDrafts: number = DEFAULT_MAX_DRAFTS_PER_CUSTOMER,
): readonly ClientelingOpportunityDraft[] {
  return [...drafts]
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return b.confidence - a.confidence;
    })
    .slice(0, maxDrafts);
}

/**
 * Suppress drafts when contact cooldown applies or projector key already exists.
 */
export function applyContactPressureAndDedupe(args: {
  readonly drafts: readonly ClientelingOpportunityDraft[];
  readonly customerId: CustomerId;
  readonly recentContacts: readonly RecentContactRecord[];
  readonly existingProjectorKeys: readonly string[];
  readonly now: string;
  readonly cooldownDays?: number;
}): {
  readonly kept: readonly ClientelingOpportunityDraft[];
  readonly suppressedByCooldown: number;
  readonly suppressedByDuplicate: number;
} {
  const cooldownDays = args.cooldownDays ?? DEFAULT_CONTACT_COOLDOWN_DAYS;
  const onCooldown = isOnContactCooldown(
    args.customerId,
    args.recentContacts,
    args.now,
    cooldownDays,
  );
  const existing = new Set(args.existingProjectorKeys);
  const kept: ClientelingOpportunityDraft[] = [];
  let suppressedByCooldown = 0;
  let suppressedByDuplicate = 0;

  for (const draft of args.drafts) {
    if (existing.has(draft.projectorKey)) {
      suppressedByDuplicate += 1;
      continue;
    }
    if (onCooldown && draft.hookKind !== "advisor_question") {
      suppressedByCooldown += 1;
      continue;
    }
    kept.push(draft);
  }

  return { kept, suppressedByCooldown, suppressedByDuplicate };
}

/**
 * Deterministic opportunity projector for one retailer-customer relationship.
 */
export function projectClientelingOpportunityDrafts(
  input: ClientelingOpportunityProjectionInput,
): ClientelingOpportunityProjection {
  if (input.viewerRetailerId !== input.retailerId) {
    return {
      retailerId: input.retailerId,
      customerId: input.customerId,
      drafts: [],
      suppressedByCooldown: 0,
      suppressedByDuplicate: 0,
    };
  }

  const candidates: ClientelingOpportunityDraft[] = [];
  const browsing = buildRecentBrowsingDraft(input);
  if (browsing) candidates.push(browsing);
  candidates.push(...buildInterestAffinityDrafts(input));

  const advisorQuestion = buildSignalDraft({
    input,
    hookKind: "advisor_question",
    eventNames: ["advisor_question"],
    title: `${input.customerName} asked an advisor question`,
    whyNow:
      "They reached out online — continue the thread while context is warm.",
    suggestedAction: "send_message",
    suggestedChannel: "in_app_message",
    priority: 85,
    confidence: 0.8,
  });
  if (advisorQuestion) candidates.push(advisorQuestion);

  const appointmentIntent = buildSignalDraft({
    input,
    hookKind: "appointment_intent",
    eventNames: ["appointment_intent"],
    title: `${input.customerName} showed appointment intent`,
    whyNow:
      "Booking intent was recorded — offer a fitting time before momentum fades.",
    suggestedAction: "book_appointment",
    suggestedChannel: "phone",
    priority: 90,
    confidence: 0.85,
  });
  if (appointmentIntent) candidates.push(appointmentIntent);

  const wishlist = buildSignalDraft({
    input,
    hookKind: "wishlist_signal",
    eventNames: ["product_favorited"],
    title: `${input.customerName} saved a product`,
    whyNow:
      "A favourite was added — a shortlist review keeps the item top of mind.",
    suggestedAction: "review_shortlist",
    suggestedChannel: "in_app_message",
    priority: 65,
    confidence: 0.7,
  });
  if (wishlist) candidates.push(wishlist);

  const dormancy = buildDormancyDraft(input);
  if (dormancy) candidates.push(dormancy);

  const filtered = applyContactPressureAndDedupe({
    drafts: candidates,
    customerId: input.customerId,
    recentContacts: input.recentContacts,
    existingProjectorKeys: input.existingProjectorKeys,
    now: input.now,
    ...(input.cooldownDays !== undefined
      ? { cooldownDays: input.cooldownDays }
      : {}),
  });

  const drafts = sparseRankOpportunityDrafts(
    filtered.kept,
    input.maxDrafts ?? DEFAULT_MAX_DRAFTS_PER_CUSTOMER,
  );

  return {
    retailerId: input.retailerId,
    customerId: input.customerId,
    drafts,
    suppressedByCooldown: filtered.suppressedByCooldown,
    suppressedByDuplicate: filtered.suppressedByDuplicate,
  };
}

export function isOpenOpportunityStatus(
  status: ClientelingOpportunityStatus,
): boolean {
  return (
    status === "draft" || status === "assigned" || status === "in_progress"
  );
}
