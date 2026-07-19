"use server";

import { requireRetailerRole } from "@paon/auth";
import { EventRepository } from "@paon/database";
import { createEventSchema, updateEventStatusSchema } from "@paon/domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function createEvent(formData: FormData) {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "manager");
  const value = createEventSchema.parse({
    name: formData.get("name"),
    description: formData.get("description"),
    startsAt: new Date(String(formData.get("startsAt"))).toISOString(),
    endsAt: new Date(String(formData.get("endsAt"))).toISOString(),
    venueName: formData.get("venueName"),
    venueAddress: formData.get("venueAddress") || undefined,
    visibility: formData.get("visibility"),
    capacity: formData.get("capacity") || undefined,
  });
  const event = await new EventRepository(
    await getSupabaseServerClient(),
  ).create(session.retailerId, {
    name: value.name,
    description: value.description,
    startsAt: value.startsAt,
    endsAt: value.endsAt,
    venueName: value.venueName,
    visibility: value.visibility,
    ...(value.venueAddress ? { venueAddress: value.venueAddress } : {}),
    ...(value.capacity ? { capacity: value.capacity } : {}),
  });
  redirect(`/events/${event.id}`);
}
export async function updateEventStatus(formData: FormData) {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "manager");
  const eventId = String(formData.get("eventId"));
  const status = updateEventStatusSchema.parse(formData.get("status"));
  await new EventRepository(await getSupabaseServerClient()).updateStatus(
    eventId as never,
    status,
  );
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
}
