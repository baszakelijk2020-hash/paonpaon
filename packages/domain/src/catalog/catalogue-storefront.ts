/**
 * Narrow storefront enrichment helpers for founder filter parity.
 * Heuristic color/pattern/season values remain the fallback until
 * accepted assignments are present (PHASE 2.4 / ADR-052).
 */

import type { MetadataConcept } from "../metadata/metadata";
import type { MetadataConceptId } from "../shared/branded-id";

import {
  isCatalogueFacetKind,
  type CatalogueFacetKind,
} from "./catalogue-query";

const FOUNDER_COLORS = new Set([
  "navy",
  "grey",
  "gray",
  "brown",
  "beige",
  "blue",
  "black",
  "green",
]);

const FOUNDER_PATTERNS = new Set([
  "plain",
  "herringbone",
  "twill",
  "glencheck",
  "houndstooth",
  "melange",
  "sharkskin",
  "basketweave",
  "windowpane",
  "cable",
]);

const FOUNDER_SEASONS = new Set([
  "spring-summer",
  "autumn-winter",
  "all-season",
]);

export interface StorefrontCatalogueFacetFields {
  readonly conceptIds: readonly MetadataConceptId[];
  readonly facets: Readonly<
    Partial<Record<CatalogueFacetKind, readonly string[]>>
  >;
  /** Prefer over heuristic when set — founder filter panel value. */
  readonly color?: string;
  readonly pattern?: string;
  readonly season?: string;
  readonly mill?: string;
  readonly weave?: string;
  readonly weightGsm?: number;
}

function normalizeFounderSlug(slug: string): string {
  const lower = slug.toLowerCase();
  if (lower === "gray") {
    return "grey";
  }
  if (lower === "ss" || lower === "spring" || lower === "summer") {
    return "spring-summer";
  }
  if (
    lower === "aw" ||
    lower === "autumn" ||
    lower === "winter" ||
    lower === "fall"
  ) {
    return "autumn-winter";
  }
  return lower;
}

function firstFounderValue(
  slugs: readonly string[],
  allowed: ReadonlySet<string>,
): string | undefined {
  for (const slug of slugs) {
    const normalized = normalizeFounderSlug(slug);
    if (allowed.has(normalized)) {
      return normalized === "gray" ? "grey" : normalized;
    }
  }
  return undefined;
}

/**
 * Project accepted product concepts into founder-compatible filter fields.
 * Does not invent values when no accepted concept maps to the panel vocabulary.
 */
export function projectStorefrontCatalogueFacets(
  concepts: readonly MetadataConcept[],
  weightGsm?: number | null,
): StorefrontCatalogueFacetFields {
  const active = concepts.filter((c) => c.active);
  const facets: Partial<Record<CatalogueFacetKind, string[]>> = {};
  for (const concept of active) {
    if (!isCatalogueFacetKind(concept.kind)) {
      continue;
    }
    const bucket = facets[concept.kind] ?? [];
    bucket.push(concept.slug);
    facets[concept.kind] = bucket;
  }

  const color = firstFounderValue(facets.colour ?? [], FOUNDER_COLORS);
  const pattern = firstFounderValue(facets.pattern ?? [], FOUNDER_PATTERNS);
  const season = firstFounderValue(facets.season ?? [], FOUNDER_SEASONS);

  return {
    conceptIds: active.map((c) => c.id),
    facets,
    ...(color !== undefined ? { color } : {}),
    ...(pattern !== undefined ? { pattern } : {}),
    ...(season !== undefined ? { season } : {}),
    ...(facets.mill?.[0] !== undefined ? { mill: facets.mill[0] } : {}),
    ...(facets.weave?.[0] !== undefined ? { weave: facets.weave[0] } : {}),
    ...(weightGsm !== undefined && weightGsm !== null ? { weightGsm } : {}),
  };
}
