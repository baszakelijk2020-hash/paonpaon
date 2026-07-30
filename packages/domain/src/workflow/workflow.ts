import type { RetailerRole } from "../identity/role";
import type { Timestamps } from "../shared/timestamps";

export const WORKFLOW_SUBJECT_TYPES = ["appointment"] as const;

export type WorkflowSubjectType = (typeof WORKFLOW_SUBJECT_TYPES)[number];

export interface WorkflowTransitionRule {
  readonly from: string;
  readonly to: string;
  readonly requiredFields?: readonly string[];
  readonly allowedRoles?: readonly RetailerRole[];
}

export interface WorkflowDefinitionSnapshot {
  readonly key: string;
  readonly version: number;
  readonly states: readonly string[];
  readonly transitions: readonly WorkflowTransitionRule[];
}

export interface WorkflowDefinition extends Timestamps {
  readonly id: string;
  readonly retailerId: string | null;
  readonly key: string;
  readonly displayName: string;
  readonly activeVersion: number;
}

export interface WorkflowDefinitionVersion extends Timestamps {
  readonly id: string;
  readonly definitionId: string;
  readonly retailerId: string | null;
  readonly key: string;
  readonly version: number;
  readonly snapshot: WorkflowDefinitionSnapshot;
}

export interface WorkflowInstance extends Timestamps {
  readonly id: string;
  readonly retailerId: string;
  readonly definitionVersionId: string;
  readonly subjectType: WorkflowSubjectType;
  readonly subjectId: string;
  readonly currentState: string;
}

export interface WorkflowEvent {
  readonly id: string;
  readonly retailerId: string;
  readonly instanceId: string;
  readonly fromState: string;
  readonly toState: string;
  readonly actorStaffId: string | null;
  readonly reason: string | null;
  readonly createdAt: string;
}

export interface WorkflowTransitionContext {
  readonly staffId?: string;
  readonly branchId?: string;
}

export type WorkflowTransitionFailureReason =
  | "unknown_state"
  | "invalid_transition"
  | "missing_required_field"
  | "role_denied";

export interface WorkflowTransitionEvaluation {
  readonly ok: boolean;
  readonly reason?: WorkflowTransitionFailureReason;
  readonly message?: string;
}

function findTransitionRule(
  snapshot: WorkflowDefinitionSnapshot,
  from: string,
  to: string,
): WorkflowTransitionRule | undefined {
  return snapshot.transitions.find(
    (transition) => transition.from === from && transition.to === to,
  );
}

export function canTransitionWorkflow(
  snapshot: WorkflowDefinitionSnapshot,
  from: string,
  to: string,
): boolean {
  if (!snapshot.states.includes(from) || !snapshot.states.includes(to)) {
    return false;
  }
  return findTransitionRule(snapshot, from, to) !== undefined;
}

export function evaluateWorkflowTransition(args: {
  readonly snapshot: WorkflowDefinitionSnapshot;
  readonly from: string;
  readonly to: string;
  readonly role: RetailerRole;
  readonly context?: WorkflowTransitionContext;
}): WorkflowTransitionEvaluation {
  const { snapshot, from, to, role, context = {} } = args;

  if (!snapshot.states.includes(from) || !snapshot.states.includes(to)) {
    return {
      ok: false,
      reason: "unknown_state",
      message: "Unknown workflow state.",
    };
  }

  const rule = findTransitionRule(snapshot, from, to);
  if (!rule) {
    return {
      ok: false,
      reason: "invalid_transition",
      message: `Cannot move from ${from} to ${to}.`,
    };
  }

  if (rule.allowedRoles && !rule.allowedRoles.includes(role)) {
    return {
      ok: false,
      reason: "role_denied",
      message: "Your role cannot perform this transition.",
    };
  }

  for (const field of rule.requiredFields ?? []) {
    if (field === "staffId" && !context.staffId) {
      return {
        ok: false,
        reason: "missing_required_field",
        message: "Assign an advisor before confirming.",
      };
    }
    if (field === "branchId" && !context.branchId) {
      return {
        ok: false,
        reason: "missing_required_field",
        message: "Select a branch before completing this step.",
      };
    }
  }

  return { ok: true };
}

/** Definition edits create a new version; instances keep their pinned snapshot. */
export function nextWorkflowDefinitionVersion(currentVersion: number): number {
  return currentVersion + 1;
}

export function workflowSnapshotsSemanticallyEquivalent(
  left: WorkflowDefinitionSnapshot,
  right: WorkflowDefinitionSnapshot,
): boolean {
  if (left.key !== right.key) return false;
  if (left.states.length !== right.states.length) return false;
  if (!left.states.every((state, index) => state === right.states[index])) {
    return false;
  }

  const signature = (snapshot: WorkflowDefinitionSnapshot): string =>
    [...snapshot.transitions]
      .map(
        (transition) =>
          `${transition.from}->${transition.to}:${(transition.requiredFields ?? []).join(",")}:${(transition.allowedRoles ?? []).join(",")}`,
      )
      .sort()
      .join("|");

  return signature(left) === signature(right);
}
