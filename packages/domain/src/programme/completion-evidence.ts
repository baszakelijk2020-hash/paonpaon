/**
 * Machine-readable completion evidence (AUD-001–AUD-005 / PHASE 8.4 /
 * ADR-068). A checked PHASE box means verified with applicable evidence —
 * not merely that scaffolding landed.
 */

export const PROGRAMME_STATUS_VALUES = [
  "target",
  "implemented_unverified",
  "verified_local",
  "verified_live",
  "blocked_external",
  "deferred",
  "excluded",
] as const;

export type ProgrammeStatus = (typeof PROGRAMME_STATUS_VALUES)[number];

export const COMPLETION_EVIDENCE_FIELDS = [
  "domain",
  "persistence",
  "service",
  "origin_ui",
  "receiver_ui",
  "rls",
  "exceptions",
  "browser",
  "operations",
  "live_gap",
] as const;

export type CompletionEvidenceField =
  (typeof COMPLETION_EVIDENCE_FIELDS)[number];

export type EvidenceApplicability = "required" | "n_a";

export const UI_STATE_CHECKLIST_KEYS = [
  "loading",
  "empty",
  "error",
  "denied",
  "stale",
  "conflict",
  "success",
  "role_orientation",
  "task_continuation",
  "phone",
  "tablet",
  "desktop",
  "keyboard_a11y",
] as const;

export type UiStateChecklistKey = (typeof UI_STATE_CHECKLIST_KEYS)[number];

export type UiChecklistValue = "proven" | "n_a" | "missing";

export interface CompletionEvidenceRecord {
  readonly phaseItemId: string;
  readonly requirementIds: readonly string[];
  readonly status: ProgrammeStatus;
  readonly title: string;
  readonly applicability: Readonly<
    Record<CompletionEvidenceField, EvidenceApplicability>
  >;
  readonly evidence: Readonly<Record<CompletionEvidenceField, string | null>>;
  readonly uiChecklist: Readonly<Record<UiStateChecklistKey, UiChecklistValue>>;
  readonly linkedSeedId: string;
  readonly browserProofSpec: string;
  readonly assertedAt: string;
}

export interface CompletionEvidenceIssue {
  readonly field: string;
  readonly message: string;
}

export interface CompletionEvidenceValidation {
  readonly ok: boolean;
  readonly issues: readonly CompletionEvidenceIssue[];
}

export interface CompletionEvidenceValidateOptions {
  /**
   * When provided, repo-relative artifact paths mentioned in required
   * evidence / browserProofSpec must exist. Injected for unit tests.
   */
  readonly pathExists?: (relativePath: string) => boolean;
}

const VERIFIED_STATUSES: ReadonlySet<ProgrammeStatus> = new Set([
  "verified_local",
  "verified_live",
]);

const REPO_PATH_RE =
  /(?:^|[\s,])((?:packages|apps|docs|scripts|supabase)\/[\w./@+\-()[\]]+\.[\w]+)/g;

export function isProgrammeStatus(value: unknown): value is ProgrammeStatus {
  return (
    typeof value === "string" &&
    (PROGRAMME_STATUS_VALUES as readonly string[]).includes(value)
  );
}

function extractRepoPaths(value: string): string[] {
  const paths: string[] = [];
  for (const match of value.matchAll(REPO_PATH_RE)) {
    const path = match[1];
    if (path) paths.push(path);
  }
  return paths;
}

function isExecutableBrowserSpec(spec: string): boolean {
  return (
    /\.(spec|test)\.(ts|tsx|js|jsx)$/.test(spec) &&
    (spec.startsWith("apps/") || spec.startsWith("packages/"))
  );
}

/**
 * Rejects completion claims when any applicable evidence field is empty,
 * when n_a lacks an explanation, when referenced paths are missing, when the
 * browser spec is not executable, or when verified_* lacks seed/browser proof.
 */
