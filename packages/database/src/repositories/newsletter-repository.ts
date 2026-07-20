import { asId, type NewsletterSubscriber, type RetailerId } from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type Row = Database["public"]["Tables"]["newsletter_subscribers"]["Row"];

const toDomain = (row: Row): NewsletterSubscriber => ({
  id: row.id,
  retailerId: asId<"RetailerId">(row.retailer_id),
  email: row.email,
  subscribedAt: row.subscribed_at,
  ...(row.unsubscribed_at ? { unsubscribedAt: row.unsubscribed_at } : {}),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** See `docs/ARCHITECTURE.md` "Data access layer" — the only code
 * allowed to query `newsletter_subscribers`. */
export class NewsletterRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  /** The only anonymous write on this table — `subscribe_to_newsletter`
   * (security definer, ADR: newsletter signup) validates the email
   * itself; no pre-check here. */
  async subscribe(retailerId: RetailerId, email: string): Promise<void> {
    const { error } = await this.client.rpc("subscribe_to_newsletter", {
      p_retailer_id: retailerId,
      p_email: email,
    });
    if (error) throw error;
  }

  async findActiveByRetailer(
    retailerId: RetailerId,
  ): Promise<NewsletterSubscriber[]> {
    const { data, error } = await this.client
      .from("newsletter_subscribers")
      .select("*")
      .eq("retailer_id", retailerId)
      .is("unsubscribed_at", null)
      .order("subscribed_at", { ascending: false });
    if (error) throw error;
    return data.map(toDomain);
  }

  async findAllActiveGroupedByRetailer(): Promise<
    Map<RetailerId, NewsletterSubscriber[]>
  > {
    const { data, error } = await this.client
      .from("newsletter_subscribers")
      .select("*")
      .is("unsubscribed_at", null);
    if (error) throw error;
    const grouped = new Map<RetailerId, NewsletterSubscriber[]>();
    for (const row of data) {
      const subscriber = toDomain(row);
      const list = grouped.get(subscriber.retailerId) ?? [];
      list.push(subscriber);
      grouped.set(subscriber.retailerId, list);
    }
    return grouped;
  }
}
