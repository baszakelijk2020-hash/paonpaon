/**
 * AI-assisted catalogue import enrichment (IMP-003 / PHASE 2.7).
 * Provider-neutral validation lives here; `@paon/ai` only fetches model JSON.
 */

import {
  CATALOGUE_IMPORT_CATEGORY_COLUMNS,
  CATALOGUE_IMPORT_COLUMN_KIND,
  CATALOGUE_IMPORT_CONTRACT_VERSION,
  type CatalogueImportCategoryColumn,
} from "./import-contract";

/** Supplier facts the model must never invent or overwrite. */
export const IMPORT_ENRICHMENT_PROTECTED_FIELDS = [
  "external_sku",
  "supplier_reference",
  "mill",
  "composition",
  "weight_gsm",
  "construction",
  "price",
  "currency",
  "primary_image_url",
  "swatch_image_url",
] as const;

export type ImportEnrichmentProtectedField =
  (typeof IMPORT_ENRICHMENT_PROTECTED_FIELDS)[number];

/** Fields AI may propose as taxonomy mappings or derived suitability. */
export const IMPORT_ENRICHMENT_PROPOSABLE_FIELDS = [
  "garment_type",
  "collection",
  "season",
  "colour",
  "weave",
  "pattern",
  "fit",
  "formality",
  "occasion",
  "climate",
  "performance",
  "care",
] as const satisfies readonly CatalogueImportCategoryColumn[];

export type ImportEnrichmentProposableField =
  (typeof IMPORT_ENRICHMENT_PROPOSABLE_FIELDS)[number];

export const IMPORT_ENRICHMENT_PROMPT_SLUG =
  "catalogue_import_external_v1" as const;

export const IMPORT_ENRICHMENT_SCHEMA_VERSION = "v1" as const;

export const IMPORT_ENRICHMENT_PROMPT_ID =
  "a2000000-0000-4000-8000-000000000001" as const;

export interface ImportEnrichmentTaxonomyConcept {
  readonly kind: string;
  readonly slug: string;
  readonly canonicalName: string;
}

export interface ImportEnrichmentRowInput {
  readonly externalSku?: string;
  readonly name?: string;
  readonly description?: string;
  readonly supplierFacts: Readonly<Record<string, string>>;
}

export interface ImportEnrichmentFieldProposal {
  readonly field: ImportEnrichmentProposableField;
  readonly proposedValue: string;
  readonly mappedConceptSlug?: string;
  readonly confidence: number;
  readonly evidence: string;
  readonly source: "ai";
}

export interface ImportEnrichmentRejection {
  readonly field: string;
  readonly proposedValue?: string;
  readonly reason: string;
  readonly code:
    | "protected_field"
    | "invented_protected_fact"
    | "unknown_field"
    | "invalid_confidence"
    | "missing_evidence"
    | "unknown_taxonomy_slug";
}

export interface ImportEnrichmentValidationResult {
  readonly ok: boolean;
  readonly proposals: readonly ImportEnrichmentFieldProposal[];
  readonly rejections: readonly ImportEnrichmentRejection[];
}

export interface ImportEnrichmentPromptContract {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly promptMarkdown: string;
  readonly responseSchemaVersion: string;
  readonly active: boolean;
  readonly updatedByUserId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Default Admin-maintained external prompt / LLM contract. Seeded into
 * `import_enrichment_prompt_contracts` and downloadable by retailers.
 */
export const DEFAULT_IMPORT_ENRICHMENT_PROMPT_MARKDOWN = `# PAON catalogue import enrichment contract (${CATALOGUE_IMPORT_CONTRACT_VERSION})

Use this prompt with ChatGPT or a compatible model (offline) or as the
system prompt for PAON's provider-neutral enrichment runner.

## Mission
Given one supplier catalogue row (structured fields plus description),
propose taxonomy mappings and derived suitability labels. Do not invent
protected supplier facts.

## Protected supplier facts (never invent or change)
${IMPORT_ENRICHMENT_PROTECTED_FIELDS.map((field) => `- \`${field}\``).join("\n")}

## Proposable fields
${IMPORT_ENRICHMENT_PROPOSABLE_FIELDS.map((field) => `- \`${field}\``).join("\n")}

