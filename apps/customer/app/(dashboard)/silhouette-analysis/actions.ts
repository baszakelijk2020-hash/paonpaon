"use server";

import { SilhouetteAnalysisRepository } from "@paon/database";
import {
  asId,
  fileBytesMatchMimeType,
  safeAttachmentFileName,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const CAPTURE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type CaptureMimeType = (typeof CAPTURE_MIME_TYPES)[number];
const MAX_CAPTURE_BYTES = 10 * 1024 * 1024;

/** Explicit consent starts the session — no covert camera start. A
 * plain form submit, same "explicit action" precedent as everywhere
 * else in this codebase. */
export async function startSilhouetteAnalysisSession(
  formData: FormData,
): Promise<void> {
  await requireSession();
  const retailerId = String(formData.get("retailerId"));
  const supabase = await getSupabaseServerClient();
  await new SilhouetteAnalysisRepository(supabase).startSession(
    asId<"RetailerId">(retailerId),
  );
  revalidatePath("/silhouette-analysis");
}

export interface UploadCaptureState {
  formError?: string;
}

export async function uploadSilhouetteCapture(
  sessionId: string,
  retailerId: string,
  _previous: UploadCaptureState,
  formData: FormData,
): Promise<UploadCaptureState> {
  await requireSession();
  const supabase = await getSupabaseServerClient();
  const repo = new SilhouetteAnalysisRepository(supabase);

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { formError: "Choose a photo first." };
  }
  if (file.size > MAX_CAPTURE_BYTES) {
    return { formError: "Photo must be 10 MB or smaller." };
  }
  if (!CAPTURE_MIME_TYPES.includes(file.type as CaptureMimeType)) {
    return { formError: "Use a JPEG, PNG or WEBP photo." };
  }

  const content = await file.arrayBuffer();
  const mimeType = file.type as CaptureMimeType;
  if (!fileBytesMatchMimeType(new Uint8Array(content), mimeType)) {
    return { formError: "File contents do not match the declared type." };
  }

  try {
    await repo.beginCapture(asId<"SilhouetteAnalysisSessionId">(sessionId));
    await repo.uploadCapture(asId<"SilhouetteAnalysisSessionId">(sessionId), {
      retailerId: asId<"RetailerId">(retailerId),
      fileName: safeAttachmentFileName(file.name),
      mimeType,
      sizeBytes: file.size,
      content,
    });
  } catch (error) {
    return {
      formError:
        error instanceof Error ? error.message : "Could not upload photo.",
    };
  }

  revalidatePath("/silhouette-analysis");
  return {};
}

export async function withdrawSilhouetteAnalysisConsent(
  formData: FormData,
): Promise<void> {
  await requireSession();
  const sessionId = String(formData.get("sessionId"));
  const supabase = await getSupabaseServerClient();
  await new SilhouetteAnalysisRepository(supabase).withdrawConsent(
    asId<"SilhouetteAnalysisSessionId">(sessionId),
  );
  revalidatePath("/silhouette-analysis");
}

export async function confirmSilhouetteAnalysisCandidate(
  formData: FormData,
): Promise<void> {
  await requireSession();
  const sessionId = String(formData.get("sessionId"));
  const supabase = await getSupabaseServerClient();
  await new SilhouetteAnalysisRepository(supabase).confirmCandidate(
    asId<"SilhouetteAnalysisSessionId">(sessionId),
  );
  revalidatePath("/silhouette-analysis");
}
