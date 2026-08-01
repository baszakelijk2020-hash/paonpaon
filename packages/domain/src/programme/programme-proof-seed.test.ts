import { describe, expect, it } from "vitest";

import {
  getProgrammeProofSeedDescriptor,
  PROGRAMME_PROOF_SEED_ID,
} from "./programme-proof-seed";

describe("programme proof seed descriptor", () => {
  it("exposes stable linked retailer/customer/advisor/manager identities", () => {
    const seed = getProgrammeProofSeedDescriptor();
    expect(seed.seedId).toBe(PROGRAMME_PROOF_SEED_ID);
    expect(seed.retailerSlug).toBe("paon-programme-proof");
    expect(seed.personas.manager.email).toContain(seed.retailerSlug);
    expect(seed.personas.customer.email).toContain(seed.retailerSlug);
    expect(seed.personas.advisor.email).toContain("sales");
    expect(seed.personas.manager.email).toContain("manager");
    expect(seed.personas.customer.email).toContain("julien");
    expect(seed.journey.originRole).toBe("sales_associate");
    expect(seed.journey.receiverRole).toBe("manager");
    expect(seed.journey.deniedRole).toBe("worker");
    expect(seed.markers.appointmentMarker.length).toBeGreaterThan(0);
  });
});
