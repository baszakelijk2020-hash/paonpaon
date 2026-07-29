"use server";

import { runImportEnrichmentJob } from "@paon/ai";
import { requireRetailerRole } from "@paon/auth";
import {
  AIGenerationRepository,
  CatalogueImportRepository,
  ImportEnrichmentPromptRepository,
  MetadataRepository,
  RetailerStaffRepository,
} from "@paon/database";
import {
  asId,
  buildCatalogueImportPreview,
  CatalogueImportParseError,
  DEFAULT_CATALOGUE_IMPORT_LIMITS,
  DEFAULT_IMPORT_ENRICHMENT_PROMPT_MARKDOWN,
  importEnrichmentIdempotencyKey,
  parseCatalogueImportFile,
  publishCatalogueImportRowInputSchema,
  reviewCatalogueImportTaskInputSchema,
  validateImportEnrichmentOutput,
} from "@paon/domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAIProvider } from "@/lib/ai";
import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface ImportUploadState {
  formError?: string;
  saved?: boolean;
}

export interface ImportPublishState {
  formError?: string;
  message?: string;
}

async function requireManagerSession() {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "manager");
  return session;
}

export async function previewCatalogueImport(
  _previous: ImportUploadState,
  formData: FormData,
): Promise<ImportUploadState> {
  const session = await requireManagerSession();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { formError: "Choose a CSV, XLSX, or JSON file to preview." };
  }

  if (file.size > DEFAULT_CATALOGUE_IMPORT_LIMITS.maxBytes) {
    return {
      formError: `File exceeds the ${DEFAULT_CATALOGUE_IMPORT_LIMITS.maxBytes} byte limit.`,
    };
  }

  const supabase = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  if (!staff) {
    return { formError: "Your staff profile could not be resolved." };
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const parseResult = await parseCatalogueImportFile({
      filename: file.name,
      bytes,
    });
    const imports = new CatalogueImportRepository(supabase);
    const [existing, concepts] = await Promise.all([
      imports.loadExistingCatalogue(session.retailerId),
      new MetadataRepository(supabase).findVisibleConcepts(session.retailerId),
    ]);

    const conceptIndex = new Map(
      concepts.map((concept) => [
        `${concept.kind}:${concept.canonicalName.trim().toLowerCase()}`,
        concept,
      ]),
    );
    for (const concept of concepts) {
      conceptIndex.set(`${concept.kind}:${concept.slug}`, concept);
    }

    const preview = buildCatalogueImportPreview({
      parseResult,
      sourceFilename: file.name,
      existing,
      conceptLookup: {
        findByKindAndLabel: (kind, label) => {
          const normalized = label.trim().toLowerCase();
          const byName = conceptIndex.get(`${kind}:${normalized}`);
          if (byName) {
            return { id: byName.id, slug: byName.slug };
          }
          const bySlug = conceptIndex.get(
            `${kind}:${normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`,
          );
          return bySlug ? { id: bySlug.id, slug: bySlug.slug } : null;
        },
      },
    });

    if (
      preview.fileIssues.some((issue) => issue.severity === "error") &&
      preview.rows.length === 0
    ) {
      return {
        formError:
          preview.fileIssues.find((issue) => issue.severity === "error")
            ?.message ?? "The file could not be previewed.",
      };
    }

    const saved = await imports.savePreview({
      retailerId: session.retailerId,
      uploadedByStaffId: staff.id,
      sourceFilename: preview.sourceFilename,
      sourceType: preview.sourceType,
      contractVersion: preview.contractVersion,
      rows: preview.rows.map((row) => ({
        rowNumber: row.rowNumber,
        ...(row.externalSku === undefined
          ? {}
          : { externalSku: row.externalSku }),
        rawPayload: row.rawPayload,
        ...(row.proposedProduct === undefined
          ? {}
          : { proposedProduct: row.proposedProduct }),
        validationErrors: row.validationErrors,
        status: row.status,
        reviewTasks: row.reviewTasks,
      })),
    });

    redirect(`/imports/${saved.import.id}`);
  } catch (error) {
    if (error instanceof CatalogueImportParseError) {
      return {
        formError: error.issues[0]?.message ?? error.message,
      };
    }
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof (error as { digest?: unknown }).digest === "string" &&
      (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    return {
      formError:
        error instanceof Error
          ? error.message
          : "Could not preview this import right now.",
    };
  }
}

