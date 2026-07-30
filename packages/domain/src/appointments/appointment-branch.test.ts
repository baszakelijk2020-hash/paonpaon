import { describe, expect, it } from "vitest";

import {
  isSupportedTimeZone,
  looksLikeIanaTimeZone,
} from "../retailer/retailer-branch";
import { asId } from "../shared/branded-id";

import {
  computeAvailableSlots,
  wallTimeInZoneToUtcIso,
  type AvailabilityWindow,
} from "./appointment";
import { buildAppointmentCloseout } from "./appointment-closeout";
import { nextYearlyOccurrence } from "./customer-moment";

const retailerId = asId<"RetailerId">("11111111-1111-4111-8111-111111111111");
const customerId = asId<"CustomerId">("33333333-3333-4333-8333-333333333333");
const staffId = asId<"StaffId">("44444444-4444-4444-8444-444444444444");
const appointmentId = asId<"AppointmentId">(
  "55555555-5555-4555-8555-555555555555",
);

describe("retailer branch timezone", () => {
  it("accepts IANA labels and rejects junk", () => {
    expect(looksLikeIanaTimeZone("Europe/Amsterdam")).toBe(true);
    expect(isSupportedTimeZone("Europe/Amsterdam")).toBe(true);
    expect(looksLikeIanaTimeZone("NotAZone")).toBe(false);
    expect(isSupportedTimeZone("Not/A/Real/Zone/Name")).toBe(false);
  });
});

describe("timezone-aware slots", () => {
  it("shifts wall-clock windows into UTC for a named zone", () => {
    const windows: AvailabilityWindow[] = [
      {
        id: asId<"AvailabilityWindowId">(
          "66666666-6666-4666-8666-666666666666",
        ),
        staffId,
        retailerId,
        dayOfWeek: 3,
        startTime: "10:00",
        endTime: "11:00",
      },
    ];
    // 2026-07-29 is a Wednesday (UTC day 3).
    const utc = computeAvailableSlots({
      windows,
      existingAppointments: [],
      date: "2026-07-29",
      durationMinutes: 60,
    });
    const amsterdam = computeAvailableSlots({
      windows,
      existingAppointments: [],
      date: "2026-07-29",
      durationMinutes: 60,
      timeZone: "Europe/Amsterdam",
    });
    expect(utc[0]).toBe("2026-07-29T10:00:00.000Z");
    // CEST is UTC+2 in July.
    expect(amsterdam[0]).toBe("2026-07-29T08:00:00.000Z");
    expect(
      wallTimeInZoneToUtcIso("2026-07-29", "10:00", "Europe/Amsterdam"),
    ).toBe("2026-07-29T08:00:00.000Z");
  });
});

describe("appointment closeout", () => {
  it("requires selections and cites the appointment", () => {
    const empty = buildAppointmentCloseout({
      retailerId,
      customerId,
      appointmentId,
      authorStaffId: staffId,
      observedAt: "2026-07-30T12:00:00.000Z",
      selections: [],
    });
    expect(empty.ok).toBe(false);

    const ok = buildAppointmentCloseout({
      retailerId,
      customerId,
      appointmentId,
      authorStaffId: staffId,
      observedAt: "2026-07-30T12:00:00.000Z",
      selections: [
        {
          conceptId: "77777777-7777-4777-8777-777777777777",
          kind: "colour",
          label: "Brown",
          polarity: "positive",
        },
      ],
      nextStep: "Book fabric appointment",
      followUpDate: "2026-08-15",
    });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.drafts[0]?.provenanceClass).toBe("advisor_observed");
    expect(ok.freeformNote).toContain(`appointment:${appointmentId}`);
    expect(ok.freeformNote).toContain("next_step:Book fabric appointment");
  });
});

describe("customer moments", () => {
  it("projects the next yearly occurrence", () => {
    expect(
      nextYearlyOccurrence({
        occursOn: "2019-06-15",
        fromDate: "2026-07-30",
      }),
    ).toBe("2027-06-15");
    expect(
      nextYearlyOccurrence({
        occursOn: "2019-09-01",
        fromDate: "2026-07-30",
      }),
    ).toBe("2026-09-01");
  });
});
