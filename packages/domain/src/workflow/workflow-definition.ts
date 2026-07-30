/**
 * Versioned workflow definitions and familiarity presets
 * (INT-005 / WFM-103 kernel / PHASE 8.3 / ADR-067).
 *
 * Definition versions are immutable once published. Familiarity presets change
 * labels, grouping and defaults only — never canonical semantics or RLS.
 */

import type { RetailerRole } from "../identity/role";
import {
  ALTERATION_STATUS_TRANSITIONS,
  canRetailerRoleTransitionAlteration,
  type AlterationStatus,
} from "../production/production";
import type { RetailerId } from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

export const WORKFLOW_DEFINITION_KEYS = [
  "alteration_work_order",
  "appointment",
] as const;

export type WorkflowDefinitionKey = (typeof WORKFLOW_DEFINITION_KEYS)[number];

export const WORKFLOW_SUBJECT_TYPES = ["alteration", "appointment"] as const;

export type WorkflowSubjectType = (typeof WORKFLOW_SUBJECT_TYPES)[number];

export const WORKFLOW_VERSION_STATUSES = [
  "draft",
  "active",
  "retired",
] as const;

export type WorkflowVersionStatus = (typeof WORKFLOW_VERSION_STATUSES)[number];

export const FAMILIARITY_PRESET_KEYS = [
  "paon_recommended",
  "atelier_tailoring",
] as const;

export type FamiliarityPresetKey = (typeof FAMILIARITY_PRESET_KEYS)[number];

export const WORKFLOW_DEFINITION_PROJECTOR_VERSION = "workflow-definition-v1";

export interface WorkflowTransitionRule {
  readonly from: string;
  readonly to: string;
  readonly allowedRoles: readonly RetailerRole[];
  readonly requiredFields: readonly string[];
}

export interface WorkflowDefinitionSnapshot {
  readonly versionLabel: string;
  readonly states: readonly string[];
  readonly transitions: readonly WorkflowTransitionRule[];
  readonly exceptions: readonly string[];
}

export interface WorkflowDefinition {
  readonly id: string;
  readonly key: WorkflowDefinitionKey;
  readonly subjectType: WorkflowSubjectType;
  readonly displayName: string;
}

export interface WorkflowDefinitionVersion extends Timestamps {
  readonly id: string;
  readonly definitionId: string;
  readonly versionNumber: number;
  readonly status: WorkflowVersionStatus;
  readonly snapshot: WorkflowDefinitionSnapshot;
  readonly activatedAt?: string;
}

export interface WorkflowInstanceBinding extends Timestamps {
  readonly id: string;
  readonly retailerId: RetailerId;
  readonly subjectType: WorkflowSubjectType;
  readonly subjectId: string;
  readonly definitionVersionId: string;
  readonly pinnedAt: string;
}

export interface FamiliarityTerminology {
  /** Canonical semantic key → display label. */
  readonly labels: Readonly<Record<string, string>>;
}

export interface FamiliarityNavigation {
  /** Stable href → display label override. */
  readonly labelsByHref: Readonly<Record<string, string>>;
  /** Nav group id → display label override. */
  readonly groupLabels: Readonly<Record<string, string>>;
  readonly defaultLandingHref?: string;
}

export interface FamiliarityPreset {
  readonly key: FamiliarityPresetKey;
  readonly displayName: string;
  readonly terminology: FamiliarityTerminology;
  readonly navigation: FamiliarityNavigation;
}

export interface WorkflowTransitionDecision {
  readonly ok: boolean;
  readonly code?:
    | "invalid_transition"
    | "role_denied"
    | "missing_required_field"
    | "version_mismatch";
  readonly message?: string;
}

const ALL_ROLES: readonly RetailerRole[] = [
  "owner",
  "admin",
  "manager",
  "production_staff",
  "sales_associate",
  "workshop_manager",
  "worker",
] as const;

/**
 * Immutable v1 snapshot externalising today's alteration transition graph.
 * New versions must be published separately; active instances stay pinned.
 */
export function buildAlterationWorkflowSnapshotV1(): WorkflowDefinitionSnapshot {
  const states = Object.keys(
    ALTERATION_STATUS_TRANSITIONS,
  ) as AlterationStatus[];
  const transitions: WorkflowTransitionRule[] = [];

  for (const from of states) {
    for (const to of ALTERATION_STATUS_TRANSITIONS[from]) {
      const allowedRoles = ALL_ROLES.filter((role) =>
        canRetailerRoleTransitionAlteration(role, from, to),
      );
      const requiredFields =
        from === "intake" && to === "quoted" ? (["quotedAmount"] as const) : [];
      transitions.push({
        from,
        to,
        allowedRoles,
        requiredFields,
      });
    }
  }

  return {
    versionLabel: "alteration-work-order-v1",
    states,
    transitions,
    exceptions: ["canceled"],
  };
}

