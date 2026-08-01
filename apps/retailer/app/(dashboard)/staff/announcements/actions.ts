"use server";

import { requireRetailerRole } from "@paon/auth";
import {
  InternalCommunityRepository,
  RetailerStaffRepository,
} from "@paon/database";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface AnnouncementActionState {
  formError?: string;
  notice?: string;
}

const REJECTION_MESSAGES = {
  title_too_short: "Add a title so staff know what this is about.",
  body_too_short:
    "Describe what happened or what staff need to know — a few words is not enough.",
  invalid_audience: "Select an audience.",
} as const;

/**
 * Publish an announcement (managers only). Uses the session-scoped
 * client so the RLS insert policy can pin the author to the calling user.
 */
export async function publishAnnouncement(
  _previous: AnnouncementActionState,
  formData: FormData,
): Promise<AnnouncementActionState> {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "manager");

  const supabase = await getSupabaseServerClient();
  const author = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  if (!author) {
    return { formError: "Your staff record could not be found." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const audienceType = String(formData.get("audienceType") ?? "").trim();
  const requiresAcknowledgement =
    String(formData.get("requiresAcknowledgement") ?? "") === "on";

  if (!title || title.length < 3) {
    return { formError: REJECTION_MESSAGES.title_too_short };
  }

  if (!body || body.length < 10) {
    return { formError: REJECTION_MESSAGES.body_too_short };
  }

  if (!audienceType) {
    return { formError: REJECTION_MESSAGES.invalid_audience };
  }

  let audienceRoles: readonly string[] = [];
  if (
    audienceType !== "everyone" &&
    audienceType !== "branch" &&
    !audienceType.startsWith("role:")
  ) {
    return { formError: REJECTION_MESSAGES.invalid_audience };
  }

  if (audienceType.startsWith("role:")) {
    audienceRoles = [audienceType.slice(5)];
  }

  try {
    await new InternalCommunityRepository(supabase).publishAnnouncement({
      retailerId: session.retailerId,
      authoredByStaffId: author.id,
      title,
      body,
      ...(audienceRoles.length > 0 ? { audienceRoles } : {}),
      requiresAcknowledgement,
    });
  } catch {
    return {
      formError: "That announcement could not be published.",
    };
  }

  revalidatePath("/staff/announcements");
  return { notice: "Published to your team." };
}

/**
 * Record an acknowledgement. Uses the session-scoped client so the RLS
 * insert policy pins the acknowledging staff to the calling user.
 */
export async function acknowledgeAnnouncement(
  _previous: AnnouncementActionState,
  formData: FormData,
): Promise<AnnouncementActionState> {
  const session = await requireSession();

  const supabase = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  if (!staff) {
    return { formError: "Your staff record could not be found." };
  }

  const announcementId = String(formData.get("announcementId") ?? "").trim();
  if (!announcementId) {
    return { formError: "Invalid announcement." };
  }

  try {
    await new InternalCommunityRepository(supabase).acknowledgeAnnouncement({
      retailerId: session.retailerId,
      announcementId,
      staffId: staff.id,
    });
  } catch {
    return { formError: "Could not record your acknowledgement." };
  }

  revalidatePath("/staff/announcements");
  return { notice: "Thank you." };
}
