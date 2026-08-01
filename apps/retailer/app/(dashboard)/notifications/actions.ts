"use server";
import { NotificationRepository } from "@paon/database";
import { revalidatePath } from "next/cache";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";
export async function markNotificationRead(formData: FormData) {
  await requireModuleSession("platform_core");
  await new NotificationRepository(await getSupabaseServerClient()).markRead(
    String(formData.get("notificationId")),
  );
  revalidatePath("/notifications");
}
