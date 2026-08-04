import { describe, expect, it } from "vitest";

import {
  checkResolveOfficeVisitRequest,
  checkSubmitOfficeVisitRequest,
} from "./office-visit-request";

describe("checkSubmitOfficeVisitRequest", () => {
  it("refuses a blank requester name", () => {
    expect(checkSubmitOfficeVisitRequest({ requesterName: "  " })).toEqual({
      ok: false,
      reason: "requester_name_required",
    });
  });

  it("accepts a real requester name", () => {
    expect(
      checkSubmitOfficeVisitRequest({ requesterName: "A. Employee" }),
    ).toEqual({ ok: true });
  });
});

describe("checkResolveOfficeVisitRequest", () => {
  it("allows resolving an open request", () => {
    expect(checkResolveOfficeVisitRequest({ currentStatus: "open" })).toEqual({
      ok: true,
    });
  });

  it("allows resolving a contacted request", () => {
    expect(
      checkResolveOfficeVisitRequest({ currentStatus: "contacted" }),
    ).toEqual({ ok: true });
  });

  it("refuses resolving an already-scheduled request", () => {
    expect(
      checkResolveOfficeVisitRequest({ currentStatus: "scheduled" }),
    ).toEqual({ ok: false, reason: "already_resolved" });
  });

  it("refuses resolving an already-declined request", () => {
    expect(
      checkResolveOfficeVisitRequest({ currentStatus: "declined" }),
    ).toEqual({ ok: false, reason: "already_resolved" });
  });
});
