import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";

import { WeddingPartyRepository } from "./wedding-party-repository";

describe("WeddingPartyRepository.redeemGuestVoucherAsCustomer", () => {
  it("calls the redeem_wedding_guest_voucher RPC with the voucher id", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { ok: true }, error: null });
    const client = { rpc } as unknown as PaonSupabaseClient;
    const repo = new WeddingPartyRepository(client);

    await repo.redeemGuestVoucherAsCustomer(
      "e0000000-0000-0000-0000-000000000001" as never,
    );

    expect(rpc).toHaveBeenCalledWith("redeem_wedding_guest_voucher", {
      p_voucher_id: "e0000000-0000-0000-0000-000000000001",
    });
  });

  it("throws the underlying error rather than swallowing a rejection", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: new Error("This voucher has already been redeemed"),
    });
    const client = { rpc } as unknown as PaonSupabaseClient;
    const repo = new WeddingPartyRepository(client);

    await expect(
      repo.redeemGuestVoucherAsCustomer(
        "e0000000-0000-0000-0000-000000000001" as never,
      ),
    ).rejects.toThrow("This voucher has already been redeemed");
  });
});
