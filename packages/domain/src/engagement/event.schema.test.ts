import { describe, expect, it } from "vitest";

import { createEventSchema, eventRsvpSchema } from "./event.schema";

describe("event schemas", () => {
  const valid = {
    name: "Trunk show",
    description: "A private preview",
    startsAt: "2026-09-01T10:00:00.000Z",
    endsAt: "2026-09-01T12:00:00.000Z",
    venueName: "The salon",
    visibility: "public",
  };
  it("accepts an ordered event window", () => {
    expect(createEventSchema.safeParse(valid).success).toBe(true);
  });
  it("rejects an end before the start", () => {
    expect(
      createEventSchema.safeParse({
        ...valid,
        endsAt: "2026-09-01T09:00:00.000Z",
      }).success,
    ).toBe(false);
  });
  it("only accepts customer RSVP outcomes", () => {
    expect(
      eventRsvpSchema.safeParse({
        eventId: "11111111-1111-1111-1111-111111111111",
        status: "attended",
      }).success,
    ).toBe(false);
  });
});
