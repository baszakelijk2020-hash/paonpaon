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
  date_of_birth: null,
  profile_photo_url: null,
  one_click_checkout_status: "not_requested",
  one_click_requested_at: null,
  one_click_activated_at: null,
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

  it("maps dateOfBirth, profilePhotoUrl, oneClickCheckoutStatus, oneClickRequestedAt, oneClickActivatedAt fields", async () => {
    const rowWithProfile: CustomerRow = {
      ...row,
      date_of_birth: "1990-06-15",
      profile_photo_url: "https://example.com/photo.jpg",
      one_click_checkout_status: "eligible",
      one_click_requested_at: "2026-01-10T12:00:00.000Z",
      one_click_activated_at: "2026-01-15T12:00:00.000Z",
    };
    const repo = new CustomerRepository(
      clientReturning({ data: rowWithProfile, error: null }),
    );
    const customer = await repo.findById(row.id as never);

    expect(customer).not.toBeNull();
    expect(customer?.dateOfBirth).toBe("1990-06-15");
    expect(customer?.profilePhotoUrl).toBe("https://example.com/photo.jpg");
    expect(customer?.oneClickCheckoutStatus).toBe("eligible");
    expect(customer?.oneClickRequestedAt).toBe("2026-01-10T12:00:00.000Z");
    expect(customer?.oneClickActivatedAt).toBe("2026-01-15T12:00:00.000Z");
  });

  it("omits dateOfBirth, profilePhotoUrl, oneClickRequestedAt, oneClickActivatedAt when null", async () => {
    const repo = new CustomerRepository(
      clientReturning({ data: row, error: null }),
    );
    const customer = await repo.findById(row.id as never);

    expect(customer).not.toBeNull();
    expect("dateOfBirth" in (customer ?? {})).toBe(false);
    expect("profilePhotoUrl" in (customer ?? {})).toBe(false);
    expect("oneClickRequestedAt" in (customer ?? {})).toBe(false);
    expect("oneClickActivatedAt" in (customer ?? {})).toBe(false);
  });

  it("always maps oneClickCheckoutStatus (never omitted)", async () => {
    const repo = new CustomerRepository(
      clientReturning({ data: row, error: null }),
    );
    const customer = await repo.findById(row.id as never);

    expect(customer).not.toBeNull();
    expect(customer?.oneClickCheckoutStatus).toBe("not_requested");
  });

  it("upsertMyLabeledAddress calls the RPC with correct parameters", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const client = { rpc } as unknown as PaonSupabaseClient;
    const repo = new CustomerRepository(client);

    await repo.upsertMyLabeledAddress(row.retailer_id as never, "home", {
      line1: "123 Main St",
      city: "New York",
      postalCode: "10001",
      countryCode: "US",
    });

    expect(rpc).toHaveBeenCalledWith("upsert_my_labeled_address", {
      p_retailer_id: row.retailer_id,
      p_label: "home",
      p_address: {
        line1: "123 Main St",
        city: "New York",
        postalCode: "10001",
        countryCode: "US",
      },
    });
  });

  it("upsertMyLabeledAddress rejects when the RPC errors", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: new Error("Address validation failed"),
    });
    const client = { rpc } as unknown as PaonSupabaseClient;
    const repo = new CustomerRepository(client);

    await expect(
      repo.upsertMyLabeledAddress(row.retailer_id as never, "home", {
        line1: "",
        city: "New York",
        postalCode: "10001",
        countryCode: "US",
      }),
    ).rejects.toBeTruthy();
  });

  it("updateMyProfileDetails calls the RPC with correct parameters", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const client = { rpc } as unknown as PaonSupabaseClient;
    const repo = new CustomerRepository(client);

    await repo.updateMyProfileDetails(row.retailer_id as never, {
      fullName: "Jane Updated",
      dateOfBirth: "1990-06-15",
      profilePhotoUrl: "https://example.com/new-photo.jpg",
    });

    expect(rpc).toHaveBeenCalledWith("update_my_profile_details", {
      p_retailer_id: row.retailer_id,
      p_full_name: "Jane Updated",
      p_date_of_birth: "1990-06-15",
      p_profile_photo_url: "https://example.com/new-photo.jpg",
    });
  });

  it("updateMyProfileDetails accepts null date_of_birth and profile_photo_url to clear fields", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const client = { rpc } as unknown as PaonSupabaseClient;
    const repo = new CustomerRepository(client);

    await repo.updateMyProfileDetails(row.retailer_id as never, {
      fullName: "Jane",
      dateOfBirth: null,
      profilePhotoUrl: null,
    });

    expect(rpc).toHaveBeenCalledWith("update_my_profile_details", {
      p_retailer_id: row.retailer_id,
      p_full_name: "Jane",
      p_date_of_birth: null,
      p_profile_photo_url: null,
    });
  });

  it("updateMyProfileDetails rejects when the RPC errors", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: new Error("Full name required"),
    });
    const client = { rpc } as unknown as PaonSupabaseClient;
    const repo = new CustomerRepository(client);

    await expect(
      repo.updateMyProfileDetails(row.retailer_id as never, {
        fullName: "",
        dateOfBirth: null,
        profilePhotoUrl: null,
      }),
    ).rejects.toBeTruthy();
  });

  it("requestMyOneClickCheckoutEligibility calls the RPC and returns the status", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: "pending_review", error: null });
    const client = { rpc } as unknown as PaonSupabaseClient;
    const repo = new CustomerRepository(client);

    const status = await repo.requestMyOneClickCheckoutEligibility(
      row.retailer_id as never,
    );

    expect(rpc).toHaveBeenCalledWith("request_one_click_checkout_eligibility", {
      p_retailer_id: row.retailer_id,
    });
    expect(status).toBe("pending_review");
  });

  it("requestMyOneClickCheckoutEligibility is idempotent, returning current status on repeat calls", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: "pending_review", error: null })
      .mockResolvedValueOnce({ data: "pending_review", error: null });
    const client = { rpc } as unknown as PaonSupabaseClient;
    const repo = new CustomerRepository(client);

    const status1 = await repo.requestMyOneClickCheckoutEligibility(
      row.retailer_id as never,
    );
    const status2 = await repo.requestMyOneClickCheckoutEligibility(
      row.retailer_id as never,
    );

    expect(status1).toBe("pending_review");
    expect(status2).toBe("pending_review");
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("requestMyOneClickCheckoutEligibility rejects when the RPC errors", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: new Error("Customer relationship not found"),
    });
    const client = { rpc } as unknown as PaonSupabaseClient;
    const repo = new CustomerRepository(client);

    await expect(
      repo.requestMyOneClickCheckoutEligibility(row.retailer_id as never),
    ).rejects.toBeTruthy();
  });
});
