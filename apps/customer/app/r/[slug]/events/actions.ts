"use server";

import { EventRepository } from "@paon/database";
import { eventRsvpSchema } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function rsvpToEvent(formData: FormData) {
  await requireSession();
  const value = eventRsvpSchema.parse({
    eventId: formData.get("eventId"),
    status: formData.get("status"),
  });
  await new EventRepository(await getSupabaseServerClient()).rsvp(
    value.eventId as never,
    value.status,
  );
  revalidatePath(`/r/${String(formData.get("slug"))}/events`);
  revalidatePath("/events");
}
