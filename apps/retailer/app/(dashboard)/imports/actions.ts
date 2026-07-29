"use server";

import { requireRetailerRole } from "@paon/auth";
import {
  CatalogueImportRepository,
  MetadataRepository,
  RetailerStaffRepository,
} from "@paon/database";
import {
  buildCatalogueImportPreview,
  CatalogueImportParseError,
  DEFAULT_CATALOGUE_IMPORT_LIMITS,
  parseCatalogueImportFile,
} from "@paon/domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface ImportUploadState {
  formError?: string;
  saved?: boolean;
}

export interface ImportActionState {
  formError?: string;
  saved?: boolean;
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

export async function dismissImportReviewTaskAction(
  _previous: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  const importId = String(formData.get("importId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  const session = await requireManagerSession();
  const repository = new CatalogueImportRepository(
    await getSupabaseServerClient(),
  );

  try {
    await repository.reviewMetadataTask({
      retailerId: session.retailerId,
      taskId: taskId as never,
      status: "dismissed",
    });
    revalidatePath(`/imports/${importId}`);
    return { saved: true };
  } catch (error) {
    return {
      formError:
        error instanceof Error
          ? error.message
          : "Could not dismiss this review task.",
    };
  }
}

export async function publishCatalogueImportRowAction(
  _previous: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  const importId = String(formData.get("importId") ?? "");
  const rowId = String(formData.get("rowId") ?? "");
  const session = await requireManagerSession();
  const repository = new CatalogueImportRepository(
    await getSupabaseServerClient(),
  );

  try {
    await repository.publishRow({
      retailerId: session.retailerId,
      importRowId: rowId as never,
    });
    revalidatePath(`/imports/${importId}`);
    revalidatePath("/products");
    return { saved: true };
  } catch (error) {
    return {
      formError:
        error instanceof Error ? error.message : "Could not publish this row.",
    };
  }
}

export async function publishCatalogueImportAction(
  _previous: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  const importId = String(formData.get("importId") ?? "");
  const session = await requireManagerSession();
  const repository = new CatalogueImportRepository(
    await getSupabaseServerClient(),
  );

  try {
    const batch = await repository.publishEligibleRows({
      retailerId: session.retailerId,
      importId: importId as never,
    });
    revalidatePath(`/imports/${importId}`);
    revalidatePath("/products");
    if (batch.failures.length > 0) {
      return {
        formError: `${batch.failures.length} row(s) failed to publish. ${batch.failures[0]?.message ?? ""}`.trim(),
      };
    }
    if (batch.published.length === 0) {
      return {
        formError:
          "No eligible rows were ready to publish. Resolve review tasks and category mappings first.",
      };
    }
    return { saved: true };
  } catch (error) {
    return {
      formError:
        error instanceof Error ? error.message : "Could not publish this import.",
    };
  }
}
