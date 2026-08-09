"use server";

import {
  CustomerRepository,
  MetadataRepository,
  RetailerVisualPresetRepository,
  StylePortraitConsentRepository,
  StylePortraitRepository,
  StyleProfileRepository,
  WardrobeVisualizationJobRepository,
} from "@paon/database";
import {
  asId,
  deriveTailoringAttributesFromFitArchetype,
  fileBytesMatchMimeType,
  parseFitArchetypeSlug,
  safeAttachmentFileName,
  stylePortraitTransitionIssues,
  type StylePortraitPreviewInputSnapshot,
  type StylePortraitReferenceKind,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { assertRetailerModuleActive } from "@/lib/module-session";
import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const REFERENCE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type ReferenceMimeType = (typeof REFERENCE_MIME_TYPES)[number];
const MAX_REFERENCE_BYTES = 10 * 1024 * 1024;
const BUCKET = "wardrobe-studio";

async function resolveCustomer(retailerId: string) {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const customer = customers.find((row) => row.retailerId === retailerId);
  if (!customer) throw new Error("Customer relationship not found.");
  return { customer, supabase };
}

/** Consent is the explicit action itself — no covert use of any uploaded
 * photo before this, same "explicit action, not implicit side effect"
 * precedent as silhouette analysis and the style quiz. */
export async function grantStylePortraitConsent(
  formData: FormData,
): Promise<void> {
  const retailerId = String(formData.get("retailerId"));
  const { customer, supabase } = await resolveCustomer(retailerId);
  await assertRetailerModuleActive(
    supabase,
    customer.retailerId,
    "wardrobe_styling",
  );
  await new StylePortraitConsentRepository(supabase).grant(
    customer.retailerId,
    customer.id,
  );
  revalidatePath("/account");
}

export async function withdrawStylePortraitConsent(
  formData: FormData,
): Promise<void> {
  const retailerId = String(formData.get("retailerId"));
  const { customer, supabase } = await resolveCustomer(retailerId);
  await new StylePortraitConsentRepository(supabase).withdraw(
    customer.retailerId,
    customer.id,
  );
  revalidatePath("/account");
}

export interface UploadReferenceState {
  formError?: string;
}

export async function uploadStylePortraitReference(
  retailerId: string,
  kind: StylePortraitReferenceKind,
  _previous: UploadReferenceState,
  formData: FormData,
): Promise<UploadReferenceState> {
  const { customer, supabase } = await resolveCustomer(retailerId);
  await assertRetailerModuleActive(
    supabase,
    customer.retailerId,
    "wardrobe_styling",
  );

  const consent = await new StylePortraitConsentRepository(
    supabase,
  ).findForCustomer(customer.retailerId, customer.id);
  if (consent.status !== "granted" || !consent.disclosuresAcknowledged) {
    return { formError: "Grant consent before uploading a photo." };
  }

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { formError: "Choose a photo first." };
  }
  if (file.size > MAX_REFERENCE_BYTES) {
    return { formError: "Photo must be 10 MB or smaller." };
  }
  if (!REFERENCE_MIME_TYPES.includes(file.type as ReferenceMimeType)) {
    return { formError: "Use a JPEG, PNG or WEBP photo." };
  }

  const content = await file.arrayBuffer();
  const mimeType = file.type as ReferenceMimeType;
  if (!fileBytesMatchMimeType(new Uint8Array(content), mimeType)) {
    return { formError: "File contents do not match the declared type." };
  }

  const portraitRepo = new StylePortraitRepository(supabase);
  let portrait = await portraitRepo.findLatestForCustomer(customer.id);
  if (
    !portrait ||
    portrait.status === "rejected" ||
    portrait.status === "superseded"
  ) {
    portrait = null;
  }

  const fileName = safeAttachmentFileName(file.name);
  const storagePath = `${customer.retailerId}/${customer.id}/references/${crypto.randomUUID()}-${fileName}`;

  try {
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, content, { contentType: mimeType, upsert: false });
    if (uploadError) throw uploadError;

    if (!portrait) {
      await portraitRepo.create({
        retailerId: customer.retailerId,
        customerId: customer.id,
        references: [{ kind, storageBucket: BUCKET, storagePath }],
      });
    } else {
      await portraitRepo.addReference(portrait.id, customer.retailerId, {
        kind,
        storageBucket: BUCKET,
        storagePath,
      });
    }
  } catch (error) {
    return {
      formError:
        error instanceof Error ? error.message : "Could not upload photo.",
    };
  }

  revalidatePath("/account");
  return {};
}

/** Fit archetype is declared through the existing StyleProfile RPC, same
 * mechanism the style quiz already uses (ADR-074 §3.2) — no new schema.
 * Also stamps the concept onto the active draft portrait so a later
 * generation snapshot can read it directly. */
