import { describe, expect, it } from "vitest";

import { MorningRoutineDeliveryRepository } from "./morning-routine-delivery-repository";

describe("MorningRoutineDeliveryRepository", () => {
  it("exposes subscription, delivery audit, and retailer settings methods", () => {
    const repo = new MorningRoutineDeliveryRepository({} as never);
    expect(typeof repo.findSubscription).toBe("function");
    expect(typeof repo.upsertSubscription).toBe("function");
    expect(typeof repo.recordDelivery).toBe("function");
    expect(typeof repo.getRetailerSettings).toBe("function");
    expect(typeof repo.upsertRetailerSettings).toBe("function");
    expect(typeof repo.listActiveSubscriptions).toBe("function");
  });
});
