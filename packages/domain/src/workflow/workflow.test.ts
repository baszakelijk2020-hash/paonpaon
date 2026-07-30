import { describe, expect, it } from "vitest";

import {
  APPOINTMENT_WORKFLOW_V1,
  APPOINTMENT_WORKFLOW_V2,
} from "./appointment-workflow-fixture";
import {
  canTransitionWorkflow,
  evaluateWorkflowTransition,
  workflowSnapshotsSemanticallyEquivalent,
} from "./workflow";

describe("appointment workflow transitions", () => {
  it("allows the standard appointment lifecycle on v1", () => {
    expect(
      canTransitionWorkflow(APPOINTMENT_WORKFLOW_V1, "requested", "confirmed"),
    ).toBe(true);
    expect(
      canTransitionWorkflow(APPOINTMENT_WORKFLOW_V1, "confirmed", "checked_in"),
    ).toBe(true);
    expect(
      canTransitionWorkflow(APPOINTMENT_WORKFLOW_V1, "checked_in", "completed"),
    ).toBe(true);
  });

  it("rejects invalid or terminal transitions", () => {
    expect(
      canTransitionWorkflow(APPOINTMENT_WORKFLOW_V1, "completed", "checked_in"),
    ).toBe(false);
    expect(
      canTransitionWorkflow(APPOINTMENT_WORKFLOW_V1, "requested", "completed"),
    ).toBe(false);
  });

  it("requires staff assignment before confirm on v1", () => {
    const denied = evaluateWorkflowTransition({
      snapshot: APPOINTMENT_WORKFLOW_V1,
      from: "requested",
      to: "confirmed",
      role: "sales_associate",
      context: {},
    });
    expect(denied.ok).toBe(false);
    expect(denied.reason).toBe("missing_required_field");

    const allowed = evaluateWorkflowTransition({
      snapshot: APPOINTMENT_WORKFLOW_V1,
      from: "requested",
      to: "confirmed",
      role: "sales_associate",
      context: { staffId: "11111111-1111-1111-1111-111111111111" },
    });
    expect(allowed.ok).toBe(true);
  });

  it("limits no-show to manager roles", () => {
    expect(
      evaluateWorkflowTransition({
        snapshot: APPOINTMENT_WORKFLOW_V1,
        from: "confirmed",
        to: "no_show",
        role: "sales_associate",
      }).ok,
    ).toBe(false);
    expect(
      evaluateWorkflowTransition({
        snapshot: APPOINTMENT_WORKFLOW_V1,
        from: "confirmed",
        to: "no_show",
        role: "manager",
      }).ok,
    ).toBe(true);
  });
});

describe("workflow version pinning", () => {
  it("does not mutate v1 semantics when v2 adds branch requirement", () => {
    const v1Confirm = evaluateWorkflowTransition({
      snapshot: APPOINTMENT_WORKFLOW_V1,
      from: "requested",
      to: "confirmed",
      role: "sales_associate",
      context: { staffId: "11111111-1111-1111-1111-111111111111" },
    });
    expect(v1Confirm.ok).toBe(true);

    const v2ConfirmWithoutBranch = evaluateWorkflowTransition({
      snapshot: APPOINTMENT_WORKFLOW_V2,
      from: "requested",
      to: "confirmed",
      role: "sales_associate",
      context: { staffId: "11111111-1111-1111-1111-111111111111" },
    });
    expect(v2ConfirmWithoutBranch.ok).toBe(false);
    expect(v2ConfirmWithoutBranch.reason).toBe("missing_required_field");

    expect(
      workflowSnapshotsSemanticallyEquivalent(
        APPOINTMENT_WORKFLOW_V1,
        APPOINTMENT_WORKFLOW_V2,
      ),
    ).toBe(false);
  });
});
