import { asId } from "@paon/domain";
import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";

import { ClientelingOpportunityRepository } from "./clienteling-opportunity-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

const retailerId = asId<"RetailerId">("11111111-1111-4111-8111-111111111111");
const customerId = asId<"CustomerId">("33333333-3333-4333-8333-333333333333");
const staffId = asId<"StaffId">("55555555-5555-4555-8555-555555555555");
const now = "2026-07-30T12:00:00.000Z";

describe("ClientelingOpportunityRepository", () => {
  it("projects drafts from analytics and interest inputs", async () => {
    const analytics = {
      findRecentByCustomer: vi.fn().mockResolvedValue([
        {
          id: asId<"BehavioralEventId">("bbbbbbbb-bbbb-4bbb-8bbb-000000000001"),
          retailerId,
          customerId,
          name: "appointment_intent",
          properties: {},
          occurredAt: "2026-07-29T15:00:00.000Z",
          source: "customer_portal",
          purpose: "personalization",
          consentBasis: "explicit_opt_in",
          consentSnapshot: {
            personalization: "granted",
            marketing: "denied",
            location: "denied",
            capturedAt: now,
            basis: "explicit_opt_in",
          },
          retentionClass: "personalization_signal",
          retentionExpiresAt: "2027-07-30T12:00:00.000Z",
        },
      ]),
    };
    const interest = {
      projectForCustomer: vi.fn().mockResolvedValue({
        retailerId,
        customerId,
        visibility: "usable",
        insights: [],
        emptyStateCopy: "None",
        windowStart: now,
        windowEnd: now,
        projectorVersion: "customer-interest-v1",
      }),
    };
    const notes = { findByCustomer: vi.fn().mockResolvedValue([]) };
    const client = {
      from: vi.fn(() =>
        fakeQueryBuilder<{ projector_key: string }[]>({
          data: [],
          error: null,
        }),
      ),
    } as unknown as PaonSupabaseClient;

    const repo = new ClientelingOpportunityRepository(client, {
      analytics: analytics as never,
      interest: interest as never,
      notes: notes as never,
    });

    const drafts = await repo.projectDraftsForCustomer({
      retailerId,
      customerId,
      customerName: "James Hart",
      viewerRetailerId: retailerId,
      now,
    });

    expect(
      drafts.some((draft) => draft.hookKind === "appointment_intent"),
    ).toBe(true);
  });

  it("records outcomes through RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        id: "99999999-9999-4999-8999-999999999999",
        retailer_id: retailerId,
        customer_id: customerId,
        hook_kind: "appointment_intent",
        projector_key: "key",
        projector_version: "clienteling-opportunity-v1",
        title: "Intent",
        why_now: "Why",
        suggested_action: "book_appointment",
        suggested_channel: "phone",
        suggested_at: now,
        status: "completed",
        priority: 90,
        confidence: 0.85,
        due_at: now,
        expires_at: now,
        assigned_staff_id: staffId,
        evidence: [],
        feedback_note: null,
        outcome_type: "appointment_booked",
        outcome_message_id: null,
        outcome_appointment_id: null,
        outcome_order_id: null,
        outcome_recorded_at: now,
        outcome_staff_id: staffId,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      },
      error: null,
    });
    const client = { rpc } as unknown as PaonSupabaseClient;
    const repo = new ClientelingOpportunityRepository(client);

    const result = await repo.recordOutcome({
      opportunityId: "99999999-9999-4999-8999-999999999999",
      outcomeType: "appointment_booked",
      staffId,
    });

    expect(rpc).toHaveBeenCalledWith(
      "record_clienteling_opportunity_outcome",
      expect.objectContaining({
        p_outcome_type: "appointment_booked",
        p_staff_id: staffId,
      }),
    );
    expect(result.status).toBe("completed");
    expect(result.outcomeType).toBe("appointment_booked");
  });
});
