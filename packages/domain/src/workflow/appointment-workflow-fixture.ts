import type { WorkflowDefinitionSnapshot } from "./workflow";

export const APPOINTMENT_WORKFLOW_KEY = "appointment" as const;

/** Version 1 — exercised by existing appointment instances. */
export const APPOINTMENT_WORKFLOW_V1: WorkflowDefinitionSnapshot = {
  key: APPOINTMENT_WORKFLOW_KEY,
  version: 1,
  states: [
    "requested",
    "confirmed",
    "checked_in",
    "completed",
    "canceled",
    "no_show",
  ],
  transitions: [
    { from: "requested", to: "confirmed", requiredFields: ["staffId"] },
    { from: "requested", to: "canceled" },
    { from: "confirmed", to: "checked_in" },
    {
      from: "confirmed",
      to: "no_show",
      allowedRoles: ["owner", "admin", "manager"],
    },
    { from: "confirmed", to: "canceled" },
    { from: "checked_in", to: "completed" },
    { from: "checked_in", to: "canceled" },
  ],
};

/**
 * Version 2 — new instances only. Adds branch requirement on confirm so active
 * v1 instances are not mutated when this version is published.
 */
export const APPOINTMENT_WORKFLOW_V2: WorkflowDefinitionSnapshot = {
  key: APPOINTMENT_WORKFLOW_KEY,
  version: 2,
  states: APPOINTMENT_WORKFLOW_V1.states,
  transitions: [
    {
      from: "requested",
      to: "confirmed",
      requiredFields: ["staffId", "branchId"],
    },
    ...APPOINTMENT_WORKFLOW_V1.transitions.filter(
      (transition) =>
        !(transition.from === "requested" && transition.to === "confirmed"),
    ),
  ],
};

export const PLATFORM_APPOINTMENT_WORKFLOW_DEFINITION = {
  key: APPOINTMENT_WORKFLOW_KEY,
  displayName: "Appointment lifecycle",
  activeVersion: 2,
  versions: [APPOINTMENT_WORKFLOW_V1, APPOINTMENT_WORKFLOW_V2],
} as const;
