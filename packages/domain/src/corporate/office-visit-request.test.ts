import { describe, expect, it } from "vitest";

import {
  checkResolveOfficeVisitRequest,
  checkScheduleOfficeVisitAppointment,
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

describe("checkScheduleOfficeVisitAppointment", () => {
  it("refuses scheduling a real appointment with no contact email", () => {
    expect(
      checkScheduleOfficeVisitAppointment({
        startsAt: "2026-09-01T10:00:00.000Z",
        endsAt: "2026-09-01T10:30:00.000Z",
      }),
    ).toEqual({ ok: false, reason: "contact_email_required" });
  });

  it("refuses a blank contact email", () => {
    expect(
      checkScheduleOfficeVisitAppointment({
        contactEmail: "  ",
        startsAt: "2026-09-01T10:00:00.000Z",
        endsAt: "2026-09-01T10:30:00.000Z",
      }),
    ).toEqual({ ok: false, reason: "contact_email_required" });
  });

  it("refuses an end time at or before the start time", () => {
    expect(
      checkScheduleOfficeVisitAppointment({
        contactEmail: "a@example.com",
        startsAt: "2026-09-01T10:00:00.000Z",
        endsAt: "2026-09-01T10:00:00.000Z",
      }),
    ).toEqual({ ok: false, reason: "invalid_time_window" });
  });

  it("accepts a real contact email and a real time window", () => {
    expect(
      checkScheduleOfficeVisitAppointment({
        contactEmail: "a@example.com",
        startsAt: "2026-09-01T10:00:00.000Z",
        endsAt: "2026-09-01T10:30:00.000Z",
      }),
    ).toEqual({ ok: true });
  });
});