export async function reviewImportTask(
  _previous: ImportPublishState,
  formData: FormData,
): Promise<ImportPublishState> {
  await requireManagerSession();
  const parsed = reviewCatalogueImportTaskInputSchema.safeParse({
    taskId: formData.get("taskId"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { formError: parsed.error.issues[0]?.message ?? "Invalid review." };
  }

  const importId = String(formData.get("importId") ?? "");
  const supabase = await getSupabaseServerClient();
  try {
    await new CatalogueImportRepository(supabase).reviewTask(
      asId<"MetadataReviewTaskId">(parsed.data.taskId),
      parsed.data.status,
    );
  } catch (error) {
    return {
      formError:
        error instanceof Error
          ? error.message
          : "Could not record the review decision.",
    };
  }

  revalidatePath(`/imports/${importId}`);
  return { message: `Review task marked ${parsed.data.status}.` };
}

export async function publishImportRow(
  _previous: ImportPublishState,
  formData: FormData,
): Promise<ImportPublishState> {
  await requireManagerSession();
  const parsed = publishCatalogueImportRowInputSchema.safeParse({
    importRowId: formData.get("importRowId"),
  });
  if (!parsed.success) {
    return { formError: parsed.error.issues[0]?.message ?? "Invalid row." };
  }

  const importId = String(formData.get("importId") ?? "");
  const supabase = await getSupabaseServerClient();
  try {
    const result = await new CatalogueImportRepository(supabase).publishRow(
      asId<"CatalogueImportRowId">(parsed.data.importRowId),
    );
    revalidatePath(`/imports/${importId}`);
    revalidatePath("/imports");
    revalidatePath("/products");
    if (!result.ok) {
      return { formError: result.error };
    }
    return {
      message:
        result.outcome === "already_published"
          ? "Row was already published."
          : `Row published (${result.outcome}).`,
    };
  } catch (error) {
    return {
      formError:
        error instanceof Error
          ? error.message
          : "Could not publish this import row.",
    };
  }
}

export async function publishImportReadyRows(
  _previous: ImportPublishState,
  formData: FormData,
): Promise<ImportPublishState> {
  const session = await requireManagerSession();
  const importIdRaw = String(formData.get("importId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(importIdRaw)) {
    return { formError: "Import id is required." };
  }

  const supabase = await getSupabaseServerClient();
  try {
    const { results } = await new CatalogueImportRepository(
      supabase,
    ).publishReadyRows({
      retailerId: session.retailerId,
      importId: asId<"CatalogueImportId">(importIdRaw),
    });

    revalidatePath(`/imports/${importIdRaw}`);
    revalidatePath("/imports");
    revalidatePath("/products");

    if (results.length === 0) {
      return {
        formError:
          "No reviewed valid rows are ready to publish. Resolve pending review tasks first.",
      };
    }

    const published = results.filter((item) => item.result.ok).length;
    const failed = results.length - published;
    return {
      message: `Published ${published} row${published === 1 ? "" : "s"}${
        failed > 0 ? `; ${failed} failed and remain resumable.` : "."
      }`,
      ...(failed > 0
        ? {
            formError: results
              .filter((item) => !item.result.ok)
              .map((item) =>
                item.result.ok ? "" : `Row ${item.rowId}: ${item.result.error}`,
              )
              .filter(Boolean)
              .slice(0, 3)
              .join(" "),
          }
        : {}),
    };
  } catch (error) {
    return {
      formError:
        error instanceof Error
          ? error.message
          : "Could not publish reviewed import rows.",
    };
  }
}

function supplierFactsFromRow(
  rawPayload: Readonly<Record<string, unknown>>,
  proposed?: {
    readonly mill?: string;
    readonly composition?: string;
    readonly weightGsm?: number;
    readonly construction?: string;
    readonly description?: string;
    readonly name?: string;
    readonly externalSku?: string;
    readonly supplierReference?: string;
  },
): Record<string, string> {
  const facts: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawPayload)) {
    if (typeof value === "string" && value.trim().length > 0) {
      facts[key] = value;
    }
  }
  if (proposed?.mill) facts["mill"] = proposed.mill;
  if (proposed?.composition) facts["composition"] = proposed.composition;
  if (proposed?.weightGsm !== undefined) {
    facts["weight_gsm"] = String(proposed.weightGsm);
  }
  if (proposed?.construction) facts["construction"] = proposed.construction;
  if (proposed?.supplierReference) {
    facts["supplier_reference"] = proposed.supplierReference;
  }
  if (proposed?.externalSku) facts["external_sku"] = proposed.externalSku;
  return facts;
}

/**
 * Run provider-neutral AI enrichment for unpublished import rows.
 * Every accepted proposal is stored as a pending review task — never auto-published.
 */
export async function enrichImportRows(
  _previous: ImportPublishState,
  formData: FormData,
): Promise<ImportPublishState> {
  const session = await requireManagerSession();
  const importIdRaw = String(formData.get("importId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(importIdRaw)) {
    return { formError: "Import id is required." };
  }

  const provider = getAIProvider();
  if (!provider) {
    return {
      formError:
        "AI enrichment is not configured on this deployment (missing OPENAI_API_KEY). The Admin LLM contract remains downloadable for offline use.",
    };
  }

  const supabase = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  if (!staff) {
    return { formError: "Your staff profile could not be resolved." };
  }

  const importId = asId<"CatalogueImportId">(importIdRaw);
  const imports = new CatalogueImportRepository(supabase);
  const audit = new AIGenerationRepository(supabase);

  try {
    const [job, rows, concepts, prompt] = await Promise.all([
      imports.findById(session.retailerId, importId),
      imports.findRows(session.retailerId, importId),
      new MetadataRepository(supabase).findVisibleConcepts(session.retailerId),
      new ImportEnrichmentPromptRepository(supabase).findActive(),
    ]);
    if (!job) {
      return { formError: "Import job not found." };
    }

    const systemPrompt =
      prompt?.promptMarkdown ?? DEFAULT_IMPORT_ENRICHMENT_PROMPT_MARKDOWN;
    const promptVersion = prompt?.responseSchemaVersion ?? "v1";
    const knownTaxonomy = concepts.map((concept) => ({
      kind: concept.kind,
      slug: concept.slug,
      canonicalName: concept.canonicalName,
    }));

    let createdCount = 0;
    let skippedCount = 0;
    let failedRows = 0;

    for (const row of rows) {
      if (row.status === "published" || row.status === "rejected") {
        continue;
      }

      const enrichmentInput = {
        ...(row.externalSku === undefined
          ? {}
          : { externalSku: row.externalSku }),
        ...(row.proposedProduct?.name === undefined
          ? {}
          : { name: row.proposedProduct.name }),
        ...(row.proposedProduct?.description === undefined
          ? {}
          : { description: row.proposedProduct.description }),
        supplierFacts: supplierFactsFromRow(
          row.rawPayload,
          row.proposedProduct,
        ),
      };

      const idempotencyKey = importEnrichmentIdempotencyKey({
        importRowId: row.id,
        promptVersion,
      });

      const jobResult = await runImportEnrichmentJob(provider, {
        idempotencyKey,
        systemPrompt,
        row: enrichmentInput,
        knownTaxonomy,
      });

      if (!jobResult.ok) {
        failedRows += 1;
        await audit.record({
          retailerId: session.retailerId,
          requestedByStaffId: staff.id,
          kind: "import_enrichment",
          status: "failed",
          provider: jobResult.provider,
          model: jobResult.model,
          inputSummary: `import=${importId} row=${row.id} sku=${row.externalSku ?? "n/a"}`,
          errorMessage: jobResult.errorMessage,
          latencyMs: jobResult.latencyMs,
        });
        continue;
      }

      const validated = validateImportEnrichmentOutput({
        raw: jobResult.rawOutput,
        row: enrichmentInput,
        knownTaxonomy,
      });

      if (!validated.ok && validated.proposals.length === 0) {
        failedRows += 1;
        await audit.record({
          retailerId: session.retailerId,
          requestedByStaffId: staff.id,
          kind: "import_enrichment",
          status: "failed",
          provider: jobResult.provider,
          model: jobResult.model,
          inputSummary: `import=${importId} row=${row.id} sku=${row.externalSku ?? "n/a"}`,
          output: {
            rejections: validated.rejections,
          },
          errorMessage: "Model output failed enrichment validation",
          latencyMs: jobResult.latencyMs,
        });
        continue;
      }

      const applied = await imports.applyAiEnrichmentProposals({
        retailerId: session.retailerId,
        importRowId: row.id,
        proposals: validated.proposals,
      });
      createdCount += applied.created.length;
      skippedCount += applied.skippedFieldKeys.length;

      await audit.record({
        retailerId: session.retailerId,
        requestedByStaffId: staff.id,
        kind: "import_enrichment",
        status: "succeeded",
        provider: jobResult.provider,
        model: jobResult.model,
        inputSummary: `import=${importId} row=${row.id} sku=${row.externalSku ?? "n/a"} proposals=${validated.proposals.length}`,
        output: {
          created: applied.created.length,
          skipped: applied.skippedFieldKeys,
          rejections: validated.rejections,
        },
        latencyMs: jobResult.latencyMs,
      });
    }

    revalidatePath(`/imports/${importIdRaw}`);
    revalidatePath("/ai-monitoring");

    return {
      message: `AI enrichment created ${createdCount} pending review proposal${
        createdCount === 1 ? "" : "s"
      }${skippedCount > 0 ? ` (${skippedCount} idempotent skips)` : ""}${
        failedRows > 0
          ? `; ${failedRows} row(s) failed validation or provider.`
          : "."
      }`,
    };
  } catch (error) {
    return {
      formError:
        error instanceof Error
          ? error.message
          : "Could not run AI import enrichment.",
    };
  }
}
