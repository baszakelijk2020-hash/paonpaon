/**
 * Deterministic customer-interest projector (CLI-002 / PHASE 7.1 / ADR-066).
 * Produces evidence-cited affinity statements such as
 * "8 of 10 suit views were brown" over consent-eligible events joined to
 * accepted product metadata only. Never invents facts or persists prose.
 */

import type { MetadataConceptKind } from "../metadata/metadata";
import type {
  BehavioralEventId,
  CustomerId,
  MetadataConceptId,
  ProductId,
  ProductVariantId,
  RetailerId,
} from "../shared/branded-id";
import { asId } from "../shared/branded-id";

import {
  isAdvisorVisiblePersonalizationEvent,
  type ConsentStatus,
  type CustomerConsentState,
} from "./consent";
import { excludeCorrectedEvents } from "./intelligence-correction";
import {
  buildDefaultPlatformPolicyConfig,
  evaluatePolicyEligibility,
  isPolicyAllowed,
} from "./intelligence-policy";
import type { BehavioralEvent } from "./interaction-event";

export const CUSTOMER_INTEREST_PROJECTOR_VERSION = "customer-interest-v1";

export const CUSTOMER_INTEREST_VISIBILITIES = [
  "usable",
  "consent_denied",
  "consent_withdrawn",
  "consent_missing",
] as const;

export type CustomerInterestVisibility =
  (typeof CUSTOMER_INTEREST_VISIBILITIES)[number];

/** Garment/scope kinds used as the denominator group. */
export const INTEREST_SCOPE_KINDS = [
  "garment_type",
] as const satisfies readonly MetadataConceptKind[];

export type InterestScopeKind = (typeof INTEREST_SCOPE_KINDS)[number];

/** Attribute kinds counted inside a scope (colour within suits, etc.). */
export const INTEREST_ATTRIBUTE_KINDS = [
  "colour",
  "pattern",
  "fibre",
  "weave",
  "season",
  "style",
  "occasion",
  "formality",
] as const satisfies readonly MetadataConceptKind[];

export type InterestAttributeKind = (typeof INTEREST_ATTRIBUTE_KINDS)[number];

export const POSITIVE_INTEREST_EVENT_NAMES = [
  "product_viewed",
  "product_favorited",
] as const;

export const NEGATIVE_INTEREST_EVENT_NAMES = ["product_skipped"] as const;

export const DEFAULT_INTEREST_WINDOW_DAYS = 30;
/** Minimum unique products in scope before a ratio insight is shown. */
export const DEFAULT_MIN_SCOPE_UNIQUE_PRODUCTS = 5;
export const DEFAULT_MAX_INTEREST_INSIGHTS = 5;

export type InterestEvidencePolarity = "positive" | "negative";

export interface AcceptedProductConcept {
  readonly conceptId: MetadataConceptId;
  readonly kind: MetadataConceptKind;
  readonly label: string;
}

/**
 * Accepted metadata for one product (and optional variant overlay). Pending
 * and rejected assignments must never appear here.
 */
export interface InterestProductMetadata {
  readonly productId: ProductId;
  readonly concepts: readonly AcceptedProductConcept[];
}

export interface CustomerInterestInsight {
  readonly scopeConceptId: MetadataConceptId;
  readonly scopeConceptLabel: string;
  readonly scopeKind: InterestScopeKind;
  readonly attributeConceptId: MetadataConceptId;
  readonly attributeConceptLabel: string;
  readonly attributeKind: InterestAttributeKind;
  readonly polarity: InterestEvidencePolarity;
  /** Unique products in scope that carry the attribute. */
  readonly numerator: number;
  /** Unique products in scope. */
  readonly denominator: number;
  readonly share: number;
  readonly eventCount: number;
  readonly uniqueProductCount: number;
  /**
   * Session counts require 7.2 session IDs. Represent as null rather than
   * inventing values from current event rows.
   */
  readonly sessionCount: number | null;
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly latestEvidenceAt: string;
  readonly confidence: number;
  readonly suppressed: boolean;
  readonly suppressReason?: "low_sample";
  readonly evidenceEventIds: readonly BehavioralEventId[];
  readonly projectorVersion: string;
  readonly statement: string;
}

export interface CustomerInterestProjection {
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly visibility: CustomerInterestVisibility;
  readonly generatedAt: string;
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly projectorVersion: string;
  readonly insights: readonly CustomerInterestInsight[];
  /** Insights that were computed but suppressed (e.g. low sample). */
  readonly suppressedInsights: readonly CustomerInterestInsight[];
  readonly emptyStateCopy: string;
}

