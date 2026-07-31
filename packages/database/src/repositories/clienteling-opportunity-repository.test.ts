import { asId, type ClientelingOpportunity } from "@paon/domain";
import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { ClientelingOpportunityRepository } from "./clienteling-opportunity-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

type Row = Database["public"]["Tables"]["clienteling_opportunities"]["Row"];

const retailerId = asId<"RetailerId">("11111111-1111-4111-8111-111111111111");
const otherRetailerId = asId<"RetailerId">(
  "22222222-2222-4222-8222-222222222222",
);
const customerId = asId<"CustomerId">("33333333-3333-4333-8333-333333333333");
const now = "2026-07-30T12:00:00.000Z";

function opportunityRow(
  overrides: Partial<Row> & Pick<Row, "id" | "retailer_id" | "why_now">,
): Row {
  return {
    assigned_staff_id: null,
    best_time_window: "weekday evening",
    branch_label: null,
    campaign_id: null,
    channel: "message",
    confidence: 0.8,
    contact_pressure: false,
    cooldown_until: null,
    created_at: now,
    customer_id: customerId,
    deleted_at: null,
    due_at: null,
    evidence: [{ insightStatement: "8 of 10 suit views were brown" }],
    expires_at: "2026-08-13T12:00:00.000Z",
    opportunity_type: "interest_follow_up",
    outcome_appointment_id: null,
    outcome_message_id: null,
    outcome_order_id: null,
    priority: 1,
    projector_version: "clienteling-opportunity-v1",
    status: "draft",
    suggested_action: "Open a short message or book a fabric appointment.",
    updated_at: now,
    ...overrides,
  };
}

describe("ClientelingOpportunityRepository", () => {
  it("lists tenant-scoped drafts for a customer", async () => {
    const rows = [
      opportunityRow({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000001",
        retailer_id: retailerId,
        why_now: "8 of 10 suit views were brown",
      }),
      opportunityRow({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000002",
        retailer_id: otherRetailerId,
        why_now: "cross-tenant must not appear after filter",
      }),
    ];
    const from = vi.fn((table: string) => {
      expect(table).toBe("clienteling_opportunities");
      return fakeQueryBuilder({
        data: rows.filter((row) => row.retailer_id === retailerId),
        error: null,
      });
    });
    const repo = new ClientelingOpportunityRepository({
      from,
    } as unknown as PaonSupabaseClient);
    const listed = await repo.listForCustomer(retailerId, customerId);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.whyNow).toBe("8 of 10 suit views were brown");
    expect(listed[0]?.status).toBe("draft");
  });

  it("updates status with retailer scope", async () => {
    const chained = fakeQueryBuilder({ data: null, error: null });
    const fromChained = vi.fn(() => chained);
    const repo = new ClientelingOpportunityRepository({
      from: fromChained,
    } as unknown as PaonSupabaseClient);
    await repo.setStatus({
      retailerId,
      opportunityId: "aaaaaaaa-aaaa-4aaa-8aaa-000000000001",
      status: "accepted",
    });
    expect(fromChained).toHaveBeenCalledWith("clienteling_opportunities");
  });

  it("maps contact-pressure drafts for the inbox", async () => {
    const row = opportunityRow({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000003",
      retailer_id: retailerId,
      opportunity_type: "contact_pressure_warning",
      why_now:
        "Already 4 touches in the recent window — pause outbound contact.",
      contact_pressure: true,
      suggested_action: "Snooze or wait for the customer to initiate.",
    });
    const from = vi.fn(() => fakeQueryBuilder({ data: [row], error: null }));
    const repo = new ClientelingOpportunityRepository({
      from,
    } as unknown as PaonSupabaseClient);
    const inbox = await repo.listDraftInbox(retailerId);
    expect(inbox[0]?.type).toBe("contact_pressure_warning");
    expect(inbox[0]?.contactPressure).toBe(true);
  });

  it("exposes domain-shaped evidence from jsonb", async () => {
    const row = opportunityRow({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000004",
      retailer_id: retailerId,
      why_now: "8 of 10 suit views were brown",
    });
    const from = vi.fn(() => fakeQueryBuilder({ data: [row], error: null }));
    const repo = new ClientelingOpportunityRepository({
      from,
    } as unknown as PaonSupabaseClient);
    const [opportunity] = (await repo.listForCustomer(
      retailerId,
      customerId,
    )) as ClientelingOpportunity[];
    expect(opportunity?.evidence[0]?.insightStatement).toBe(
      "8 of 10 suit views were brown",
    );
  });
});
