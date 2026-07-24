import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";

import { CommercialInquiryRepository } from "./commercial-inquiry-repository";

describe("CommercialInquiryRepository", () => {
  it("submits only through the narrow public RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: "11111111-1111-1111-1111-111111111111",
      error: null,
    });
    const repository = new CommercialInquiryRepository({
      rpc,
    } as unknown as PaonSupabaseClient);

    await expect(
      repository.submit({
        inquiryType: "paid_pilot",
        companyName: "Maison Exemple",
        contactName: "Amelia Retailer",
        email: "amelia@example.com",
        objective: "Prove one fitting-to-pickup outcome with our team.",
      }),
    ).resolves.toBe("11111111-1111-1111-1111-111111111111");
    expect(rpc).toHaveBeenCalledWith("submit_commercial_inquiry", {
      p_inquiry_type: "paid_pilot",
      p_company_name: "Maison Exemple",
      p_contact_name: "Amelia Retailer",
      p_email: "amelia@example.com",
      p_website_url: "",
      p_objective: "Prove one fitting-to-pickup outcome with our team.",
      p_requested_plan_key: "",
    });
  });

  it("does not present a database failure as a successful request", async () => {
    const repository = new CommercialInquiryRepository({
      rpc: vi
        .fn()
        .mockResolvedValue({ data: null, error: new Error("unavailable") }),
    } as unknown as PaonSupabaseClient);

    await expect(
      repository.submit({
        inquiryType: "consultation",
        companyName: "Maison Exemple",
        contactName: "Amelia Retailer",
        email: "amelia@example.com",
        objective: "Map our operational needs to the right package.",
      }),
    ).rejects.toThrow("unavailable");
  });
});