export function evaluateWorkflowTransition(args: {
  readonly snapshot: WorkflowDefinitionSnapshot;
  readonly from: string;
  readonly to: string;
  readonly role: RetailerRole;
  readonly fieldValues?: Readonly<Record<string, unknown>>;
}): WorkflowTransitionDecision {
  const rule = args.snapshot.transitions.find(
    (transition) => transition.from === args.from && transition.to === args.to,
  );
  if (!rule) {
    return {
      ok: false,
      code: "invalid_transition",
      message: `Transition ${args.from} → ${args.to} is not defined on this workflow version.`,
    };
  }
  if (!rule.allowedRoles.includes(args.role)) {
    return {
      ok: false,
      code: "role_denied",
      message: `Role ${args.role} cannot perform ${args.from} → ${args.to} on this workflow version.`,
    };
  }
  for (const field of rule.requiredFields) {
    const value = args.fieldValues?.[field];
    if (value === undefined || value === null || value === "") {
      return {
        ok: false,
        code: "missing_required_field",
        message: `Required field ${field} is missing for ${args.from} → ${args.to}.`,
      };
    }
  }
  return { ok: true };
}

/**
 * Presets must preserve semantic keys. Display strings may differ.
 */
export function applyTerminologyLabels<T extends string>(
  canonical: Readonly<Record<T, string>>,
  terminology: FamiliarityTerminology,
): Record<T, string> {
  const next = {} as Record<T, string>;
  for (const key of Object.keys(canonical) as T[]) {
    const override = terminology.labels[key];
    next[key] = override ?? canonical[key];
  }
  return next;
}

export function applyNavigationLabel(
  href: string,
  fallback: string,
  navigation: FamiliarityNavigation,
): string {
  return navigation.labelsByHref[href] ?? fallback;
}

/**
 * Two presets are semantically equivalent when they address the same
 * canonical keys and stable hrefs; display copy may differ.
 */
export function presetsAreSemanticallyEquivalent(
  left: FamiliarityPreset,
  right: FamiliarityPreset,
  canonicalKeys: readonly string[],
  canonicalHrefs: readonly string[],
): boolean {
  for (const key of canonicalKeys) {
    if (
      !(key in left.terminology.labels) ||
      !(key in right.terminology.labels)
    ) {
      return false;
    }
  }
  for (const href of canonicalHrefs) {
    if (
      !(href in left.navigation.labelsByHref) ||
      !(href in right.navigation.labelsByHref)
    ) {
      return false;
    }
  }
  return true;
}

export const PAON_RECOMMENDED_PRESET: FamiliarityPreset = {
  key: "paon_recommended",
  displayName: "PAON recommended",
  terminology: {
    labels: {
      intake: "Intake",
      quoted: "Quoted",
      awaiting_approval: "Awaiting approval",
      approved: "Approved",
      assigned: "Assigned",
      in_progress: "In progress",
      completion_review: "Completion review",
      ready_for_pickup: "Ready for collection",
      out_for_delivery: "Out for delivery",
      completed: "Completed",
      canceled: "Cancelled",
      nav_alterations: "Alterations",
      nav_alterations_group: "Fitting room",
    },
  },
  navigation: {
    labelsByHref: {
      "/alterations": "Alterations",
      "/alterations/catalogue": "Service catalogue",
      "/alterations/workshops": "Workshop network",
    },
    groupLabels: {
      fitting_room: "Fitting room",
    },
    defaultLandingHref: "/dashboard",
  },
};

export const ATELIER_TAILORING_PRESET: FamiliarityPreset = {
  key: "atelier_tailoring",
  displayName: "Atelier tailoring",
  terminology: {
    labels: {
      intake: "Received",
      quoted: "Estimate ready",
      awaiting_approval: "Client review",
      approved: "Greenlit",
      assigned: "On the board",
      in_progress: "On the horse",
      completion_review: "Final check",
      ready_for_pickup: "Ready for client",
      out_for_delivery: "With courier",
      completed: "Delivered",
      canceled: "Withdrawn",
      nav_alterations: "Work orders",
      nav_alterations_group: "Atelier floor",
    },
  },
  navigation: {
    labelsByHref: {
      "/alterations": "Work orders",
      "/alterations/catalogue": "Price list",
      "/alterations/workshops": "Partner ateliers",
    },
    groupLabels: {
      fitting_room: "Atelier floor",
    },
    defaultLandingHref: "/dashboard",
  },
};

export const FAMILIARITY_PRESET_CATALOG: Readonly<
  Record<FamiliarityPresetKey, FamiliarityPreset>
> = {
  paon_recommended: PAON_RECOMMENDED_PRESET,
  atelier_tailoring: ATELIER_TAILORING_PRESET,
};

export function resolveFamiliarityPreset(
  key: FamiliarityPresetKey | string | null | undefined,
): FamiliarityPreset {
  if (key && key in FAMILIARITY_PRESET_CATALOG) {
    return FAMILIARITY_PRESET_CATALOG[key as FamiliarityPresetKey];
  }
  return PAON_RECOMMENDED_PRESET;
}
