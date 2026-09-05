"use server";

import { randomUUID } from "node:crypto";

import {
  WardrobeLifecycleRepository,
  WardrobeRepository,
} from "@paon/database";
import {
  buildWardrobeEvidenceObjectPath,
  recordWardrobeLifecycleEventInputSchema,
  submitWardrobeSelfScanInputSchema,
} from "@paon/domain";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface LifecycleActionState {
  fieldErrors: Record<string, string>;
  formError?: string;
  success?: boolean;
}

async function resolveOwnedItem(userId: string, wardrobeItemId: string) {
  const supabase = await getSupabaseServerClient();
  const repo = new WardrobeRepository(supabase);
  const item = await repo.findById(wardrobeItemId as never);
  if (!item) return null;

  const { CustomerRepository } = await import("@paon/database");
  const customers = await new CustomerRepository(supabase).findByUserId(
    userId as never,
  );
  const customer = customers.find(
    (candidate) =>
      candidate.id === item.customerId &&
      candidate.retailerId === item.retailerId,
  );
  if (!customer) return null;
  return { item, customer, supabase };
}

export async function recordWardrobeLifecycleEvent(
  _prevState: LifecycleActionState,
  formData: FormData,
): Promise<LifecycleActionState> {
  const session = await requireSession();
  const parsed = recordWardrobeLifecycleEventInputSchema.safeParse({
    wardrobeItemId: formData.get("wardrobeItemId"),
    eventKind: formData.get("eventKind"),
    note: optionalString(formData.get("note")),
    guidanceKind: optionalString(formData.get("guidanceKind")),
  });

  if (!parsed.success) {
    return { fieldErrors: zodFieldErrors(parsed.error) };
  }

  const owned = await resolveOwnedItem(
    session.userId,
    parsed.data.wardrobeItemId,
  );
  if (!owned) {
    return { fieldErrors: {}, formError: "Wardrobe item not found." };
  }

  try {
    await new WardrobeLifecycleRepository(owned.supabase).recordLifecycleEvent(
      parsed.data,
    );
  } catch (error) {
    return {
      fieldErrors: {},
      formError:
        error instanceof Error ? error.message : "Could not record event.",
    };
  }

  revalidatePath("/wardrobe");
  return { fieldErrors: {}, success: true };
}

export async function submitWardrobeSelfScan(
  _prevState: LifecycleActionState,
  formData: FormData,
): Promise<LifecycleActionState> {
  const session = await requireSession();
  const startsAt = optionalString(formData.get("appointmentStartsAt"));
  const endsAt = optionalString(formData.get("appointmentEndsAt"));
  const parsed = submitWardrobeSelfScanInputSchema.safeParse({
    wardrobeItemId: formData.get("wardrobeItemId"),
    notes: optionalString(formData.get("notes")),
    sizeChangeReported: formData.get("sizeChangeReported") === "on",
    fitPerceptionAtScan: optionalString(formData.get("fitPerceptionAtScan")),
    requestServiceHandoff: formData.get("requestServiceHandoff") !== "off",
    appointmentStartsAt: startsAt,
    appointmentEndsAt: endsAt,
    preferredAppointmentType: optionalString(
      formData.get("preferredAppointmentType"),
    ),
  });

  if (!parsed.success) {
    return { fieldErrors: zodFieldErrors(parsed.error) };
  }

  const owned = await resolveOwnedItem(
    session.userId,
    parsed.data.wardrobeItemId,
  );
  if (!owned) {
    return { fieldErrors: {}, formError: "Wardrobe item not found." };
  }

  const photo = formData.get("photo");
  let mimeType: "image/jpeg" | "image/png" | "image/webp" | undefined;
  let fileName: string | undefined;
  let content: ArrayBuffer | undefined;
  let sizeBytes: number | undefined;

  if (photo instanceof File && photo.size > 0) {
    if (
      photo.type !== "image/jpeg" &&
      photo.type !== "image/png" &&
      photo.type !== "image/webp"
    ) {
      return {
        fieldErrors: { photo: "Use a JPEG, PNG, or WebP photo." },
      };
    }
    if (photo.size > 10_485_760) {
      return { fieldErrors: { photo: "Photo must be 10MB or smaller." } };
    }
    mimeType = photo.type;
    fileName = photo.name || "self-scan.jpg";
    content = await photo.arrayBuffer();
    sizeBytes = photo.size;
  }

  try {
    const lifecycleRepo = new WardrobeLifecycleRepository(owned.supabase);
    const selfScanId = await lifecycleRepo.submitSelfScan(parsed.data);

    if (mimeType && fileName && content && sizeBytes !== undefined) {
      const storagePath = buildWardrobeEvidenceObjectPath({
        retailerId: owned.item.retailerId,
        wardrobeItemId: owned.item.id,
        objectName: `${randomUUID()}-${fileName}`,
      });
      await lifecycleRepo.uploadSelfScanImage({
        retailerId: owned.item.retailerId,
        wardrobeItemId: owned.item.id,
        selfScanId,
        storagePath,
        fileName,
        mimeType,
        sizeBytes,
        content,
      });
    }
  } catch (error) {
    return {
      fieldErrors: {},
      formError:
        error instanceof Error ? error.message : "Could not submit self-scan.",
    };
  }

  revalidatePath("/wardrobe");
  return { fieldErrors: {}, success: true };
}

export async function dismissLongevityGuidance(
  _prevState: LifecycleActionState,
  formData: FormData,
): Promise<LifecycleActionState> {
  const session = await requireSession();
  const wardrobeItemId = z
    .string()
    .uuid()
    .safeParse(formData.get("wardrobeItemId"));
  const guidanceKind = z
    .enum([
      "rotate_rest",
      "care_due",
      "cleaning_suggested",
      "repair_suggested",
      "age_stewardship",
    ])
    .safeParse(formData.get("guidanceKind"));

  if (!wardrobeItemId.success || !guidanceKind.success) {
    return { fieldErrors: { form: "Invalid dismiss request." } };
  }

  const owned = await resolveOwnedItem(session.userId, wardrobeItemId.data);
  if (!owned) {
    return { fieldErrors: {}, formError: "Wardrobe item not found." };
  }

  try {
    await new WardrobeLifecycleRepository(owned.supabase).recordLifecycleEvent({
      wardrobeItemId: wardrobeItemId.data,
      eventKind: "guidance_dismissed",
      guidanceKind: guidanceKind.data,
    });
  } catch (error) {
    return {
      fieldErrors: {},
      formError:
        error instanceof Error ? error.message : "Could not dismiss guidance.",
    };
  }

  revalidatePath("/wardrobe");
  return { fieldErrors: {}, success: true };
}

function optionalString(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}
