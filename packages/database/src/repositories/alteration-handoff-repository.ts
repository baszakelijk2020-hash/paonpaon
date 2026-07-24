import {
  asId,
  type Address,
  type AlterationId,
  type ChainOfCustodyEvent,
  type FulfillmentEvent,
  type RetailerId,
  type StaffId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type CustodyRow =
  Database["public"]["Tables"]["chain_of_custody_events"]["Row"];
type FulfillmentRow =
  Database["public"]["Tables"]["alteration_fulfillment_events"]["Row"];

function fulfillmentToDomain(row: FulfillmentRow): FulfillmentEvent {
  return {
    id: asId<"FulfillmentEventId">(row.id),
    alterationId: asId<"AlterationId">(row.alteration_id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    ...(row.actor_staff_id
      ? { actorStaffId: asId<"StaffId">(row.actor_staff_id) }
      : {}),
    method: row.method,
    status: row.status,
    ...(row.scheduled_at ? { scheduledAt: row.scheduled_at } : {}),
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
    ...(row.delivery_address
      ? { deliveryAddress: row.delivery_address as unknown as Address }
      : {}),
    ...(row.released_to_name ? { releasedToName: row.released_to_name } : {}),
    ...(row.verification_note
      ? { verificationNote: row.verification_note }
      : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export class AlterationHandoffRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findCustody(
    alterationId: AlterationId,
  ): Promise<ChainOfCustodyEvent[]> {
    const { data, error } = await this.client
      .from("chain_of_custody_events")
      .select("*")
      .eq("alteration_id", alterationId)
      .order("occurred_at", { ascending: true });
    if (error) throw error;
    return data.map((row: CustodyRow) => ({
      id: asId<"ChainOfCustodyEventId">(row.id),
      alterationId: asId<"AlterationId">(row.alteration_id),
      retailerId: asId<"RetailerId">(row.retailer_id),
      eventType: row.event_type,
      ...(row.from_party ? { fromParty: row.from_party } : {}),
      ...(row.to_party ? { toParty: row.to_party } : {}),
      ...(row.condition_note ? { conditionNote: row.condition_note } : {}),
      ...(row.actor_staff_id
        ? { actorStaffId: asId<"StaffId">(row.actor_staff_id) }
        : {}),
      occurredAt: row.occurred_at,
    }));
  }

  async recordCustody(params: {
    alterationId: AlterationId;
    retailerId: RetailerId;
    eventType: CustodyRow["event_type"];
    fromParty?: string;
    toParty?: string;
    conditionNote?: string;
    actorStaffId?: StaffId;
  }): Promise<void> {
    const { error } = await this.client.from("chain_of_custody_events").insert({
      alteration_id: params.alterationId,
      retailer_id: params.retailerId,
      event_type: params.eventType,
      from_party: params.fromParty ?? null,
      to_party: params.toParty ?? null,
      condition_note: params.conditionNote ?? null,
      actor_staff_id: params.actorStaffId ?? null,
    });
    if (error) throw error;
  }

  async findFulfillment(
    alterationId: AlterationId,
  ): Promise<FulfillmentEvent[]> {
    const { data, error } = await this.client
      .from("alteration_fulfillment_events")
      .select("*")
      .eq("alteration_id", alterationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(fulfillmentToDomain);
  }

  async recordFulfillment(params: {
    alterationId: AlterationId;
    retailerId: RetailerId;
    method: "pickup" | "delivery";
    status: "scheduled" | "ready" | "dispatched" | "completed" | "canceled";
    scheduledAt?: string;
    deliveryAddress?: Address;
    releasedToName?: string;
    verificationNote?: string;
    actorStaffId?: StaffId;
  }): Promise<void> {
    const { error } = await this.client
      .from("alteration_fulfillment_events")
      .insert({
        alteration_id: params.alterationId,
        retailer_id: params.retailerId,
        method: params.method,
        status: params.status,
        scheduled_at: params.scheduledAt ?? null,
        delivery_address: params.deliveryAddress
          ? { ...params.deliveryAddress }
          : null,
        completed_at:
          params.status === "completed" ? new Date().toISOString() : null,
        released_to_name: params.releasedToName ?? null,
        verification_note: params.verificationNote ?? null,
        actor_staff_id: params.actorStaffId ?? null,
      });
    if (error) throw error;
  }
}