export interface CustomerInterestProjectionInput {
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  /** Must equal retailerId; cross-tenant fails closed. */
  readonly viewerRetailerId: RetailerId;
  readonly now: string;
  readonly consent: CustomerConsentState;
  readonly events: readonly BehavioralEvent[];
  /**
   * Accepted product/variant concepts keyed by product id. Variant-only
   * accepted concepts should already be folded onto the product by the
   * repository.
   */
  readonly productMetadata: ReadonlyMap<string, InterestProductMetadata>;
  readonly windowDays?: number;
  readonly minScopeUniqueProducts?: number;
  readonly maxInsights?: number;
  /** Event ids removed by correction/deletion replay (7.8). */
  readonly excludedEventIds?: readonly BehavioralEventId[];
}

function isScopeKind(kind: MetadataConceptKind): kind is InterestScopeKind {
  return (INTEREST_SCOPE_KINDS as readonly string[]).includes(kind);
}

function isAttributeKind(
  kind: MetadataConceptKind,
): kind is InterestAttributeKind {
  return (INTEREST_ATTRIBUTE_KINDS as readonly string[]).includes(kind);
}

export function resolveCustomerInterestVisibility(
  personalization: ConsentStatus,
): CustomerInterestVisibility {
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

export function mayProjectCustomerInterest(args: {
  readonly retailerId: RetailerId;
  readonly viewerRetailerId: RetailerId;
  readonly consentRetailerId: RetailerId;
  readonly consentCustomerId: CustomerId;
  readonly customerId: CustomerId;
}): boolean {
  return (
    args.retailerId === args.viewerRetailerId &&
    args.consentRetailerId === args.retailerId &&
    args.consentCustomerId === args.customerId
  );
}

export function interestEmptyStateCopy(
  visibility: CustomerInterestVisibility,
): string {
  switch (visibility) {
    case "usable":
      return "Not enough consented catalogue activity yet to cite a recent interest.";
    case "consent_withdrawn":
      return "Personalization withdrawn — recent interest citations are hidden.";
    case "consent_denied":
      return "Personalization is not opted in — no cited interests to show.";
    case "consent_missing":
      return "Consent unavailable — no cited interests to show.";
    default: {
      const _exhaustive: never = visibility;
      return _exhaustive;
    }
  }
}

function windowStartIso(now: string, windowDays: number): string {
  const end = Date.parse(now);
  return new Date(end - windowDays * 24 * 60 * 60 * 1000).toISOString();
}

function asUuid(value: unknown): string | null {
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

export function productIdFromEventProperties(
  properties: Readonly<Record<string, unknown>>,
): ProductId | null {
  const productId = asUuid(properties.productId);
  return productId ? asId<"ProductId">(productId) : null;
}

export function productVariantIdFromEventProperties(
  properties: Readonly<Record<string, unknown>>,
): ProductVariantId | null {
  const variantId = asUuid(properties.productVariantId);
  return variantId ? asId<"ProductVariantId">(variantId) : null;
}

/**
 * Stable dedupe key for retries. Prefer explicit idempotencyKey, then event
 * id, then a composite of name/product/occurredAt.
 */
export function interestEventDedupeKey(event: BehavioralEvent): string {
  if (event.idempotencyKey && event.idempotencyKey.trim().length > 0) {
    return `idempotency:${event.idempotencyKey.trim()}`;
  }
  const key = event.properties.idempotencyKey;
  if (typeof key === "string" && key.trim().length > 0) {
    return `idempotency:${key.trim()}`;
  }
  if (event.id) {
    return `id:${event.id}`;
  }
  const productId = productIdFromEventProperties(event.properties) ?? "none";
  return `composite:${event.name}:${productId}:${event.occurredAt}`;
}

function isPositiveEventName(name: string): boolean {
  return (POSITIVE_INTEREST_EVENT_NAMES as readonly string[]).includes(name);
}

function isNegativeEventName(name: string): boolean {
  return (NEGATIVE_INTEREST_EVENT_NAMES as readonly string[]).includes(name);
}

function emptyProjection(
  input: CustomerInterestProjectionInput,
  visibility: CustomerInterestVisibility,
  windowStart: string,
): CustomerInterestProjection {
  return {
    retailerId: input.retailerId,
    customerId: input.customerId,
    visibility,
    generatedAt: input.now,
    windowStart,
    windowEnd: input.now,
    projectorVersion: CUSTOMER_INTEREST_PROJECTOR_VERSION,
    insights: [],
    suppressedInsights: [],
    emptyStateCopy: interestEmptyStateCopy(visibility),
  };
}

function eligibleEvents(
  input: CustomerInterestProjectionInput,
  windowStart: string,
): BehavioralEvent[] {
  const seen = new Set<string>();
  const out: BehavioralEvent[] = [];

  const sorted = [...input.events].sort((a, b) => {
    const byTime = Date.parse(b.occurredAt) - Date.parse(a.occurredAt);
    if (byTime !== 0) return byTime;
    return interestEventDedupeKey(a).localeCompare(interestEventDedupeKey(b));
  });

  for (const event of sorted) {
    if (
      !isAdvisorVisiblePersonalizationEvent({
        eventRetailerId: event.retailerId,
        advisorRetailerId: input.viewerRetailerId,
        ...(event.customerId ? { customerId: event.customerId } : {}),
        anonymizedAt: event.anonymizedAt ?? null,
        retentionExpiresAt: event.retentionExpiresAt,
        now: input.now,
        personalizationConsent: input.consent.personalization.status,
      })
    ) {
      continue;
    }
    if (event.customerId !== input.customerId) continue;
    if (Date.parse(event.occurredAt) < Date.parse(windowStart)) continue;
    if (!isPositiveEventName(event.name) && !isNegativeEventName(event.name)) {
      continue;
    }

    const dedupeKey = interestEventDedupeKey(event);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push(event);
  }

  return out;
}

interface ScopeBucket {
  readonly scope: AcceptedProductConcept;
  readonly attribute: AcceptedProductConcept;
  readonly polarity: InterestEvidencePolarity;
  readonly productIds: Set<string>;
  readonly eventIds: BehavioralEventId[];
  readonly sessionIds: Set<string>;
  latestEvidenceAt: string;
}

function bucketKey(
  polarity: InterestEvidencePolarity,
  scopeId: string,
  attributeId: string,
): string {
  return `${polarity}:${scopeId}:${attributeId}`;
}

function confidenceForShare(args: {
  readonly numerator: number;
  readonly denominator: number;
  readonly eventCount: number;
}): number {
  if (args.denominator <= 0) return 0;
  const share = args.numerator / args.denominator;
  const sampleFactor = Math.min(1, args.denominator / 10);
  const evidenceFactor = Math.min(1, args.eventCount / args.denominator);
  return Math.round(share * sampleFactor * evidenceFactor * 1000) / 1000;
}

export function formatCustomerInterestStatement(args: {
  readonly numerator: number;
  readonly denominator: number;
  readonly scopeLabel: string;
  readonly attributeLabel: string;
  readonly polarity: InterestEvidencePolarity;
}): string {
  const scope = args.scopeLabel.toLowerCase();
  const attribute = args.attributeLabel.toLowerCase();
  if (args.polarity === "negative") {
    return `${args.numerator} of ${args.denominator} ${scope} skips were ${attribute}`;
  }
  return `${args.numerator} of ${args.denominator} ${scope} views were ${attribute}`;
}

/**
 * Pure projector. Repository supplies accepted metadata and consent-eligible
 * event rows; this function never queries storage.
 */
export function projectCustomerInterestInsights(
  input: CustomerInterestProjectionInput,
): CustomerInterestProjection {
  const windowDays = input.windowDays ?? DEFAULT_INTEREST_WINDOW_DAYS;
  const minSample =
    input.minScopeUniqueProducts ?? DEFAULT_MIN_SCOPE_UNIQUE_PRODUCTS;
  const maxInsights = input.maxInsights ?? DEFAULT_MAX_INTEREST_INSIGHTS;
  const windowStart = windowStartIso(input.now, windowDays);

  if (
    !mayProjectCustomerInterest({
      retailerId: input.retailerId,
      viewerRetailerId: input.viewerRetailerId,
      consentRetailerId: input.consent.retailerId,
      consentCustomerId: input.consent.customerId,
      customerId: input.customerId,
    })
  ) {
    return emptyProjection(input, "consent_denied", windowStart);
  }

  const visibility = resolveCustomerInterestVisibility(
    input.consent.personalization.status,
  );
  if (visibility !== "usable") {
    return emptyProjection(input, visibility, windowStart);
  }

  const projectionPolicy = evaluatePolicyEligibility({
    plane: "projection",
    purpose: "personalization",
    config: buildDefaultPlatformPolicyConfig({ now: input.now }),
    consent: input.consent,
  });
  if (!isPolicyAllowed(projectionPolicy)) {
    return emptyProjection(input, "consent_denied", windowStart);
  }

  const excluded = new Set(input.excludedEventIds ?? []);
  const events = excludeCorrectedEvents(
    eligibleEvents(input, windowStart),
    excluded,
  );
  const scopeProductCounts = new Map<string, Set<string>>();
  const buckets = new Map<string, ScopeBucket>();

  for (const event of events) {
    const productId = productIdFromEventProperties(event.properties);
    if (!productId) continue;
    const metadata = input.productMetadata.get(productId);
    if (!metadata) continue;

    const polarity: InterestEvidencePolarity = isNegativeEventName(event.name)
      ? "negative"
      : "positive";

    const scopes = metadata.concepts.filter((concept) =>
      isScopeKind(concept.kind),
    );
    const attributes = metadata.concepts.filter((concept) =>
      isAttributeKind(concept.kind),
    );
    if (scopes.length === 0) continue;

    const eventId =
      event.id ??
      asId<"BehavioralEventId">("00000000-0000-4000-8000-000000000000");

    for (const scope of scopes) {
      if (!isScopeKind(scope.kind)) continue;
      const scopeCountKey = `${polarity}:${scope.conceptId}`;
      const products =
        scopeProductCounts.get(scopeCountKey) ?? new Set<string>();
      products.add(productId);
      scopeProductCounts.set(scopeCountKey, products);

      for (const attribute of attributes) {
        if (!isAttributeKind(attribute.kind)) continue;
        const key = bucketKey(polarity, scope.conceptId, attribute.conceptId);
        const existing = buckets.get(key);
        if (existing) {
          existing.productIds.add(productId);
          existing.eventIds.push(eventId);
          if (event.sessionId) existing.sessionIds.add(event.sessionId);
          if (
            Date.parse(event.occurredAt) > Date.parse(existing.latestEvidenceAt)
          ) {
            existing.latestEvidenceAt = event.occurredAt;
          }
        } else {
          buckets.set(key, {
            scope,
            attribute,
            polarity,
            productIds: new Set([productId]),
            eventIds: [eventId],
            sessionIds: new Set(event.sessionId ? [event.sessionId] : []),
            latestEvidenceAt: event.occurredAt,
          });
        }
      }
    }
  }

  const allInsights: CustomerInterestInsight[] = [];

  for (const bucket of buckets.values()) {
    if (!isScopeKind(bucket.scope.kind)) continue;
    if (!isAttributeKind(bucket.attribute.kind)) continue;

    const denominator =
      scopeProductCounts.get(`${bucket.polarity}:${bucket.scope.conceptId}`)
        ?.size ?? 0;
    const numerator = bucket.productIds.size;
    if (denominator <= 0 || numerator <= 0) continue;

    const share = Math.round((numerator / denominator) * 1000) / 1000;
    const eventCount = bucket.eventIds.length;
    const suppressed = denominator < minSample;
    const uniqueIds = [...new Set(bucket.eventIds)];

    allInsights.push({
      scopeConceptId: bucket.scope.conceptId,
      scopeConceptLabel: bucket.scope.label,
      scopeKind: bucket.scope.kind,
      attributeConceptId: bucket.attribute.conceptId,
      attributeConceptLabel: bucket.attribute.label,
      attributeKind: bucket.attribute.kind,
      polarity: bucket.polarity,
      numerator,
      denominator,
      share,
      eventCount,
      uniqueProductCount: numerator,
      sessionCount: bucket.sessionIds.size > 0 ? bucket.sessionIds.size : null,
      windowStart,
      windowEnd: input.now,
      latestEvidenceAt: bucket.latestEvidenceAt,
      confidence: confidenceForShare({
        numerator,
        denominator,
        eventCount,
      }),
      suppressed,
      ...(suppressed ? { suppressReason: "low_sample" as const } : {}),
      evidenceEventIds: uniqueIds,
      projectorVersion: CUSTOMER_INTEREST_PROJECTOR_VERSION,
      statement: formatCustomerInterestStatement({
        numerator,
        denominator,
        scopeLabel: bucket.scope.label,
        attributeLabel: bucket.attribute.label,
        polarity: bucket.polarity,
      }),
    });
  }

  allInsights.sort((a, b) => {
    if (a.suppressed !== b.suppressed) return a.suppressed ? 1 : -1;
    if (b.share !== a.share) return b.share - a.share;
    if (b.denominator !== a.denominator) return b.denominator - a.denominator;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    const byLatest =
      Date.parse(b.latestEvidenceAt) - Date.parse(a.latestEvidenceAt);
    if (byLatest !== 0) return byLatest;
    return `${a.scopeConceptId}:${a.attributeConceptId}`.localeCompare(
      `${b.scopeConceptId}:${b.attributeConceptId}`,
    );
  });

  const insights = allInsights
    .filter((insight) => !insight.suppressed)
    .slice(0, maxInsights);
  const suppressedInsights = allInsights.filter(
    (insight) => insight.suppressed,
  );

  return {
    retailerId: input.retailerId,
    customerId: input.customerId,
    visibility,
    generatedAt: input.now,
    windowStart,
    windowEnd: input.now,
    projectorVersion: CUSTOMER_INTEREST_PROJECTOR_VERSION,
    insights,
    suppressedInsights,
    emptyStateCopy: interestEmptyStateCopy(visibility),
  };
}