export function validateCompletionEvidence(
  record: CompletionEvidenceRecord,
  options: CompletionEvidenceValidateOptions = {},
): CompletionEvidenceValidation {
  const issues: CompletionEvidenceIssue[] = [];

  if (!record.phaseItemId.trim()) {
    issues.push({
      field: "phaseItemId",
      message: "phaseItemId is required",
    });
  }
  if (record.requirementIds.length === 0) {
    issues.push({
      field: "requirementIds",
      message: "at least one requirement id is required",
    });
  }
  if (!isProgrammeStatus(record.status)) {
    issues.push({
      field: "status",
      message: `unknown status ${String(record.status)}`,
    });
  }

  for (const field of COMPLETION_EVIDENCE_FIELDS) {
    const applicability = record.applicability[field];
    const value = record.evidence[field];
    if (applicability === "required") {
      if (typeof value !== "string" || value.trim().length === 0) {
        issues.push({
          field,
          message: `required evidence field ${field} is missing`,
        });
      }
    } else if (typeof value !== "string" || value.trim().length === 0) {
      issues.push({
        field,
        message: `n_a field ${field} requires an explanatory note`,
      });
    }
  }

  if (VERIFIED_STATUSES.has(record.status)) {
    if (!record.linkedSeedId.trim()) {
      issues.push({
        field: "linkedSeedId",
        message: "verified status requires linkedSeedId",
      });
    }
    if (!record.browserProofSpec.trim()) {
      issues.push({
        field: "browserProofSpec",
        message: "verified status requires browserProofSpec",
      });
    } else if (!isExecutableBrowserSpec(record.browserProofSpec.trim())) {
      issues.push({
        field: "browserProofSpec",
        message:
          "browserProofSpec must be an executable apps/ or packages/ *.spec.ts path",
      });
    }
    for (const key of UI_STATE_CHECKLIST_KEYS) {
      const value = record.uiChecklist[key];
      if (value !== "proven" && value !== "n_a") {
        issues.push({
          field: `uiChecklist.${key}`,
          message: `verified status requires uiChecklist.${key} proven or n_a`,
        });
      }
    }
  }

  if (record.status === "blocked_external") {
    const gap = record.evidence.live_gap;
    if (typeof gap !== "string" || gap.trim().length === 0) {
      issues.push({
        field: "live_gap",
        message: "blocked_external requires a named live_gap",
      });
    }
  }

  if (options.pathExists) {
    const candidates = new Set<string>();
    for (const field of COMPLETION_EVIDENCE_FIELDS) {
      if (record.applicability[field] !== "required") continue;
      const value = record.evidence[field];
      if (typeof value === "string") {
        for (const path of extractRepoPaths(value)) {
          candidates.add(path);
        }
      }
    }
    if (record.browserProofSpec.trim()) {
      candidates.add(record.browserProofSpec.trim());
    }
    for (const path of candidates) {
      if (!options.pathExists(path)) {
        issues.push({
          field: "artifact",
          message: `referenced path does not exist: ${path}`,
        });
      }
    }
  }

  return { ok: issues.length === 0, issues };
}

/**
 * True only when status is a verified_* value and evidence validates.
 * Used to gate marking a PHASE item complete.
 */
export function mayMarkPhaseItemComplete(
  record: CompletionEvidenceRecord,
  options: CompletionEvidenceValidateOptions = {},
): boolean {
  if (!VERIFIED_STATUSES.has(record.status)) return false;
  return validateCompletionEvidence(record, options).ok;
}

export function parseCompletionEvidenceRecord(
  value: unknown,
): CompletionEvidenceRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Completion evidence must be an object");
  }
  const record = value as Record<string, unknown>;
  const applicabilityRaw = record["applicability"];
  const evidenceRaw = record["evidence"];
  const uiRaw = record["uiChecklist"];
  if (
    applicabilityRaw === null ||
    typeof applicabilityRaw !== "object" ||
    Array.isArray(applicabilityRaw) ||
    evidenceRaw === null ||
    typeof evidenceRaw !== "object" ||
    Array.isArray(evidenceRaw) ||
    uiRaw === null ||
    typeof uiRaw !== "object" ||
    Array.isArray(uiRaw)
  ) {
    throw new Error("Completion evidence missing applicability/evidence/ui");
  }

  const applicability = {} as Record<
    CompletionEvidenceField,
    EvidenceApplicability
  >;
  const evidence = {} as Record<CompletionEvidenceField, string | null>;
  for (const field of COMPLETION_EVIDENCE_FIELDS) {
    const app = (applicabilityRaw as Record<string, unknown>)[field];
    if (app !== "required" && app !== "n_a") {
      throw new Error(`Invalid applicability for ${field}`);
    }
    applicability[field] = app;
    const ev = (evidenceRaw as Record<string, unknown>)[field];
    evidence[field] = ev === null || ev === undefined ? null : String(ev);
  }

  const uiChecklist = {} as Record<UiStateChecklistKey, UiChecklistValue>;
  for (const key of UI_STATE_CHECKLIST_KEYS) {
    const ui = (uiRaw as Record<string, unknown>)[key];
    if (ui !== "proven" && ui !== "n_a" && ui !== "missing") {
      throw new Error(`Invalid uiChecklist for ${key}`);
    }
    uiChecklist[key] = ui;
  }

  const status = record["status"];
  if (!isProgrammeStatus(status)) {
    throw new Error(`Invalid programme status ${String(status)}`);
  }

  const requirementIds = Array.isArray(record["requirementIds"])
    ? record["requirementIds"].map(String)
    : [];

  return {
    phaseItemId: String(record["phaseItemId"] ?? ""),
    requirementIds,
    status,
    title: String(record["title"] ?? ""),
    applicability,
    evidence,
    uiChecklist,
    linkedSeedId: String(record["linkedSeedId"] ?? ""),
    browserProofSpec: String(record["browserProofSpec"] ?? ""),
    assertedAt: String(record["assertedAt"] ?? ""),
  };
}
