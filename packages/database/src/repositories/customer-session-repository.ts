import {
  asId,
  type CustomerInteractionSession,
  type CustomerInteractionSessionId,
  type RetailerId,
  type SessionVisibilityState,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type SessionRow =
  Database["public"]["Tables"]["customer_interaction_sessions"]["Row"];

const toDomain = (row: SessionRow): CustomerInteractionSession => ({
  id: asId<"CustomerInteractionSessionId">(row.id),
  retailerId: asId<"RetailerId">(row.retailer_id),
  customerId: asId<"CustomerId">(row.customer_id),
  startedAt: row.started_at,
  lastHeartbeatAt: row.last_heartbeat_at,
  route: row.route,
  visibilityState: row.visibility_state as SessionVisibilityState,
  ...(row.ended_at ? { endedAt: row.ended_at } : {}),
  ...(row.idle_since ? { idleSince: row.idle_since } : {}),
});

export class CustomerSessionRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async start(args: {
    readonly retailerId: RetailerId;
    readonly route: string;
    readonly resumeSessionId?: CustomerInteractionSessionId;
  }): Promise<CustomerInteractionSessionId> {
    const { data, error } = await this.client.rpc(
      "start_customer_interaction_session",
      {
        p_retailer_id: args.retailerId,
        p_route: args.route,
        ...(args.resumeSessionId
          ? { p_resume_session_id: args.resumeSessionId }
          : {}),
      },
    );
    if (error) throw error;
    return asId<"CustomerInteractionSessionId">(data);
  }

  async heartbeat(args: {
    readonly sessionId: CustomerInteractionSessionId;
    readonly visibilityState: SessionVisibilityState;
    readonly route?: string;
  }): Promise<CustomerInteractionSessionId> {
    const { data, error } = await this.client.rpc(
      "heartbeat_customer_interaction_session",
      {
        p_session_id: args.sessionId,
        p_visibility_state: args.visibilityState,
        ...(args.route ? { p_route: args.route } : {}),
      },
    );
    if (error) throw error;
    return asId<"CustomerInteractionSessionId">(data);
  }

  async end(
    sessionId: CustomerInteractionSessionId,
  ): Promise<CustomerInteractionSessionId> {
    const { data, error } = await this.client.rpc(
      "end_customer_interaction_session",
      { p_session_id: sessionId },
    );
    if (error) throw error;
    return asId<"CustomerInteractionSessionId">(data);
  }

  async findById(
    sessionId: CustomerInteractionSessionId,
  ): Promise<CustomerInteractionSession | null> {
    const { data, error } = await this.client
      .from("customer_interaction_sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();
    if (error) throw error;
    return data ? toDomain(data) : null;
  }
}
