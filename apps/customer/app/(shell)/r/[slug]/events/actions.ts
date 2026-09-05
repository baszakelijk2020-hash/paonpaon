"use server";

import { EventRepository } from "@paon/database";
import { eventRsvpSchema } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { assertRetailerModuleActive } from "@/lib/module-session";
import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function rsvpToEvent(formData: FormData) {
  await requireSession();
  const value = eventRsvpSchema.parse({
    eventId: formData.get("eventId"),
    status: formData.get("status"),
  });
  const supabase = await getSupabaseServerClient();
  const repo = new EventRepository(supabase);
  const event = await repo.findById(value.eventId as never);
  if (!event) throw new Error("Event not found");
  await assertRetailerModuleActive(
    supabase,
    event.retailerId,
    "commerce_growth",
  );
  await repo.rsvp(value.eventId as never, value.status);
  revalidatePath(`/r/${String(formData.get("slug"))}/events`);
  revalidatePath("/events");
}
