import { describe, expect, it } from "vitest";

import {
  checkClaimVisitSlot,
  checkCreateVisitSlot,
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

describe("checkCreateVisitSlot", () => {
  it("refuses an end time at or before the start time", () => {
    expect(
      checkCreateVisitSlot({
        startsAt: "2026-09-01T10:00:00.000Z",
        endsAt: "2026-09-01T10:00:00.000Z",
        capacity: 1,
      }),
    ).toEqual({ ok: false, reason: "invalid_time_window" });
  });

  it("refuses zero capacity", () => {
    expect(
      checkCreateVisitSlot({
        startsAt: "2026-09-01T10:00:00.000Z",
        endsAt: "2026-09-01T10:30:00.000Z",
        capacity: 0,
      }),
    ).toEqual({ ok: false, reason: "capacity_must_be_positive" });
  });

  it("refuses a non-integer capacity", () => {
    expect(
      checkCreateVisitSlot({
        startsAt: "2026-09-01T10:00:00.000Z",
        endsAt: "2026-09-01T10:30:00.000Z",
        capacity: 1.5,
      }),
    ).toEqual({ ok: false, reason: "capacity_must_be_positive" });
  });

  it("refuses a negative capacity", () => {
    expect(
      checkCreateVisitSlot({
        startsAt: "2026-09-01T10:00:00.000Z",
        endsAt: "2026-09-01T10:30:00.000Z",
        capacity: -1,
      }),
    ).toEqual({ ok: false, reason: "capacity_must_be_positive" });
  });

  it("accepts a real time window and positive capacity", () => {
    expect(
      checkCreateVisitSlot({
        startsAt: "2026-09-01T10:00:00.000Z",
        endsAt: "2026-09-01T10:30:00.000Z",
        capacity: 3,
      }),
    ).toEqual({ ok: true });
  });
});

describe("checkClaimVisitSlot", () => {
  const NOW = "2026-08-19T00:00:00.000Z";
  const FUTURE_SLOT = {
    capacity: 2,
    bookedCount: 0,
    startsAt: "2026-09-01T10:00:00.000Z",
  };

  it("accepts a future slot with spare capacity", () => {
    expect(checkClaimVisitSlot({ slot: FUTURE_SLOT, now: NOW })).toEqual({
      ok: true,
    });
  });

  it("refuses a slot that is already at capacity", () => {
    expect(
      checkClaimVisitSlot({
        slot: { ...FUTURE_SLOT, bookedCount: 2 },
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: "slot_full" });
  });

  it("refuses a slot booked beyond capacity (defensive — should never actually occur)", () => {
    expect(
      checkClaimVisitSlot({
        slot: { ...FUTURE_SLOT, bookedCount: 3 },
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: "slot_full" });
  });

  it("refuses a canceled slot even with spare capacity", () => {
    expect(
      checkClaimVisitSlot({
        slot: { ...FUTURE_SLOT, canceledAt: "2026-08-18T00:00:00.000Z" },
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: "slot_canceled" });
  });

  it("refuses a slot whose start time has already passed", () => {
    expect(
      checkClaimVisitSlot({
        slot: { ...FUTURE_SLOT, startsAt: "2026-08-01T10:00:00.000Z" },
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: "slot_in_past" });
  });

  it("refuses a slot starting at exactly now (not strictly future)", () => {
    expect(
      checkClaimVisitSlot({
        slot: { ...FUTURE_SLOT, startsAt: NOW },
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: "slot_in_past" });
  });

  it("cancellation is checked before capacity — a canceled full slot still reports canceled", () => {
    expect(
      checkClaimVisitSlot({
        slot: {
          ...FUTURE_SLOT,
          bookedCount: 2,
          canceledAt: "2026-08-18T00:00:00.000Z",
        },
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: "slot_canceled" });
  });
});
