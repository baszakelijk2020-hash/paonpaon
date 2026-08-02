import { describe, expect, it } from "vitest";

import { orchestrateCampaignDeliveries } from "./campaign-delivery-orchestrator";
import type { PaonSupabaseClient } from "./client-type";

const NOW = "2026-08-02T12:00:00.000Z";
const TODAY = "2026-08-02";

/**
 * In-memory stand-in for a Supabase client, same shape as
 * morning-routine-delivery-orchestrator.test.ts's: `.from(table)` filters a
 * fixed fixture array through `.eq`/`.in`/`.is`/`.not`/`.limit`, resolving
 * via `.maybeSingle()` or the thenable itself; `.rpc(name, params)`
 * dispatches to a per-name handler and records every call.
 */
function createFakeClient(config: {
  readonly tables: Record<string, Record<string, unknown>[]>;
  readonly rpcHandlers: Record<
    string,
    (params: Record<string, unknown>) => unknown
  >;
}) {
  const rpcCalls: { name: string; params: Record<string, unknown> }[] = [];

  function from(table: string) {
    let rows = [...(config.tables[table] ?? [])];
    const chain = {
      select: () => chain,
      eq: (col: string, val: unknown) => {
        rows = rows.filter((row) => row[col] === val);
        return chain;
      },
      in: (col: string, vals: readonly unknown[]) => {
        rows = rows.filter((row) => vals.includes(row[col]));
        return chain;
      },
      is: (col: string, val: null | boolean) => {
        rows = rows.filter((row) => (row[col] ?? null) === val);
        return chain;
      },
      not: (col: string, _op: string, val: unknown) => {
        rows = rows.filter((row) => row[col] !== val);
        return chain;
      },
      order: () => chain,
      limit: (n: number) => {
        rows = rows.slice(0, n);
        return chain;
      },
      maybeSingle: () =>
        Promise.resolve({ data: rows[0] ?? null, error: null }),
      then: (onFulfilled: (v: { data: unknown; error: null }) => unknown) =>
        Promise.resolve({ data: rows, error: null }).then(onFulfilled),
    };
    return chain;
  }

  function rpc(name: string, params: Record<string, unknown>) {
    rpcCalls.push({ name, params });
    return Promise.resolve({
      data: config.rpcHandlers[name]?.(params) ?? null,
      error: null,
    });
  }

  return {
    client: { from, rpc } as unknown as PaonSupabaseClient,
    rpcCalls,
  };
}

function campaignRow(args: {
  readonly id: string;
  readonly retailerId: string;
}) {
  return {
    id: args.id,
    retailer_id: args.retailerId,
    kind: "private_offer",
    status: "active",
    title: "A private offer",
    summary: "Summary",
    explanation: "Because you're a valued client.",
    frequency: "daily",
    timezone: "UTC",
    preferred_local_hour: 0,
    quiet_start_minute: null,
    quiet_end_minute: null,
    starts_at: null,
    ends_at: null,
    reward_kind: null,
    reward_label: null,
    reward_cap_per_customer: 1,
    short_lived_offer_hours: null,
    created_by_staff_id: null,
    created_at: NOW,
    updated_at: NOW,
  };
}

function customerRow(args: { readonly id: string; readonly userId: string }) {
  return {
    id: args.id,
    retailer_id: "retailer-live",
    user_id: args.userId,
    deleted_at: null,
  };
}

