import { describe, expect, it } from "vitest";

import { commercialInquiryInputSchema } from "./commercial-inquiry.schema";

describe("commercialInquiryInputSchema", () => {
  const valid = {
    inquiryType: "personalized_demo",
    companyName: "Maison Exemple",
    contactName: "Amelia Retailer",
    email: "AMELIA@example.com",
    websiteUrl: "https://example.com",
    objective: "Connect fittings to a composed private-client experience.",
    requestedPlanKey: "half_canvas_monthly",
  };

  it("accepts a bounded commercial request and normalizes optional blanks", () => {
    const result = commercialInquiryInputSchema.parse({
      ...valid,
      websiteUrl: "",
    });
    expect(result.websiteUrl).toBeUndefined();
    expect(result.inquiryType).toBe("personalized_demo");
  });

  it("rejects an invalid intent, email, URL or thin objective", () => {
    expect(
      commercialInquiryInputSchema.safeParse({
        ...valid,
        inquiryType: "free_trial",
      }).success,
    ).toBe(false);
    expect(
      commercialInquiryInputSchema.safeParse({ ...valid, email: "nope" })
        .success,
    ).toBe(false);
    expect(
      commercialInquiryInputSchema.safeParse({
        ...valid,
        websiteUrl: "example",
      }).success,
    ).toBe(false);
    expect(
      commercialInquiryInputSchema.safeParse({ ...valid, objective: "Demo" })
        .success,
    ).toBe(false);
  });
});
