import { describe, expect, it } from "vitest";

import {
  createAppointmentInputSchema,
  createAvailabilityWindowInputSchema,
  requestAppointmentInputSchema,
  updateAppointmentInputSchema,
} from "./appointment.schema";

describe("requestAppointmentInputSchema", () => {
  const valid = {
    retailerId: "11111111-1111-1111-1111-111111111111",
    type: "styling_consultation",
    startsAt: "2026-08-01T14:00:00.000Z",
    endsAt: "2026-08-01T15:00:00.000Z",
  };

  it("accepts a valid payload without notes", () => {
    const result = requestAppointmentInputSchema.parse(valid);
    expect(result.notes).toBeUndefined();
  });

  it("rejects an unsupported appointment type", () => {
    const result = requestAppointmentInputSchema.safeParse({
      ...valid,
      type: "coffee_chat",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-ISO startsAt", () => {
    const result = requestAppointmentInputSchema.safeParse({
      ...valid,
      startsAt: "next Tuesday",
    });
    expect(result.success).toBe(false);
  });
});

describe("createAppointmentInputSchema", () => {
  const valid = {
    customerId: "44444444-4444-4444-4444-444444444444",
    type: "fitting",
    startsAt: "2026-08-01T14:00:00.000Z",
    endsAt: "2026-08-01T15:00:00.000Z",
  };

  it("accepts a valid payload without staffId", () => {
    const result = createAppointmentInputSchema.parse(valid);
    expect(result.staffId).toBeUndefined();
  });

  it("accepts an optional staff assignment", () => {
    const result = createAppointmentInputSchema.parse({
      ...valid,
      staffId: "55555555-5555-5555-5555-555555555555",
    });
    expect(result.staffId).toBe("55555555-5555-5555-5555-555555555555");
  });

  it("rejects a non-uuid customerId", () => {
    const result = createAppointmentInputSchema.safeParse({
      ...valid,
      customerId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateAppointmentInputSchema", () => {
  it("accepts a status-only update", () => {
    const result = updateAppointmentInputSchema.safeParse({
      status: "confirmed",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a staff-assignment-only update", () => {
    const result = updateAppointmentInputSchema.safeParse({
      staffId: "22222222-2222-2222-2222-222222222222",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unsupported status", () => {
    const result = updateAppointmentInputSchema.safeParse({
      status: "rescheduled",
    });
    expect(result.success).toBe(false);
  });
});

describe("createAvailabilityWindowInputSchema", () => {
  const valid = {
    staffId: "33333333-3333-3333-3333-333333333333",
    dayOfWeek: "3",
    startTime: "09:00",
    endTime: "12:00",
  };

  it("accepts a valid payload and coerces dayOfWeek", () => {
    const result = createAvailabilityWindowInputSchema.parse(valid);
    expect(result.dayOfWeek).toBe(3);
  });

  it("rejects a malformed time", () => {
    const result = createAvailabilityWindowInputSchema.safeParse({
      ...valid,
      startTime: "9am",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a start time after the end time", () => {
    const result = createAvailabilityWindowInputSchema.safeParse({
      ...valid,
      startTime: "13:00",
      endTime: "09:00",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a dayOfWeek out of range", () => {
    const result = createAvailabilityWindowInputSchema.safeParse({
      ...valid,
      dayOfWeek: "7",
    });
    expect(result.success).toBe(false);
  });
});
