import type { CustomerAccessEventAction } from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";

/**
 * Sensitive-access ledger (ADR-074 Slice 1). Wraps
 * `record_customer_access_event`, which self-derives retailer/actor
 * server-side and writes only action/reason/outcome metadata — never the
 * sensitive payload itself — into the existing `audit_log_entries` table.
 */
export class AuditRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async recordCustomerAccessEvent(values: {
    action: CustomerAccessEventAction;
    entityType: string;
    entityId: string;
    reason?: string;
    outcome?: string;
  }): Promise<void> {
    const { error } = await this.client.rpc("record_customer_access_event", {
      p_action: values.action,
      p_entity_type: values.entityType,
      p_entity_id: values.entityId,
      ...(values.reason !== undefined ? { p_reason: values.reason } : {}),
      ...(values.outcome !== undefined ? { p_outcome: values.outcome } : {}),
    });
    if (error) throw error;
  }
}
