import { asId, type Notification, type UserId } from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";
type Row = Database["public"]["Tables"]["notifications"]["Row"];
const toDomain = (row: Row): Notification => ({
  id: asId<"NotificationId">(row.id),
  retailerId: asId<"RetailerId">(row.retailer_id),
  recipientUserId: asId<"UserId">(row.recipient_user_id),
  ...(row.customer_id
    ? { customerId: asId<"CustomerId">(row.customer_id) }
    : {}),
  channel: row.channel,
  category: row.category,
  title: row.title,
  body: row.body,
  ...(row.action_href ? { actionHref: row.action_href } : {}),
  ...(row.read_at ? { readAt: row.read_at } : {}),
  ...(row.sent_at ? { sentAt: row.sent_at } : {}),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
});
export class NotificationRepository {
  constructor(private readonly client: PaonSupabaseClient) {}
  async findByUser(userId: UserId): Promise<Notification[]> {
    const { data, error } = await this.client
      .from("notifications")
      .select("*")
      .eq("recipient_user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data.map(toDomain);
  }
  async markRead(id: string): Promise<void> {
    const { error } = await this.client
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  }
}