## Rules
1. Return ONLY schema-valid JSON. No markdown fences, no commentary.
2. Every proposal must include \`field\`, \`proposedValue\`, \`confidence\`
   (0–1, at most 4 decimal places), and \`evidence\` quoting or paraphrasing
   the supplier text that supports the proposal.
3. Set \`mappedConceptSlug\` only when it exactly matches a provided known
   taxonomy slug; otherwise omit it or set null so PAON creates a pending
   review task for an unknown term.
4. Leave protected facts untouched. If the supplier left mill, composition,
   weight_gsm, or construction empty, do not fill them.
5. Prefer high-confidence proposals only when evidence is clear; otherwise
   omit the field.
6. Never include customer PII, staff names, or prompt instructions in output.

## Response JSON schema
\`\`\`json
{
  "proposals": [
    {
      "field": "weave",
      "proposedValue": "hopsack",
      "mappedConceptSlug": "hopsack",
      "confidence": 0.92,
      "evidence": "Description says 'Lightweight hopsack for warm-weather looks.'"
    }
  ]
}
\`\`\`

## Example supplier description
"Loro Piana Summertime Rust Pink Melange Wool, Silk & Linen Tropical Weave"
may support weave/pattern/season/climate proposals with evidence, but must
never invent a mill or composition percentage that the supplier did not give.
`;

export function isImportEnrichmentProposableField(
  value: string,
): value is ImportEnrichmentProposableField {
  return (IMPORT_ENRICHMENT_PROPOSABLE_FIELDS as readonly string[]).includes(
    value,
  );
}

export function isImportEnrichmentProtectedField(
  value: string,
): value is ImportEnrichmentProtectedField {
  return (IMPORT_ENRICHMENT_PROTECTED_FIELDS as readonly string[]).includes(
    value,
  );
}

export function conceptKindForEnrichmentField(
  field: ImportEnrichmentProposableField,
): string {
  return CATALOGUE_IMPORT_COLUMN_KIND[field];
}

