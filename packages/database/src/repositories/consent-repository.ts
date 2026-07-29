import {
  asId,
  buildConsentSnapshot,
  computeRetentionExpiresAt,
  computeWithdrawalRetentionDeadline,
  type ConsentPurpose,
  type CustomerConsentRecord,
  type CustomerId,
  type RetailerId,
  type UpsertCustomerConsentInput,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

type ConsentRow = Database["public"]["Tables"]["customer_consent_records"]["Row"];

function toDomain(row: ConsentRow): CustomerConsentRecord {
  return {
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    purpose: row.purpose as ConsentPurpose,
    grantedAt: row.granted_at,
    withdrawnAt: row.withdrawn_at,
    retentionDeadlineAt: row.retention_deadline_at,
  };
}

export class ConsentRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findByCustomer(
    retailerId: RetailerId,
    customerId: CustomerId,
  ): Promise<CustomerConsentRecord[]> {
    const { data, error } = await this.client
      .from("customer_consent_records")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("customer_id", customerId);
    if (error) throw error;
    return data.map(toDomain);
  }

  async upsert(
    retailerId: RetailerId,
    customerId: CustomerId,
    input: UpsertCustomerConsentInput,
  ): Promise<CustomerConsentRecord | null> {
    const existing = await this.findByCustomer(retailerId, customerId);
    const current = existing.find((record) => record.purpose === input.purpose);
    const now = new Date().toISOString();

    if (!input.granted && !current?.grantedAt) {
      return current ?? null;
    }

    const payload = input.granted
      ? {
          retailer_id: retailerId,
          customer_id: customerId,
          purpose: input.purpose,
          granted_at: current?.grantedAt ?? now,
          withdrawn_at: null,
          retention_deadline_at: null,
        }
      : {
          retailer_id: retailerId,
          customer_id: customerId,
          purpose: input.purpose,
          granted_at: current?.grantedAt ?? now,
          withdrawn_at: now,
          retention_deadline_at: computeWithdrawalRetentionDeadline(now),
        };

    const { data, error } = await this.client
      .from("customer_consent_records")
      .upsert(payload, {
        onConflict: "retailer_id,customer_id,purpose",
      })
      .select("*")
      .single();
    if (error) throw error;
    return toDomain(data);
  }

  /** Ensures a grant exists before capture; idempotent when already granted. */
  async ensureGrantedForCapture(
    retailerId: RetailerId,
    customerId: CustomerId,
    purpose: ConsentPurpose,
  ): Promise<CustomerConsentRecord> {
    const existing = await this.findByCustomer(retailerId, customerId);
    const current = existing.find((record) => record.purpose === purpose);
    if (current && !current.withdrawnAt) {
      return current;
    }
    return this.upsert(retailerId, customerId, { purpose, granted: true });
  }

  buildSnapshotForCapture(
    records: readonly CustomerConsentRecord[],
    purpose: ConsentPurpose,
    capturedAt: string,
  ) {
    const record = records.find((candidate) => candidate.purpose === purpose);
    return buildConsentSnapshot(record ?? null, capturedAt);
  }
}