describe("orchestrateCampaignDeliveries", () => {
  it("skips every customer of a campaign whose retailer has campaign_activation disabled, without considering any of them", async () => {
    const { client, rpcCalls } = createFakeClient({
      tables: {
        campaigns: [
          campaignRow({ id: "campaign-off", retailerId: "retailer-off" }),
        ],
        customers: [
          customerRow({ id: "customer-off", userId: "user-off" }),
        ].map((row) => ({ ...row, retailer_id: "retailer-off" })),
      },
      rpcHandlers: { retailer_module_job_enabled: () => false },
    });

    const result = await orchestrateCampaignDeliveries(client, NOW);

    expect(result).toEqual({
      considered: 0,
      queued: 0,
      skipped: 0,
      failed: 0,
    });
    expect(
      rpcCalls.filter((c) => c.name === "record_campaign_delivery_audit"),
    ).toHaveLength(0);
  });

  it("queues an in-app notification for a consented customer against a campaign with no audience rules", async () => {
    const { client, rpcCalls } = createFakeClient({
      tables: {
        campaigns: [
          campaignRow({ id: "campaign-live", retailerId: "retailer-live" }),
        ],
        customers: [customerRow({ id: "customer-live", userId: "user-live" })],
        customer_preferences: [
          {
            customer_id: "customer-live",
            personalization_opt_in: true,
            personalization_withdrawn_at: null,
            marketing_opt_in: false,
            marketing_withdrawn_at: null,
            location_opt_in: false,
            location_withdrawn_at: null,
            updated_at: NOW,
          },
        ],
      },
      rpcHandlers: {
        retailer_module_job_enabled: () => true,
        enqueue_campaign_delivery_notification: () => "notification-1",
        record_campaign_delivery_audit: () => "audit-1",
      },
    });

    const result = await orchestrateCampaignDeliveries(client, NOW);

    expect(result).toEqual({ considered: 1, queued: 1, skipped: 0, failed: 0 });

    const enqueueCalls = rpcCalls.filter(
      (c) => c.name === "enqueue_campaign_delivery_notification",
    );
    expect(enqueueCalls).toHaveLength(1);
    expect(enqueueCalls[0]?.params).toMatchObject({
      p_customer_id: "customer-live",
      p_channel: "in_app",
    });

    const auditCalls = rpcCalls.filter(
      (c) => c.name === "record_campaign_delivery_audit",
    );
    expect(auditCalls).toHaveLength(1);
    expect(auditCalls[0]?.params).toMatchObject({
      p_outcome: "queued_in_app",
      p_notification_id: "notification-1",
    });
  });

  it("skips a customer with no personalization consent and records the audit, without enqueuing anything", async () => {
    const { client, rpcCalls } = createFakeClient({
      tables: {
        campaigns: [
          campaignRow({ id: "campaign-live", retailerId: "retailer-live" }),
        ],
        customers: [
          customerRow({ id: "customer-nodenied", userId: "user-nodenied" }),
        ],
      },
      rpcHandlers: {
        retailer_module_job_enabled: () => true,
        record_campaign_delivery_audit: () => "audit-denied",
      },
    });

    const result = await orchestrateCampaignDeliveries(client, NOW);

    expect(result).toEqual({ considered: 1, queued: 0, skipped: 1, failed: 0 });
    expect(
      rpcCalls.filter(
        (c) => c.name === "enqueue_campaign_delivery_notification",
      ),
    ).toHaveLength(0);
    const auditCalls = rpcCalls.filter(
      (c) => c.name === "record_campaign_delivery_audit",
    );
    expect(auditCalls[0]?.params).toMatchObject({
      p_outcome: "skipped_consent_withdrawn",
      p_suppression_reason: "no_personalization_consent",
    });
  });

  it("does not enqueue a duplicate delivery for a customer already delivered to today", async () => {
    const { client, rpcCalls } = createFakeClient({
      tables: {
        campaigns: [
          campaignRow({ id: "campaign-live", retailerId: "retailer-live" }),
        ],
        customers: [customerRow({ id: "customer-dup", userId: "user-dup" })],
        customer_preferences: [
          {
            customer_id: "customer-dup",
            personalization_opt_in: true,
            personalization_withdrawn_at: null,
            marketing_opt_in: false,
            marketing_withdrawn_at: null,
            location_opt_in: false,
            location_withdrawn_at: null,
            updated_at: NOW,
          },
        ],
        campaign_delivery_audits: [
          {
            id: "audit-existing",
            campaign_id: "campaign-live",
            customer_id: "customer-dup",
            for_date: TODAY,
            outcome: "queued_in_app",
          },
        ],
      },
      rpcHandlers: {
        retailer_module_job_enabled: () => true,
        record_campaign_delivery_audit: () => "audit-2",
      },
    });

    const result = await orchestrateCampaignDeliveries(client, NOW);

    expect(result).toEqual({ considered: 1, queued: 0, skipped: 1, failed: 0 });
    const auditCalls = rpcCalls.filter(
      (c) => c.name === "record_campaign_delivery_audit",
    );
    expect(auditCalls[0]?.params).toMatchObject({
      p_outcome: "skipped_duplicate",
      p_suppression_reason: "duplicate_for_date",
    });
  });
});
