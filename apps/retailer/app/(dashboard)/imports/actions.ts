"use server";

import { requireRetailerRole } from "@paon/auth";
import {
  CatalogueImportRepository,
  MetadataRepository,
  RetailerStaffRepository,
} from "@paon/database";
import {
  asId,
  buildImportPreview,
  METADATA_CONCEPT_KINDS,
  parseImportFile,
  type MetadataConceptKind,
} from "@paon/domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface ImportUploadState {
  formError?: string;
}

async function requireManagerSession() {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "manager");
  return session;
}

export async function uploadCatalogueImport(
  _previous: ImportUploadState,
  formData: FormData,
): Promise<ImportUploadState> {
  const session = await requireManagerSession();
  const supabase = await getSupabaseServerClient();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { formError: "Choose a CSV, XLSX, or JSON file to preview." };
  }

  const staff = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  if (!staff) {
    return { formError: "Your staff profile could not be resolved." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const parsed = await parseImportFile({
    filename: file.name,
    bytes,
  });

  if (parsed.parseErrors.length > 0 && parsed.rows.length === 0) {
    return {
      formError: parsed.parseErrors.map((error) => error.message).join(" "),
    };
  }

  const importRepo = new CatalogueImportRepository(supabase);
  const metadataRepo = new MetadataRepository(supabase);
  const [existingSkus, existingSlugs, concepts] = await Promise.all([
    importRepo.listExistingSkus(session.retailerId),
    importRepo.listExistingSlugs(session.retailerId),
    metadataRepo.findVisibleConcepts(session.retailerId),
  ]);

  const conceptsByKind = METADATA_CONCEPT_KINDS.reduce<
    Partial<
      Record<
        MetadataConceptKind,
        { id: string; slug: string; canonicalName: string }[]
      >
    >
  >((accumulator, kind) => {
    accumulator[kind] = concepts
      .filter((concept) => concept.kind === kind)
      .map((concept) => ({
        id: concept.id,
        slug: concept.slug,
        canonicalName: concept.canonicalName,
      }));
    return accumulator;
  }, {});

  const preview = buildImportPreview(parsed.rows, {
    existingSkus,
    existingSlugs,
    conceptsByKind,
  });

  const importJob = await importRepo.createPreview({
    retailerId: session.retailerId,
    uploadedByStaffId: asId<"StaffId">(staff.id),
    sourceFilename: file.name,
    sourceType: parsed.sourceType,
    contractVersion: parsed.contractVersion,
    rows: preview.rows,
  });

  revalidatePath("/imports");
  redirect(`/imports/${importJob.id}`);
}
