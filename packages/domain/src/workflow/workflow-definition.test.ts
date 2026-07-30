import { describe, expect, it } from "vitest";

import {
  ALTERATION_STATUS_LABELS,
  type AlterationStatus,
} from "../production/production";

import {
  ATELIER_TAILORING_PRESET,
  applyTerminologyLabels,
  buildAlterationWorkflowSnapshotV1,
  evaluateWorkflowTransition,
  PAON_RECOMMENDED_PRESET,
  presetsAreSemanticallyEquivalent,
} from "./workflow-definition";

describe("workflow definition and familiarity presets", () => {
  const snapshot = buildAlterationWorkflowSnapshotV1();

  it("pins the alteration graph as an immutable v1 snapshot", () => {
    expect(snapshot.versionLabel).toBe("alteration-work-order-v1");
    expect(snapshot.states).toContain("intake");
    expect(snapshot.states).toContain("completed");
    expect(snapshot.exceptions).toContain("canceled");
    const intakeToQuoted = snapshot.transitions.find(
      (rule) => rule.from === "intake" && rule.to === "quoted",
    );
    expect(intakeToQuoted?.requiredFields).toContain("quotedAmount");
    expect(intakeToQuoted?.allowedRoles).toContain("manager");
  });

  it("rejects invalid transitions on the pinned definition", () => {
    const result = evaluateWorkflowTransition({
      snapshot,
      from: "intake",
      to: "completed",
      role: "manager",
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("invalid_transition");
  });

  it("enforces role permissions and required fields", () => {
    const denied = evaluateWorkflowTransition({
      snapshot,
      from: "intake",
      to: "quoted",
      role: "worker",
      fieldValues: { quotedAmount: 100 },
    });
    expect(denied.ok).toBe(false);
    expect(denied.code).toBe("role_denied");

    const missing = evaluateWorkflowTransition({
      snapshot,
      from: "intake",
      to: "quoted",
      role: "manager",
    });
    expect(missing.ok).toBe(false);
    expect(missing.code).toBe("missing_required_field");

    const ok = evaluateWorkflowTransition({
      snapshot,
      from: "intake",
      to: "quoted",
      role: "manager",
      fieldValues: { quotedAmount: 12500 },
    });
    expect(ok.ok).toBe(true);
  });

  it("keeps presets semantically equivalent while changing labels only", () => {
    const keys = Object.keys(ALTERATION_STATUS_LABELS) as AlterationStatus[];
    expect(
      presetsAreSemanticallyEquivalent(
        PAON_RECOMMENDED_PRESET,
        ATELIER_TAILORING_PRESET,
        keys,
        ["/alterations", "/alterations/catalogue", "/alterations/workshops"],
      ),
    ).toBe(true);

    const remapped = applyTerminologyLabels(
      ALTERATION_STATUS_LABELS,
      ATELIER_TAILORING_PRESET.terminology,
    );
    expect(remapped.intake).toBe("Received");
    expect(remapped.in_progress).toBe("On the horse");
    expect(Object.keys(remapped).sort()).toEqual(keys.slice().sort());
  });

  it("does not mutate the v1 snapshot when a newer conceptual version differs", () => {
    const v1 = buildAlterationWorkflowSnapshotV1();
    const v2 = {
      ...v1,
      versionLabel: "alteration-work-order-v2",
      transitions: v1.transitions.filter(
        (rule) => !(rule.from === "intake" && rule.to === "canceled"),
      ),
    };
    expect(v1.transitions.length).toBeGreaterThan(v2.transitions.length);
    expect(
      evaluateWorkflowTransition({
        snapshot: v1,
        from: "intake",
        to: "canceled",
        role: "manager",
      }).ok,
    ).toBe(true);
    expect(
      evaluateWorkflowTransition({
        snapshot: v2,
        from: "intake",
        to: "canceled",
        role: "manager",
      }).ok,
    ).toBe(false);
  });
});
