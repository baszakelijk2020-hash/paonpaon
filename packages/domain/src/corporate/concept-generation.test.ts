import { describe, expect, it } from "vitest";

import { checkDecideConceptAsset } from "./concept-generation";

describe("checkDecideConceptAsset", () => {
  it("allows deciding a pending asset", () => {
    expect(checkDecideConceptAsset({ status: "pending_approval" })).toEqual({
      ok: true,
    });
  });

  it("refuses re-deciding an already approved asset", () => {
    expect(checkDecideConceptAsset({ status: "approved" })).toEqual({
      ok: false,
      reason: "already_decided",
    });
  });

  it("refuses re-deciding an already rejected asset", () => {
    expect(checkDecideConceptAsset({ status: "rejected" })).toEqual({
      ok: false,
      reason: "already_decided",
    });
  });
});