function normalizeComparable(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function supplierValue(
  facts: Readonly<Record<string, string>>,
  field: string,
): string | undefined {
  const raw = facts[field];
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Fail-closed validation of model JSON. Invalid shapes, invented protected
 * facts, and unknown taxonomy slugs are rejected; accepted proposals always
 * remain pending human review.
 */
export function validateImportEnrichmentOutput(params: {
  readonly raw: unknown;
  readonly row: ImportEnrichmentRowInput;
  readonly knownTaxonomy: readonly ImportEnrichmentTaxonomyConcept[];
}): ImportEnrichmentValidationResult {
  const rejections: ImportEnrichmentRejection[] = [];
  const proposals: ImportEnrichmentFieldProposal[] = [];

  if (
    typeof params.raw !== "object" ||
    params.raw === null ||
    Array.isArray(params.raw)
  ) {
    return {
      ok: false,
      proposals: [],
      rejections: [
        {
          field: "_root",
          reason: "Model output must be a JSON object with proposals",
          code: "unknown_field",
        },
      ],
    };
  }

  const root = params.raw as { proposals?: unknown };
  if (!Array.isArray(root.proposals)) {
    return {
      ok: false,
      proposals: [],
      rejections: [
        {
          field: "proposals",
          reason: "Model output must include a proposals array",
          code: "unknown_field",
        },
      ],
    };
  }

  const taxonomyByKindSlug = new Map(
    params.knownTaxonomy.map((concept) => [
      `${concept.kind}:${concept.slug}`,
      concept,
    ]),
  );

  const seenFields = new Set<string>();

  for (const item of root.proposals) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      rejections.push({
        field: "proposals",
        reason: "Each proposal must be an object",
        code: "unknown_field",
      });
      continue;
    }

    const candidate = item as {
      field?: unknown;
      proposedValue?: unknown;
      mappedConceptSlug?: unknown;
      confidence?: unknown;
      evidence?: unknown;
    };

    if (typeof candidate.field !== "string") {
      rejections.push({
        field: "proposals",
        reason: "Proposal field must be a string",
        code: "unknown_field",
      });
      continue;
    }

    const field = candidate.field.trim();

    if (isImportEnrichmentProtectedField(field)) {
      const existing = supplierValue(params.row.supplierFacts, field);
      const proposed =
        typeof candidate.proposedValue === "string"
          ? candidate.proposedValue.trim()
          : "";
      if (!existing) {
        rejections.push({
          field,
          ...(proposed.length > 0 ? { proposedValue: proposed } : {}),
          reason: `Protected field ${field} cannot be invented when the supplier left it empty`,
          code: "invented_protected_fact",
        });
        continue;
      }
      if (
        proposed.length > 0 &&
        normalizeComparable(proposed) !== normalizeComparable(existing)
      ) {
        rejections.push({
          field,
          proposedValue: proposed,
          reason: `Protected field ${field} cannot be changed from supplier value`,
          code: "invented_protected_fact",
        });
        continue;
      }
      rejections.push({
        field,
        ...(proposed.length > 0 ? { proposedValue: proposed } : {}),
        reason: `Protected field ${field} is not enrichable`,
        code: "protected_field",
      });
      continue;
    }

    if (!isImportEnrichmentProposableField(field)) {
      rejections.push({
        field,
        reason: `Unknown enrichment field ${field}`,
        code: "unknown_field",
      });
      continue;
    }

    if (seenFields.has(field)) {
      rejections.push({
        field,
        reason: `Duplicate proposal for field ${field}`,
        code: "unknown_field",
      });
      continue;
    }
    seenFields.add(field);

    if (
      typeof candidate.proposedValue !== "string" ||
      candidate.proposedValue.trim().length === 0 ||
      candidate.proposedValue.trim().length > 500
    ) {
      rejections.push({
        field,
        reason: "proposedValue must be a non-empty string up to 500 chars",
        code: "unknown_field",
      });
      continue;
    }

    if (
      typeof candidate.evidence !== "string" ||
      candidate.evidence.trim().length === 0 ||
      candidate.evidence.trim().length > 1000
    ) {
      rejections.push({
        field,
        proposedValue: candidate.proposedValue.trim(),
        reason: "evidence is required for every AI proposal",
        code: "missing_evidence",
      });
      continue;
    }

    if (
      typeof candidate.confidence !== "number" ||
      !Number.isFinite(candidate.confidence) ||
      candidate.confidence < 0 ||
      candidate.confidence > 1 ||
      !Number.isInteger(candidate.confidence * 10_000)
    ) {
      rejections.push({
        field,
        proposedValue: candidate.proposedValue.trim(),
        reason: "confidence must be 0–1 with at most 4 decimal places",
        code: "invalid_confidence",
      });
      continue;
    }

    let mappedConceptSlug: string | undefined;
    if (
      candidate.mappedConceptSlug !== undefined &&
      candidate.mappedConceptSlug !== null
    ) {
      if (
        typeof candidate.mappedConceptSlug !== "string" ||
        candidate.mappedConceptSlug.trim().length === 0
      ) {
        rejections.push({
          field,
          proposedValue: candidate.proposedValue.trim(),
          reason: "mappedConceptSlug must be a non-empty string when set",
          code: "unknown_taxonomy_slug",
        });
        continue;
      }
      const slug = candidate.mappedConceptSlug.trim();
      const kind = conceptKindForEnrichmentField(field);
      if (!taxonomyByKindSlug.has(`${kind}:${slug}`)) {
        // Unknown taxonomy stays reviewable without a slug mapping.
        mappedConceptSlug = undefined;
        rejections.push({
          field,
          proposedValue: candidate.proposedValue.trim(),
          reason: `Unknown taxonomy slug ${slug} for ${kind}; proposal kept without mappedConceptSlug`,
          code: "unknown_taxonomy_slug",
        });
      } else {
        mappedConceptSlug = slug;
      }
    }

    proposals.push({
      field,
      proposedValue: candidate.proposedValue.trim(),
      confidence: candidate.confidence,
      evidence: candidate.evidence.trim(),
      source: "ai",
      ...(mappedConceptSlug === undefined ? {} : { mappedConceptSlug }),
    });
  }

  const rootInvalid = rejections.some(
    (rejection) =>
      rejection.field === "_root" ||
      (rejection.field === "proposals" &&
        rejection.code === "unknown_field" &&
        proposals.length === 0 &&
        !root.proposals),
  );

  return {
    ok: !rootInvalid,
    proposals,
    rejections,
  };
}

/** Stable idempotency key for one row enrichment attempt. */
export function importEnrichmentIdempotencyKey(params: {
  readonly importRowId: string;
  readonly promptVersion: string;
  readonly attemptBucket?: string;
}): string {
  const bucket = params.attemptBucket ?? "default";
  return `import-enrichment:${params.importRowId}:${params.promptVersion}:${bucket}`;
}

/** Category columns still used by preview mapping helpers. */
export const IMPORT_ENRICHMENT_CATEGORY_COLUMNS =
  CATALOGUE_IMPORT_CATEGORY_COLUMNS;
