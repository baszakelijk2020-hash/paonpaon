import { describe, expect, it } from "vitest";

import { formatMoney } from "./format-money";

describe("formatMoney", () => {
  it("formats minor units as a localized currency string", () => {
    expect(
      formatMoney({ amountMinorUnits: 129900, currency: "USD" }, "en-US"),
    ).toBe("$1,299.00");
  });
});
