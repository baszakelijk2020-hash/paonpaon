import {
  validateEnrichmentProposal,
  type CatalogueImportEnrichmentProposalParsed,
  type CatalogueImportEnrichmentTaxonomyLookup,
} from "@paon/domain";

import type { AIProvider, CatalogueImportEnrichmentContext } from "./provider";

export interface RunCatalogueImportEnrichmentParams {
  readonly provider: AIProvider;
  readonly context: CatalogueImportEnrichmentContext;
  readonly supplierRow: Readonly<Record<string, string>>;
  readonly taxonomy: CatalogueImportEnrichmentTaxonomyLookup;
}

export type RunCatalogueImportEnrichmentResult =
  | {
      readonly ok: true;
      readonly proposal: CatalogueImportEnrichmentProposalParsed;
      readonly provider: string;
      readonly model: string;
    }
  | {
      readonly ok: false;
      readonly code: "provider_error" | "validation_failed";
      readonly error: string;
      readonly issues?: readonly { readonly message: string }[];
    };

/**
 * Provider-neutral enrichment runner: call the model, validate against
 * supplier facts and taxonomy, and fail closed on invented protected facts.
 */
export async function runCatalogueImportEnrichment(
  params: RunCatalogueImportEnrichmentParams,
): Promise<RunCatalogueImportEnrichmentResult> {
  let raw: Record<string, unknown>;
  try {
    const response = await params.provider.enrichCatalogueImportRow(
      params.context,
    );
    raw = response.proposal;
  } catch (error) {
    return {
      ok: false,
      code: "provider_error",
      error: error instanceof Error ? error.message : "Enrichment failed",
    };
  }

  const validated = validateEnrichmentProposal({
    raw,
    supplierRow: params.supplierRow,
    taxonomy: params.taxonomy,
  });
  if (!validated.ok) {
    return {
      ok: false,
      code: "validation_failed",
      error: validated.issues[0]?.message ?? "Enrichment validation failed",
      issues: validated.issues,
    };
  }

  return {
    ok: true,
    proposal: validated.proposal,
    provider: params.provider.providerName,
    model: params.provider.model,
  };
}
