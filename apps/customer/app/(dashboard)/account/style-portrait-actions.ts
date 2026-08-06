"use server";

import {
  CustomerRepository,
  StylePortraitConsentRepository,
  StylePortraitRepository,
  StyleProfileRepository,
} from "@paon/database";
import {
  asId,
  fileBytesMatchMimeType,
  safeAttachmentFileName,
  stylePortraitTransitionIssues,
  type StylePortraitReferenceKind,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

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

/**
 * The onboarding "preview" step (founder brief §Step 7): confirms the
 * uploaded full-body reference looks right before it locks in as
 * approved. Not an AI render in this slice — `WardrobeVisualizationJob`
 * requires an `Outfit`, which doesn't exist yet during onboarding; a
 * true rendered preview is a fast-follow once outfit-agnostic generation
 * is supported. Named honestly here rather than faked.
 */
export async function generateStylePortraitPreview(
  formData: FormData,
): Promise<void> {
  const retailerId = String(formData.get("retailerId"));
  const { customer, supabase } = await resolveCustomer(retailerId);

  const portraitRepo = new StylePortraitRepository(supabase);
  const portrait = await portraitRepo.findLatestForCustomer(customer.id);
  if (!portrait) throw new Error("No Style Portrait draft to preview.");

  const hasFace = portrait.references.some((ref) => ref.kind === "face");
  const fullBody = portrait.references.find((ref) => ref.kind === "full_body");
  const issues = stylePortraitTransitionIssues({
    action: "generate_preview",
    currentStatus: portrait.status,
    hasFaceReference: hasFace,
    hasFullBodyReference: Boolean(fullBody),
  });
  if (issues.length > 0 || !fullBody) {
    throw new Error("Upload both a face and a full-body photo first.");
  }

  const { data: signed, error } = await supabase.storage
    .from(fullBody.storageBucket)
    .createSignedUrl(fullBody.storagePath, 15 * 60);
  if (error) throw error;

  await portraitRepo.recordPreview(portrait.id, signed.signedUrl);
  revalidatePath("/account");
}

export async function approveStylePortrait(formData: FormData): Promise<void> {
  const retailerId = String(formData.get("retailerId"));
  const { customer, supabase } = await resolveCustomer(retailerId);
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
