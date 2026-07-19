import {
  asId,
  type CustomerId,
  type EventId,
  type EventRsvp,
  type EventStatus,
  type EventVisibility,
  type RetailerEvent,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type EventRow = Database["public"]["Tables"]["retailer_events"]["Row"];
type RsvpRow = Database["public"]["Tables"]["event_rsvps"]["Row"];
const toEvent = (row: EventRow): RetailerEvent => ({
  id: asId<"EventId">(row.id),
  retailerId: asId<"RetailerId">(row.retailer_id),
  name: row.name,
  description: row.description,
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  venueName: row.venue_name,
  ...(row.venue_address ? { venueAddress: row.venue_address } : {}),
  visibility: row.visibility,
  status: row.status,
  ...(row.capacity ? { capacity: row.capacity } : {}),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
});
const toRsvp = (row: RsvpRow): EventRsvp => ({
  eventId: asId<"EventId">(row.event_id),
  customerId: asId<"CustomerId">(row.customer_id),
  status: row.status,
  ...(row.responded_at ? { respondedAt: row.responded_at } : {}),
  createdAt: row.created_at,
});

export class EventRepository {
  constructor(private readonly client: PaonSupabaseClient) {}
  async findById(id: EventId): Promise<RetailerEvent | null> {
    const { data, error } = await this.client
      .from("retailer_events")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return data ? toEvent(data) : null;
  }
  async findByRetailer(retailerId: RetailerId): Promise<RetailerEvent[]> {
    const { data, error } = await this.client
      .from("retailer_events")
      .select("*")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .order("starts_at");
    if (error) throw error;
    return data.map(toEvent);
  }
  async findPublishedByRetailer(
    retailerId: RetailerId,
  ): Promise<RetailerEvent[]> {
    const { data, error } = await this.client
      .from("retailer_events")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("status", "published")
      .is("deleted_at", null)
      .order("starts_at");
    if (error) throw error;
    return data.map(toEvent);
  }
  async create(
    retailerId: RetailerId,
    values: {
      name: string;
      description: string;
      startsAt: string;
      endsAt: string;
      venueName: string;
      venueAddress?: string;
      visibility: EventVisibility;
      capacity?: number;
    },
  ): Promise<RetailerEvent> {
    const { data, error } = await this.client
      .from("retailer_events")
      .insert({
        retailer_id: retailerId,
        name: values.name,
        description: values.description,
        starts_at: values.startsAt,
        ends_at: values.endsAt,
        venue_name: values.venueName,
        venue_address: values.venueAddress ?? null,
        visibility: values.visibility,
        capacity: values.capacity ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toEvent(data);
  }
  async updateStatus(id: EventId, status: EventStatus): Promise<void> {
    const { error } = await this.client
      .from("retailer_events")
      .update({ status })
      .eq("id", id);
    if (error) throw error;
  }
  async findRsvps(eventId: EventId): Promise<EventRsvp[]> {
    const { data, error } = await this.client
      .from("event_rsvps")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at");
    if (error) throw error;
    return data.map(toRsvp);
  }
  async findByCustomer(customerId: CustomerId): Promise<EventRsvp[]> {
    const { data, error } = await this.client
      .from("event_rsvps")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toRsvp);
  }
  async rsvp(
    eventId: EventId,
    status: "attending" | "declined",
  ): Promise<void> {
    const { error } = await this.client.rpc("rsvp_to_event", {
      p_event_id: eventId,
      p_status: status,
    });
    if (error) throw error;
  }
}
