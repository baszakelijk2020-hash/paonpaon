import { z } from "zod";

import type { AppointmentStatus } from "../appointments/appointment";
import { APPOINTMENT_STATUS_LABELS } from "../appointments/appointment.schema";

export const FAMILIARITY_PRESETS = [
  "paon_recommended",
  "atelier_tailoring",
  "endear_clienteling",
] as const;

export type FamiliarityPresetKey = (typeof FAMILIARITY_PRESETS)[number];

export const familiarityPresetSchema = z.object({
  presetKey: z.enum(FAMILIARITY_PRESETS),
});

export interface FamiliarityPresetConfig {
  readonly key: FamiliarityPresetKey;
  readonly displayName: string;
  readonly description: string;
  readonly labelAliases: Readonly<Record<string, string>>;
  readonly navGroups?: Readonly<Record<string, readonly string[]>>;
  readonly defaultLandingByRole?: Readonly<Record<string, string>>;
}

export const FAMILIARITY_PRESET_CONFIGS: Readonly<
  Record<FamiliarityPresetKey, FamiliarityPresetConfig>
> = {
  paon_recommended: {
    key: "paon_recommended",
    displayName: "PAON recommended",
    description:
      "Canonical PAON labels and navigation. Best when PAON is the primary system.",
    labelAliases: {},
    navGroups: {
      operations: ["appointments", "customers", "alterations"],
      intelligence: ["analytics", "campaigns"],
    },
    defaultLandingByRole: {
      sales_associate: "/appointments",
      manager: "/analytics",
    },
  },
  atelier_tailoring: {
    key: "atelier_tailoring",
    displayName: "Atelier / tailoring",
    description:
      "Familiar tailoring-house terminology for Faden-style operators.",
    labelAliases: {
      "appointment.status.requested": "Enquiry",
      "appointment.status.confirmed": "Booked",
      "appointment.status.checked_in": "In house",
      "appointment.status.completed": "Closed",
      "appointment.status.canceled": "Withdrawn",
      "appointment.status.no_show": "Missed visit",
      "appointment.type.fitting": "Try-on",
      "appointment.type.alteration_fitting": "Alteration fitting",
    },
    navGroups: {
      front_of_house: ["appointments", "customers"],
      workshop: ["alterations"],
    },
    defaultLandingByRole: {
      sales_associate: "/appointments",
      production_staff: "/alterations",
    },
  },
  endear_clienteling: {
    key: "endear_clienteling",
    displayName: "Clienteling",
    description:
      "Relationship-first labels common in clienteling suites. Data model unchanged.",
    labelAliases: {
      "appointment.status.requested": "Lead",
      "appointment.status.confirmed": "Scheduled",
      "appointment.status.checked_in": "In store",
      "appointment.status.completed": "Completed visit",
      "appointment.status.canceled": "Cancelled",
      "appointment.status.no_show": "Did not attend",
      "appointment.type.styling_consultation": "Style session",
      "appointment.type.personal_shopping": "Private appointment",
    },
    navGroups: {
      clienteling: ["customers", "appointments", "campaigns"],
    },
    defaultLandingByRole: {
      sales_associate: "/customers",
    },
  },
};

export interface RetailerFamiliarityPreset {
  readonly retailerId: string;
  readonly presetKey: FamiliarityPresetKey;
  readonly updatedAt: string;
}

export function getFamiliarityPresetConfig(
  presetKey: FamiliarityPresetKey,
): FamiliarityPresetConfig {
  return FAMILIARITY_PRESET_CONFIGS[presetKey];
}

export function resolvePresetLabel(
  presetKey: FamiliarityPresetKey,
  canonicalKey: string,
  fallback: string,
): string {
  const config = getFamiliarityPresetConfig(presetKey);
  return config.labelAliases[canonicalKey] ?? fallback;
}

export function resolveAppointmentStatusLabel(
  presetKey: FamiliarityPresetKey,
  status: AppointmentStatus,
): string {
  return resolvePresetLabel(
    presetKey,
    `appointment.status.${status}`,
    APPOINTMENT_STATUS_LABELS[status],
  );
}

/** Presets change presentation only — canonical status values stay identical. */
export function appointmentStatusLabelsAreSemanticallyEquivalent(
  presetKey: FamiliarityPresetKey,
): boolean {
  for (const status of Object.keys(
    APPOINTMENT_STATUS_LABELS,
  ) as AppointmentStatus[]) {
    const resolved = resolveAppointmentStatusLabel(presetKey, status);
    if (resolved.length === 0) return false;
  }
  return true;
}

export function suggestFamiliarityPresetForProvider(
  provider: string,
): FamiliarityPresetKey | null {
  if (provider === "faden") return "atelier_tailoring";
  if (provider === "endear") return "endear_clienteling";
  return null;
}
