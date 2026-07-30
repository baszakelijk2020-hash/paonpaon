import {
  FamiliarityPresetRepository,
  resolveRetailerPresetKey,
} from "@paon/database";
import {
  APPOINTMENT_STATUSES,
  type AppointmentStatus,
  type FamiliarityPresetKey,
  resolveAppointmentStatusLabel,
} from "@paon/domain";

import { getSupabaseServerClient } from "./supabase-server";

export async function loadRetailerFamiliarityPresetKey(
  retailerId: string,
): Promise<FamiliarityPresetKey> {
  const supabase = await getSupabaseServerClient();
  const preset = await new FamiliarityPresetRepository(supabase).findByRetailer(
    retailerId as never,
  );
  return resolveRetailerPresetKey(preset);
}

export function appointmentStatusLabelsForPreset(
  presetKey: FamiliarityPresetKey,
): Record<AppointmentStatus, string> {
  return Object.fromEntries(
    APPOINTMENT_STATUSES.map((status) => [
      status,
      resolveAppointmentStatusLabel(presetKey, status),
    ]),
  ) as Record<AppointmentStatus, string>;
}
