import {
  asId,
  type ClientelingNote,
  type CustomerId,
  type RetailerId,
  type StaffId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";
type Row = Database["public"]["Tables"]["clienteling_notes"]["Row"];
const toDomain = (row: Row): ClientelingNote => ({
  id: asId<"ClientelingNoteId">(row.id),
  retailerId: asId<"RetailerId">(row.retailer_id),
  customerId: asId<"CustomerId">(row.customer_id),
  authorStaffId: asId<"StaffId">(row.author_staff_id),
  body: row.body,
  pinned: row.pinned,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
});
export class ClientelingRepository {
  constructor(private readonly client: PaonSupabaseClient) {}
  async findByCustomer(customerId: CustomerId): Promise<ClientelingNote[]> {
    const { data, error } = await this.client
      .from("clienteling_notes")
      .select("*")
      .eq("customer_id", customerId)
      .is("deleted_at", null)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toDomain);
  }
  async create(values: {
    retailerId: RetailerId;
    customerId: CustomerId;
    authorStaffId: StaffId;
    body: string;
    pinned: boolean;
  }): Promise<ClientelingNote> {
    const { data, error } = await this.client
      .from("clienteling_notes")
      .insert({
        retailer_id: values.retailerId,
        customer_id: values.customerId,
        author_staff_id: values.authorStaffId,
        body: values.body,
        pinned: values.pinned,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toDomain(data);
  }
}
