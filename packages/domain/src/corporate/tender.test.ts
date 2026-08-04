import { describe, expect, it } from "vitest";

import { checkCreateTender, checkCreateTenderVersion } from "./tender";

describe("checkCreateTender", () => {
  it("refuses a blank title", () => {
    expect(
      checkCreateTender({ title: "  ", opportunityStage: "qualified" }),
    ).toEqual({ ok: false, reason: "title_required" });
  });

  it("refuses a tender against a lost opportunity", () => {
    expect(
      checkCreateTender({ title: "Acme rollout", opportunityStage: "lost" }),
    ).toEqual({ ok: false, reason: "opportunity_lost" });
  });

  it("accepts a real title against a live opportunity", () => {
    expect(
      checkCreateTender({
        title: "Acme rollout",
        opportunityStage: "tender_sent",
      }),
    ).toEqual({ ok: true });
  });
});

describe("checkCreateTenderVersion", () => {
  it("refuses a blank summary", () => {
    expect(
      checkCreateTenderVersion({ summary: "", garmentConcepts: ["Suit"] }),
    ).toEqual({ ok: false, reason: "summary_required" });
  });

  it("refuses an empty garment-concept list", () => {
    expect(
      checkCreateTenderVersion({ summary: "Overview", garmentConcepts: [] }),
    ).toEqual({ ok: false, reason: "garment_concepts_required" });
  });

  it("refuses a garment-concept list of only blanks", () => {
    expect(
      checkCreateTenderVersion({
        summary: "Overview",
        garmentConcepts: ["  ", ""],
      }),
    ).toEqual({ ok: false, reason: "garment_concepts_required" });
  });

  it("accepts a real summary and concept list", () => {
    expect(
      checkCreateTenderVersion({
        summary: "Overview",
        garmentConcepts: ["Two-piece suit", "Overcoat"],
      }),
    ).toEqual({ ok: true });
  });
});
