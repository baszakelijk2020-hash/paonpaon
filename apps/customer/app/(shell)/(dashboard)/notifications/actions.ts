"use server";
import { NotificationRepository } from "@paon/database";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";
export async function markNotificationRead(formData: FormData) {
  await requireSession();
  await new NotificationRepository(await getSupabaseServerClient()).markRead(
    String(formData.get("notificationId")),
  );
  revalidatePath("/notifications");
}
