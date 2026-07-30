import { describe, expect, it } from "vitest";

import { APPOINTMENT_STATUS_LABELS } from "../appointments/appointment.schema";

import {
  appointmentStatusLabelsAreSemanticallyEquivalent,
  FAMILIARITY_PRESET_CONFIGS,
  resolveAppointmentStatusLabel,
  resolvePresetLabel,
  suggestFamiliarityPresetForProvider,
} from "./familiarity-preset";

describe("familiarity presets", () => {
  it("aliases labels without changing canonical status keys", () => {
    expect(
      resolveAppointmentStatusLabel("atelier_tailoring", "confirmed"),
    ).toBe("Booked");
    expect(resolveAppointmentStatusLabel("paon_recommended", "confirmed")).toBe(
      APPOINTMENT_STATUS_LABELS.confirmed,
    );
  });

  it("falls back to canonical copy for unknown keys", () => {
    expect(
      resolvePresetLabel(
        "endear_clienteling",
        "appointment.status.unknown",
        "Fallback",
      ),
    ).toBe("Fallback");
  });

  it("keeps semantic equivalence for every preset", () => {
    for (const key of Object.keys(FAMILIARITY_PRESET_CONFIGS)) {
      expect(
        appointmentStatusLabelsAreSemanticallyEquivalent(
          key as keyof typeof FAMILIARITY_PRESET_CONFIGS,
        ),
      ).toBe(true);
    }
  });

  it("suggests atelier preset for Faden connections", () => {
    expect(suggestFamiliarityPresetForProvider("faden")).toBe(
      "atelier_tailoring",
    );
    expect(suggestFamiliarityPresetForProvider("shopify")).toBeNull();
  });
});
