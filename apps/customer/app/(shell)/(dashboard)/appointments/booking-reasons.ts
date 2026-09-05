export const APPOINTMENT_REASONS = [
  {
    value: "in_the_mood_for_something_fresh",
    label: "In the mood for something fresh",
  },
  { value: "a_quick_glance", label: "A quick glance" },
  { value: "service_repair", label: "Service — repair" },
  { value: "service_size_check", label: "Service — size check" },
] as const;

export type AppointmentReason = (typeof APPOINTMENT_REASONS)[number]["value"];