export async function declareFitArchetype(
  retailerId: string,
  conceptId: string,
): Promise<void> {
  const { customer, supabase } = await resolveCustomer(retailerId);
  await assertRetailerModuleActive(
    supabase,
    customer.retailerId,
    "wardrobe_styling",
  );
  await new StyleProfileRepository(supabase).upsertDeclared(customer.id, {
    conceptId: asId<"MetadataConceptId">(conceptId),
    polarity: "positive",
  });

  const portraitRepo = new StylePortraitRepository(supabase);
  const portrait = await portraitRepo.findLatestForCustomer(customer.id);
  if (portrait && portrait.status === "draft") {
    await portraitRepo.setFitArchetype(portrait.id, conceptId);
  }

  revalidatePath("/account");
}

/** The onboarding preview is an actual neutral AI render. It uses the same
 * bounded queue/private-storage path as outfit generation, but has no Outfit:
 * the customer is choosing their identity reference before composing looks. */
export async function generateStylePortraitPreview(
  formData: FormData,
): Promise<void> {
  const retailerId = String(formData.get("retailerId"));
  const { customer, supabase } = await resolveCustomer(retailerId);
  await assertRetailerModuleActive(
    supabase,
    customer.retailerId,
    "wardrobe_styling",
  );

  const portraitRepo = new StylePortraitRepository(supabase);
  const portrait = await portraitRepo.findLatestForCustomer(customer.id);
  if (!portrait) throw new Error("No Style Portrait draft to preview.");

  const hasFace = portrait.references.some((ref) => ref.kind === "face");
  const hasFullBody = portrait.references.some(
    (ref) => ref.kind === "full_body",
  );
  const issues = stylePortraitTransitionIssues({
    action: "generate_preview",
    currentStatus: portrait.status,
    hasFaceReference: hasFace,
    hasFullBodyReference: hasFullBody,
  });
  if (issues.length > 0) {
    throw new Error("Upload both a face and a full-body photo first.");
  }
  if (!portrait.fitArchetypeConceptId) {
    throw new Error("Choose a fit preference first.");
  }

  const preset = await new RetailerVisualPresetRepository(
    supabase,
  ).findDefaultForRetailer(customer.retailerId);
  if (!preset) {
    throw new Error("This house has not configured a visual preset yet.");
  }

  const concept = await new MetadataRepository(supabase).findConceptById(
    customer.retailerId,
    asId<"MetadataConceptId">(portrait.fitArchetypeConceptId),
  );
  const archetype = concept ? parseFitArchetypeSlug(concept.slug) : null;
  if (!archetype) throw new Error("Choose a valid fit preference first.");

  const snapshot: StylePortraitPreviewInputSnapshot = {
    kind: "style_portrait_preview",
    stylePortraitId: portrait.id,
    stylePortraitVersion: portrait.version,
    retailerVisualPresetId: preset.id,
    tailoringAttributes: deriveTailoringAttributesFromFitArchetype(archetype),
    writtenInstructions:
      "Create a neutral studio Style Portrait in an understated plain outfit. Preserve identity and natural body proportions exactly.",
    providerName: "openai",
    model: "gpt-image-2",
  };

  await new WardrobeVisualizationJobRepository(
    supabase,
  ).enqueueStylePortraitPreview(
    {
      retailerId: customer.retailerId,
      customerId: customer.id,
      stylePortraitId: portrait.id,
      retailerVisualPresetId: preset.id,
    },
    snapshot,
  );
  revalidatePath("/account");
}

export async function approveStylePortrait(formData: FormData): Promise<void> {
  const retailerId = String(formData.get("retailerId"));
  const { customer, supabase } = await resolveCustomer(retailerId);
  await assertRetailerModuleActive(
    supabase,
    customer.retailerId,
    "wardrobe_styling",
  );
  const portraitRepo = new StylePortraitRepository(supabase);
  const portrait = await portraitRepo.findLatestForCustomer(customer.id);
  if (!portrait) throw new Error("No Style Portrait draft to approve.");
  await portraitRepo.approve(portrait.id);
  revalidatePath("/account");
  revalidatePath("/wardrobe");
}

export async function restartStylePortrait(formData: FormData): Promise<void> {
  const retailerId = String(formData.get("retailerId"));
  const { customer, supabase } = await resolveCustomer(retailerId);
  const portraitRepo = new StylePortraitRepository(supabase);
  const portrait = await portraitRepo.findLatestForCustomer(customer.id);
  if (!portrait) return;
  if (portrait.status === "approved") {
    await portraitRepo.supersede(portrait.id);
  } else if (portrait.status === "preview_generated") {
    await portraitRepo.reject(portrait.id, "Customer chose a different photo.");
  }
  revalidatePath("/account");
}
