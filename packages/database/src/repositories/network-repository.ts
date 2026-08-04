/**
 * Lifestyle partner catalogue and attribution (PHASE 15.1). Persistence
 * over the pure checks in `@paon/domain`'s `network/partner-attribution.ts`.
 *
 * `network_pseudonym_map` grants SELECT/INSERT to `service_role` only — no
 * retailer session can read or write it, by design, so a partner
 * integration can never resolve a pseudonym back to a person. `resolvePseudonym`
 * is the one method here that requires the caller to pass an
 * admin/service-role client rather than the normal per-request session
 * client; every other method on this repository works with the ordinary
 * session client, same as any other retailer-staff-writable table.
 */

import {
  buildPartnerPayload,
  resolveAttribution,
  type AttributionEvent,
  type AttributionOutcome,
  type AttributionRecord,
  type CustomerId,
  type PartnerPayload,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type PartnerRow = Database["public"]["Tables"]["network_partners"]["Row"];
type ListingRow = Database["public"]["Tables"]["network_listings"]["Row"];
type AttributionEventRow =
  Database["public"]["Tables"]["network_attribution_events"]["Row"];

export interface NetworkPartner {
  readonly id: string;
  readonly retailerId: RetailerId;
  readonly displayName: string;
  readonly partnerKey: string;
  readonly disclosureText: string;
  readonly active: boolean;
}

export interface NetworkListing {
  readonly id: string;
  readonly retailerId: RetailerId;
  readonly partnerId: string;
  readonly title: string;
  readonly description: string | null;
  readonly destinationUrl: string;
  readonly active: boolean;
}

function partnerToDomain(row: PartnerRow): NetworkPartner {
  return {
    id: row.id,
    retailerId: row.retailer_id as RetailerId,
    displayName: row.display_name,
    partnerKey: row.partner_key,
    disclosureText: row.disclosure_text,
    active: row.active,
  };
}

function listingToDomain(row: ListingRow): NetworkListing {
  return {
    id: row.id,
    retailerId: row.retailer_id as RetailerId,
    partnerId: row.partner_id,
    title: row.title,
    description: row.description,
    destinationUrl: row.destination_url,
    active: row.active,
  };
}

export class NetworkRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async createPartner(args: {
    readonly retailerId: RetailerId;
    readonly displayName: string;
    readonly partnerKey: string;
    readonly disclosureText: string;
  }): Promise<NetworkPartner> {
    const { data, error } = await this.client
      .from("network_partners")
      .insert({
        retailer_id: args.retailerId,
        display_name: args.displayName.trim(),
        partner_key: args.partnerKey.trim(),
        disclosure_text: args.disclosureText.trim(),
      })
      .select("*")
      .single();
    if (error) throw error;
    return partnerToDomain(data);
  }

  async listPartners(
    retailerId: RetailerId,
  ): Promise<readonly NetworkPartner[]> {
    const { data, error } = await this.client
      .from("network_partners")
      .select("*")
      .eq("retailer_id", retailerId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(partnerToDomain);
  }

  async createListing(args: {
    readonly retailerId: RetailerId;
    readonly partnerId: string;
    readonly title: string;
    readonly description?: string;
    readonly destinationUrl: string;
  }): Promise<NetworkListing> {
    const { data, error } = await this.client
      .from("network_listings")
      .insert({
        retailer_id: args.retailerId,
        partner_id: args.partnerId,
        title: args.title.trim(),
        description: args.description?.trim() || null,
        destination_url: args.destinationUrl.trim(),
        curated_by_retailer: true,
      })
      .select("*")
      .single();
    if (error) throw error;
    return listingToDomain(data);
  }

  async listListings(
    retailerId: RetailerId,
  ): Promise<readonly NetworkListing[]> {
    const { data, error } = await this.client
      .from("network_listings")
      .select("*")
      .eq("retailer_id", retailerId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(listingToDomain);
  }

  async setListingActive(args: {
    readonly retailerId: RetailerId;
    readonly listingId: string;
    readonly active: boolean;
  }): Promise<void> {
    const { error } = await this.client
      .from("network_listings")
      .update({ active: args.active })
      .eq("id", args.listingId)
      .eq("retailer_id", args.retailerId);
    if (error) throw error;
  }

  /**
   * Requires an admin/service-role client — see the class doc comment.
   * Stable per (customer, partner): a repeat visit reuses the same ref
   * rather than minting a new one, so a partner's own repeat-conversion
   * accounting stays consistent without ever seeing who the person is.
   */
  async resolvePseudonym(args: {
    readonly retailerId: RetailerId;
    readonly customerId: CustomerId;
    readonly partnerId: string;
  }): Promise<string> {
    const { data: existing, error: findError } = await this.client
      .from("network_pseudonym_map")
      .select("pseudonymous_ref")
      .eq("retailer_id", args.retailerId)
      .eq("customer_id", args.customerId)
      .eq("partner_id", args.partnerId)
      .maybeSingle();
    if (findError) throw findError;
    if (existing) return existing.pseudonymous_ref;

    const pseudonymousRef = `pref_${crypto.randomUUID().replace(/-/g, "")}`;
    const { data, error } = await this.client
      .from("network_pseudonym_map")
      .insert({
        retailer_id: args.retailerId,
        customer_id: args.customerId,
        partner_id: args.partnerId,
        pseudonymous_ref: pseudonymousRef,
      })
      .select("pseudonymous_ref")
      .single();
    if (error) throw error;
    return data.pseudonymous_ref;
  }

  /**
   * Idempotent on `(retailer_id, provider_event_key)`: a retried provider
   * callback (or a doubled click) must not double-record.
   */
  async recordAttributionEvent(args: {
    readonly retailerId: RetailerId;
    readonly listingId: string;
    readonly pseudonymousRef: string;
    readonly event: AttributionEvent;
    readonly providerEventKey: string;
    readonly valueMinorUnits?: number;
    readonly occurredAt?: string;
  }): Promise<void> {
    const { error } = await this.client
      .from("network_attribution_events")
      .insert({
        retailer_id: args.retailerId,
        listing_id: args.listingId,
        pseudonymous_ref: args.pseudonymousRef,
        event: args.event,
        provider_event_key: args.providerEventKey,
        ...(args.valueMinorUnits !== undefined
          ? { value_minor_units: args.valueMinorUnits }
          : {}),
        ...(args.occurredAt ? { occurred_at: args.occurredAt } : {}),
      });
    // A retried callback replaying the same provider_event_key hits the
    // unique constraint — that is success, not failure, so it is swallowed
    // rather than surfaced as an error the caller has to special-case.
    if (error && error.code !== "23505") throw error;
  }

  async listAttributionEvents(args: {
    readonly retailerId: RetailerId;
    readonly listingId: string;
    readonly pseudonymousRef: string;
  }): Promise<readonly AttributionEventRow[]> {
    const { data, error } = await this.client
      .from("network_attribution_events")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .eq("listing_id", args.listingId)
      .eq("pseudonymous_ref", args.pseudonymousRef)
      .order("occurred_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  /**
   * The live, derived attribution state for one (listing, pseudonym) pair.
   * Never stored: `resolveAttribution` recomputes it from the full event
   * history every time, so a refund recorded after the fact is reflected
   * immediately with no row to go back and edit.
   */
  async resolveListingAttribution(args: {
    readonly retailerId: RetailerId;
    readonly listingId: string;
    readonly pseudonymousRef: string;
    readonly asOf?: string;
  }): Promise<AttributionOutcome> {
    const rows = await this.listAttributionEvents(args);
    const records: AttributionRecord[] = rows.map((row) => ({
      eventId: row.id,
      event: row.event as AttributionEvent,
      listingId: row.listing_id,
      pseudonymousRef: row.pseudonymous_ref,
      occurredAt: row.occurred_at,
      providerEventKey: row.provider_event_key,
      ...(row.value_minor_units !== null
        ? { valueMinorUnits: row.value_minor_units }
        : {}),
    }));
    return resolveAttribution({
      records,
      asOf: args.asOf ?? new Date().toISOString(),
    });
  }

  /**
   * What a partner integration would actually be sent for one event: a
   * whitelist over the pseudonymous ref, proven never to carry a name,
   * email or Self-Portrait value.
   */
  buildPartnerPayload(row: AttributionEventRow): PartnerPayload {
    return buildPartnerPayload({
      record: {
        eventId: row.id,
        event: row.event as AttributionEvent,
        listingId: row.listing_id,
        pseudonymousRef: row.pseudonymous_ref,
        occurredAt: row.occurred_at,
        providerEventKey: row.provider_event_key,
        ...(row.value_minor_units !== null
          ? { valueMinorUnits: row.value_minor_units }
          : {}),
      },
    });
  }
}
