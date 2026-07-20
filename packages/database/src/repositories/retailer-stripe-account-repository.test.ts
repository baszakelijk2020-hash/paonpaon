import { describe, expect, it } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { RetailerStripeAccountRepository } from "./retailer-stripe-account-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

type RetailerStripeAccountRow =
  Database["public"]["Tables"]["retailer_stripe_accounts"]["Row"];

const accountRow: RetailerStripeAccountRow = {
  retailer_id: "11111111-1111-1111-1111-111111111111",
  stripe_account_id: "acct_123",
  charges_enabled: false,
  payouts_enabled: false,
  details_submitted: false,
  platform_fee_basis_points: 0,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

function clientReturning(result: {
  data: unknown;
  error: unknown;
}): PaonSupabaseClient {
  return {
    from: () => fakeQueryBuilder(result as never),
  } as unknown as PaonSupabaseClient;
}

describe("RetailerStripeAccountRepository", () => {
  it("maps a row to a domain RetailerStripeAccount", async () => {
    const repo = new RetailerStripeAccountRepository(
      clientReturning({ data: accountRow, error: null }),
    );
    const account = await repo.findByRetailer(accountRow.retailer_id as never);
    expect(account?.stripeAccountId).toBe("acct_123");
    expect(account?.chargesEnabled).toBe(false);
    expect(account?.platformFeeBasisPoints).toBe(0);
  });

  it("returns null when the retailer has not started Connect onboarding", async () => {
    const repo = new RetailerStripeAccountRepository(
      clientReturning({ data: null, error: null }),
    );
    expect(await repo.findByRetailer("nonexistent" as never)).toBeNull();
  });

  it("create inserts the initial row and returns the mapped domain object", async () => {
    const repo = new RetailerStripeAccountRepository(
      clientReturning({ data: accountRow, error: null }),
    );
    const account = await repo.create(
      accountRow.retailer_id as never,
      "acct_123",
    );
    expect(account.stripeAccountId).toBe("acct_123");
  });

  it("syncCapabilities and updatePlatformFee throw on a repository error", async () => {
    const repo = new RetailerStripeAccountRepository(
      clientReturning({ data: null, error: new Error("boom") }),
    );
    await expect(
      repo.syncCapabilities("acct_123", {
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
      }),
    ).rejects.toThrow("boom");
    await expect(
      repo.updatePlatformFee(accountRow.retailer_id as never, 250),
    ).rejects.toThrow("boom");
  });
});
