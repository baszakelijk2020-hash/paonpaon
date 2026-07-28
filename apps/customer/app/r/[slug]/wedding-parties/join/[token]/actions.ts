"use server";

import { randomUUID } from "node:crypto";

import { WeddingPartyRepository } from "@paon/database";
import {
  asId,
  joinWeddingPartySchema,
  type WeddingPartyMemberRole,
} from "@paon/domain";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface JoinPartyState {
  formError?: string;
  joined?: boolean;
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** The only anonymous write on this route — `join_wedding_party`
 * (security definer) is the sole source of truth for whether the
 * token is valid; this action does not read the party first (see
 * WeddingPartyRepository.joinViaInvite's comment). Photo upload uses
 * the service-role client because the joiner has no session and
 * storage RLS is organizer/staff-only (ADR-055). */
export async function joinWeddingParty(
  token: string,
  _prevState: JoinPartyState,
  formData: FormData,
): Promise<JoinPartyState> {
  const parsed = joinWeddingPartySchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    heightCm: formData.get("heightCm"),
    weightKg: formData.get("weightKg"),
  });
  if (!parsed.success) {
    return {
      formError: parsed.error.issues[0]?.message ?? "Check your details.",
    };
  }

  const photo = formData.get("photo");
  let photoFile: File | null = null;
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > 5 * 1024 * 1024) {
      return { formError: "Photos must be 5 MB or smaller." };
    }
    if (
      !ALLOWED_IMAGE_TYPES.includes(
        photo.type as (typeof ALLOWED_IMAGE_TYPES)[number],
      )
    ) {
      return { formError: "Use a JPEG, PNG or WebP photo." };
    }
    photoFile = photo;
  } else {
    return { formError: "Add a photo so the atelier can recognise you." };
  }

  const supabase = await getSupabaseServerClient();
  let joined: { memberId: string; partyId: string; retailerId: string };
  try {
    joined = await new WeddingPartyRepository(supabase).joinViaInvite({
      inviteToken: token,
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role as WeddingPartyMemberRole,
      heightCm: parsed.data.heightCm,
      weightKg: parsed.data.weightKg,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { formError: message };
  }

  try {
    const adminRepo = new WeddingPartyRepository(getSupabaseAdminClient());
    const safeName = photoFile.name
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .slice(-120);
    const storagePath = `${joined.retailerId}/${joined.partyId}/members/${joined.memberId}-join-${randomUUID()}-${safeName}`;
    const publicUrl = await adminRepo.uploadPartyPhoto({
      storagePath,
      mimeType: photoFile.type as (typeof ALLOWED_IMAGE_TYPES)[number],
      content: await photoFile.arrayBuffer(),
    });
    await adminRepo.setMemberPhotoUrl(
      asId<"WeddingPartyMemberId">(joined.memberId),
      publicUrl,
    );
  } catch (error) {
    return {
      formError:
        error instanceof Error
          ? `Joined, but photo upload failed: ${error.message}`
          : "Joined, but photo upload failed.",
    };
  }

  return { joined: true };
}
