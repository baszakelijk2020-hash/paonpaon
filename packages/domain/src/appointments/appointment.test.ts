import { describe, expect, it } from "vitest";

import { computeAvailableSlots, type AvailabilityWindow } from "./appointment";

const staffId = "staff-1" as never;
const retailerId = "retailer-1" as never;

function window(
  overrides: Partial<AvailabilityWindow> = {},
): AvailabilityWindow {
  return {
    id: "window-1" as never,
    staffId,
    retailerId,
    dayOfWeek: 3, // Wednesday
    startTime: "09:00",
    endTime: "12:00",
    ...overrides,
  };
}

describe("computeAvailableSlots", () => {
  // 2026-07-22 is a Wednesday.
  const wednesday = "2026-07-22";

  it("generates slots at the requested duration across the whole window", () => {
    const slots = computeAvailableSlots({
      windows: [window()],
      existingAppointments: [],
      date: wednesday,
      durationMinutes: 60,
    });

    expect(slots).toEqual([
      "2026-07-22T09:00:00.000Z",
      "2026-07-22T10:00:00.000Z",
      "2026-07-22T11:00:00.000Z",
    ]);
  });

  it("returns nothing for a day with no matching window", () => {
    const slots = computeAvailableSlots({
      windows: [window({ dayOfWeek: 1 })],
      existingAppointments: [],
      date: wednesday,
      durationMinutes: 60,
    });
    expect(slots).toEqual([]);
  });

  it("excludes a slot that overlaps an existing non-canceled appointment", () => {
    const slots = computeAvailableSlots({
      windows: [window()],
      existingAppointments: [
        {
          startsAt: "2026-07-22T10:00:00.000Z",
          endsAt: "2026-07-22T11:00:00.000Z",
          status: "confirmed",
        },
      ],
      date: wednesday,
      durationMinutes: 60,
    });

    expect(slots).toEqual([
      "2026-07-22T09:00:00.000Z",
      "2026-07-22T11:00:00.000Z",
    ]);
  });

  it("ignores a canceled appointment when checking for overlaps", () => {
    const slots = computeAvailableSlots({
      windows: [window()],
      existingAppointments: [
        {
          startsAt: "2026-07-22T10:00:00.000Z",
          endsAt: "2026-07-22T11:00:00.000Z",
          status: "canceled",
        },
      ],
      date: wednesday,
      durationMinutes: 60,
    });

    expect(slots).toHaveLength(3);
  });

  it("does not offer a slot that would run past the end of the window", () => {
    const slots = computeAvailableSlots({
      windows: [window({ startTime: "09:00", endTime: "10:30" })],
      existingAppointments: [],
      date: wednesday,
      durationMinutes: 60,
    });

    expect(slots).toEqual(["2026-07-22T09:00:00.000Z"]);
  });
});
