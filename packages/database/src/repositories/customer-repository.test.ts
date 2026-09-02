import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { CustomerRepository } from "./customer-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];

const row: CustomerRow = {
  id: "44444444-4444-4444-4444-444444444444",
  retailer_id: "11111111-1111-1111-1111-111111111111",
  user_id: null,
  full_name: "Jane Shopper",
  email: "jane@example.com",
  phone: null,
  lifecycle_stage: "prospect",
  assigned_staff_id: null,
  corporate_account_id: null,
  shipping_addresses: [],
  acquisition_source: null,
  preferred_carrier: null,
  tags: [],
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  deleted_at: null,
};

function clientReturning(result: {
  data: unknown;
  error: unknown;
}): PaonSupabaseClient {
  return {
    from: () => fakeQueryBuilder(result as never),
  } as unknown as PaonSupabaseClient;
}

describe("CustomerRepository", () => {
  it("maps a row to a domain Customer, omitting null optional fields", async () => {
    const repo = new CustomerRepository(
      clientReturning({ data: row, error: null }),
    );
    const customer = await repo.findById(row.id as never);

    expect(customer).not.toBeNull();
    expect(customer?.fullName).toBe("Jane Shopper");
    expect(customer?.lifecycleStage).toBe("prospect");
    expect("userId" in (customer ?? {})).toBe(false);
    expect("phone" in (customer ?? {})).toBe(false);
    expect("assignedStaffId" in (customer ?? {})).toBe(false);
  });

  it("returns null when no row is found", async () => {
    const repo = new CustomerRepository(
      clientReturning({ data: null, error: null }),
    );
    const customer = await repo.findById("missing" as never);
    expect(customer).toBeNull();
  });

  it("maps a list of rows in findByRetailer()", async () => {
    const repo = new CustomerRepository(
      clientReturning({ data: [row], error: null }),
    );
    const customers = await repo.findByRetailer(row.retailer_id as never);
    expect(customers).toHaveLength(1);
    expect(customers[0]?.email).toBe("jane@example.com");
  });

  it("maps a list of rows in findByUserId()", async () => {
    const linkedRow = {
      ...row,
      user_id: "55555555-5555-5555-5555-555555555555",
    };
    const repo = new CustomerRepository(
      clientReturning({ data: [linkedRow], error: null }),
    );
    const customers = await repo.findByUserId(linkedRow.user_id as never);
    expect(customers).toHaveLength(1);
    expect(customers[0]?.userId).toBe(linkedRow.user_id);
  });

  it("create() maps the inserted row back to a domain Customer", async () => {
    const repo = new CustomerRepository(
      clientReturning({ data: row, error: null }),
    );
    const customer = await repo.create({
      retailerId: row.retailer_id as never,
      fullName: row.full_name,
      email: row.email ?? "jane@example.com",
      lifecycleStage: "prospect",
    });
    expect(customer.fullName).toBe("Jane Shopper");
  });

  it("linkMyAccounts calls the link_my_customer_accounts RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const client = { rpc } as unknown as PaonSupabaseClient;
    const repo = new CustomerRepository(client);

    await repo.linkMyAccounts();

    expect(rpc).toHaveBeenCalledWith("link_my_customer_accounts");
  });

  it("linkMyAccounts rejects when the RPC errors", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: new Error("boom") });
    const client = { rpc } as unknown as PaonSupabaseClient;
    const repo = new CustomerRepository(client);

    await expect(repo.linkMyAccounts()).rejects.toBeTruthy();
  });
});
